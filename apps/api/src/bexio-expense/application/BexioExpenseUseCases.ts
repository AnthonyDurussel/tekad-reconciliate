import { inject, injectable } from "inversify";
import type {
  BexioExpenseDetailDTO,
  BexioExpenseDTO,
  BexioExpenseQueryDTO,
} from "@repo/models";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/shared/domain/errors.js";
import type { StoredFile } from "@/shared/application/ports/StoredFile.js";
import { log } from "@/shared/infrastructure/logging/logger.js";
import { dayToDate } from "@/shared/domain/dates.js";
import type { IBexioGateway } from "@/bexio/application/ports/IBexioGateway.js";
import { BEXIO_TYPES } from "@/bexio/infrastructure/ioc/types.bexio.js";
import type { IExpenseRepository } from "@/expense/application/repositories/IExpenseRepository.js";
import { EXPENSE_TYPES } from "@/expense/infrastructure/ioc/types.expense.js";
import type { Expense } from "@/expense/domain/Expense.js";
import type { ISettingsRepository } from "@/settings/application/repositories/ISettingsRepository.js";
import { SETTINGS_TYPES } from "@/settings/infrastructure/ioc/types.settings.js";
import type { IRevolutTransactionRepository } from "@/revolut/application/repositories/IRevolutTransactionRepository.js";
import { REVOLUT_TYPES } from "@/revolut/infrastructure/ioc/types.revolut.js";
import { checkBexioExpense } from "@/bexio-expense/domain/BexioExpenseCheck.js";
import type {
  IBexioExpenseRepository,
  StoredBexioExpense,
} from "@/bexio-expense/application/IBexioExpenseRepository.js";
import { BEXIO_EXPENSE_TYPES } from "@/bexio-expense/infrastructure/ioc/types.bexio-expense.js";

/**
 * Les dépenses de bexio : chacune doit avoir sa pièce et, selon son compte
 * payeur, être rapprochée. La synchronisation relit toutes les dépenses,
 * résout leurs comptes (plan comptable, comptes bancaires) et lie les pièces
 * dont le fichier y est joint.
 */
@injectable()
export class BexioExpenseUseCases {
  constructor(
    @inject(BEXIO_EXPENSE_TYPES.IBexioExpenseRepository)
    private repository: IBexioExpenseRepository,
    @inject(BEXIO_TYPES.IBexioGateway) private bexio: IBexioGateway,
    @inject(EXPENSE_TYPES.IExpenseRepository)
    private expenses: IExpenseRepository,
    @inject(SETTINGS_TYPES.ISettingsRepository)
    private settings: ISettingsRepository,
    @inject(REVOLUT_TYPES.IRevolutTransactionRepository)
    private transactions: IRevolutTransactionRepository,
  ) {}

  get configured() {
    return this.bexio.configured;
  }

  /** Relit les dépenses bexio ; rend le nombre de pièces nouvellement liées. */
  async sync(): Promise<number> {
    const [list, chart, banks] = await Promise.all([
      this.bexio.listExpenses(),
      this.bexio.listAccounts(),
      this.bexio.listBankAccounts(),
    ]);
    const accountById = new Map(chart.map((a) => [a.id, a]));
    const bankAccountNo = new Map(
      banks.map((b) => [
        b.id,
        b.accountId ? (accountById.get(b.accountId)?.accountNo ?? null) : null,
      ]),
    );
    await this.repository.replaceAll(
      list.map((e) => ({
        ...e,
        bookingAccountNo: e.bookingAccountId
          ? (accountById.get(e.bookingAccountId)?.accountNo ?? null)
          : null,
        bookingAccountName: e.bookingAccountId
          ? (accountById.get(e.bookingAccountId)?.name ?? null)
          : null,
        bankAccountNo: e.bankAccountId
          ? (bankAccountNo.get(e.bankAccountId) ?? null)
          : null,
      })),
    );
    const ids = new Set(list.map((e) => e.id));
    // Pièces liées à une dépense qui n'existe plus dans bexio : déliées.
    const ctx = await this.context();
    const orphans = (await this.expenses.list({})).filter(
      (e) => e.snapshot.bexioExpenseId && !ids.has(e.snapshot.bexioExpenseId),
    );
    for (const expense of orphans) {
      expense.unlinkBexioExpense({ ...ctx, transaction: null });
      await this.expenses.save(expense);
    }
    // Pièces dont le fichier est joint à une dépense : liées.
    let count = 0;
    const byUuid = new Map<string, Expense>(
      (
        await this.expenses.findByFileUuids(
          list.flatMap((e) => e.attachmentIds),
        )
      ).map((e) => [e.snapshot.bexioFileUuid!, e]),
    );
    for (const e of list) {
      for (const uuid of e.attachmentIds) {
        const expense = byUuid.get(uuid);
        if (!expense || expense.snapshot.bexioExpenseId === e.id) continue;
        if (expense.snapshot.bexioExpenseId || expense.status === "IGNORED")
          continue;
        expense.linkBexioExpense(e.id);
        await this.expenses.save(expense);
        count++;
      }
    }
    return count;
  }

  private async context() {
    const [accounts, categories] = await Promise.all([
      this.settings.listPaymentAccounts(),
      this.settings.listCategories(),
    ]);
    return { accounts, categories };
  }

  async list(query: BexioExpenseQueryDTO): Promise<BexioExpenseDTO[]> {
    const rows = await this.repository.list({
      from: dayToDate(query.from) ?? undefined,
      to: query.to
        ? new Date(dayToDate(query.to)!.getTime() + 86_400_000)
        : undefined,
      search: query.search,
    });
    return (await this.toDTOs(rows)).filter((d) => {
      if (query.paymentAccountId === "none" && d.paymentAccountId) return false;
      if (
        query.paymentAccountId &&
        query.paymentAccountId !== "none" &&
        d.paymentAccountId !== query.paymentAccountId
      )
        return false;
      if (query.issue === "ok") return d.issues.length === 0;
      if (query.issue) return d.issues.includes(query.issue);
      return true;
    });
  }

  private async toDTOs(rows: StoredBexioExpense[]): Promise<BexioExpenseDTO[]> {
    const accounts = await this.settings.listPaymentAccounts();
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const byBank = new Map(
      accounts
        .filter((a) => a.bexioBankAccountId)
        .map((a) => [a.bexioBankAccountId!, a]),
    );
    const byAccountNo = new Map(
      accounts
        .filter((a) => a.bexioAccountNo)
        .map((a) => [a.bexioAccountNo!, a]),
    );
    /** Choisi sur la dépense › compte bancaire associé › n° du plan comptable. */
    const resolve = (r: StoredBexioExpense) => {
      const manual = r.paymentAccountId
        ? byId.get(r.paymentAccountId)
        : undefined;
      if (manual) return { account: manual, source: "MANUAL" as const };
      const bank = r.bankAccountId ? byBank.get(r.bankAccountId) : undefined;
      if (bank) return { account: bank, source: "BANK_ACCOUNT" as const };
      const no = r.bankAccountNo ? byAccountNo.get(r.bankAccountNo) : undefined;
      if (no) return { account: no, source: "ACCOUNT_NO" as const };
      return { account: undefined, source: null };
    };
    const pieces = new Map(
      (await this.expenses.findByBexioExpenseIds(rows.map((r) => r.id))).map(
        (e) => [e.snapshot.bexioExpenseId!, e],
      ),
    );
    return rows.map((r) => {
      const { account, source } = resolve(r);
      const piece = pieces.get(r.id);
      const check = checkBexioExpense({
        status: r.status,
        attachmentCount: r.attachmentIds.length,
        hasLinkedReceipt: !!piece,
        hasBankAccount: !!r.bankAccountId,
        reconciliation: account?.reconciliation ?? null,
        bexioReconciled: !!r.transactionId,
        statementMatched: !!piece?.transactionId,
      });
      return {
        id: r.id,
        documentNo: r.documentNo,
        title: r.title,
        vendor: r.vendor,
        status: r.status,
        paidOn: r.paidOn,
        gross: r.gross,
        currency: r.currency,
        bookingAccountNo: r.bookingAccountNo,
        bookingAccountName: r.bookingAccountName,
        bankAccountId: r.bankAccountId,
        bankAccountNo: r.bankAccountNo,
        paymentAccountId: account?.id ?? null,
        paymentAccountName: account?.name ?? null,
        paymentAccountSource: source,
        reconciliation: account?.reconciliation ?? null,
        attachmentCount: r.attachmentIds.length,
        expenseId: piece?.id ?? null,
        expenseFileName: piece?.snapshot.fileName ?? null,
        bexioReconciled: !!r.transactionId,
        statementTransactionId: piece?.transactionId ?? null,
        reconciled: check.reconciled,
        issues: check.issues,
        syncedAt: r.syncedAt.toISOString(),
      };
    });
  }

  private async one(id: string): Promise<BexioExpenseDTO> {
    const row = await this.repository.find(id);
    if (!row) throw new NotFoundError("Bexio expense");
    return (await this.toDTOs([row]))[0];
  }

  /** La dépense et ses fichiers joints (noms lus dans bexio). */
  async get(id: string): Promise<BexioExpenseDetailDTO> {
    const dto = await this.one(id);
    const row = (await this.repository.find(id))!;
    const attachments = await Promise.all(
      row.attachmentIds.map(async (uuid) => {
        try {
          const file = await this.bexio.findFileByUuid(uuid);
          return {
            uuid,
            name: file?.name ?? null,
            mimeType: file?.mimeType ?? null,
          };
        } catch (error) {
          log.warn(`[bexio] fichier ${uuid} illisible`, error);
          return { uuid, name: null, mimeType: null };
        }
      }),
    );
    return { ...dto, attachments };
  }

  /**
   * Un fichier joint à la dépense dans bexio, ou celui de la pièce liée :
   * jamais un autre fichier de bexio.
   */
  async file(id: string, uuid: string): Promise<StoredFile> {
    const row = await this.repository.find(id);
    if (!row) throw new NotFoundError("Bexio expense");
    const piece = (await this.expenses.findByBexioExpenseIds([id]))[0];
    if (!row.attachmentIds.includes(uuid)) {
      if (piece && piece.snapshot.bexioFileUuid === uuid) {
        return this.bexio.downloadFile(piece.snapshot.bexioFileId);
      }
      throw new NotFoundError("Attachment");
    }
    const found = await this.bexio.findFileByUuid(uuid);
    if (!found) throw new NotFoundError("Attachment");
    const file = await this.bexio.downloadFile(found.id);
    return {
      ...file,
      fileName: found.name,
      mimeType: found.mimeType ?? file.mimeType,
    };
  }

  /**
   * Le compte de paiement de la dépense (`null` : de nouveau déduit). Avec
   * `applyToBankAccount`, le compte bancaire bexio de la dépense est associé
   * à ce compte de paiement : toutes ses dépenses le suivent (le choix posé
   * sur cette dépense-ci est alors retiré, il n'est plus utile).
   */
  async setPaymentAccount(
    id: string,
    paymentAccountId: string | null,
    applyToBankAccount = false,
  ): Promise<BexioExpenseDTO> {
    const row = await this.repository.find(id);
    if (!row) throw new NotFoundError("Bexio expense");
    if (!paymentAccountId) {
      await this.repository.setPaymentAccount(id, null);
      return this.one(id);
    }
    const account = await this.settings.findPaymentAccount(paymentAccountId);
    if (!account) throw new NotFoundError("Payment account");
    if (!applyToBankAccount) {
      await this.repository.setPaymentAccount(id, paymentAccountId);
      return this.one(id);
    }
    if (!row.bankAccountId) {
      throw new ValidationError(
        "cette dépense bexio n'indique pas de compte bancaire",
      );
    }
    // Le compte bancaire bexio ne va qu'à un compte de paiement.
    for (const other of await this.settings.listPaymentAccounts()) {
      if (
        other.id !== account.id &&
        other.bexioBankAccountId === row.bankAccountId
      ) {
        const { expenseCount: _count, ...plain } = other;
        await this.settings.savePaymentAccount(
          { ...plain, bexioBankAccountId: null },
          false,
        );
      }
    }
    await this.settings.savePaymentAccount(
      { ...account, bexioBankAccountId: row.bankAccountId },
      false,
    );
    await this.repository.setPaymentAccount(id, null);
    return this.one(id);
  }

  /**
   * Joint la pièce à la dépense bexio (son fichier, dans bexio) et la lie
   * ici : elle est comptabilisée par cette dépense.
   */
  async link(id: string, expenseId: string): Promise<BexioExpenseDTO> {
    const row = await this.repository.find(id);
    if (!row) throw new NotFoundError("Bexio expense");
    const expense = await this.expenses.findById(expenseId);
    if (!expense) throw new NotFoundError("Expense");
    const other = (await this.expenses.findByBexioExpenseIds([id]))[0];
    if (other && other.id !== expenseId) {
      throw new ConflictError(
        `cette dépense bexio a déjà sa pièce (« ${other.snapshot.fileName} »)`,
      );
    }
    let uuid = expense.snapshot.bexioFileUuid;
    if (!uuid) {
      uuid = await this.bexio.fileUuid(expense.snapshot.bexioFileId);
      expense.setFileUuid(uuid);
    }
    expense.linkBexioExpense(id);
    if (!row.attachmentIds.includes(uuid)) {
      await this.bexio.attachFilesToExpense(id, [uuid]);
      await this.repository.setAttachments(id, [...row.attachmentIds, uuid]);
    }
    await this.expenses.save(expense);
    return this.one(id);
  }

  /** Défait le lien ici (le fichier reste joint dans bexio). */
  async unlink(id: string): Promise<BexioExpenseDTO> {
    const expense = (await this.expenses.findByBexioExpenseIds([id]))[0];
    if (expense) {
      const ctx = await this.context();
      const transaction = expense.transactionId
        ? await this.transactions.findByExpense(expense.id)
        : null;
      expense.unlinkBexioExpense({ ...ctx, transaction });
      await this.expenses.save(expense);
    }
    return this.one(id);
  }
}
