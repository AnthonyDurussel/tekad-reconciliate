import { inject, injectable } from "inversify";
import { type BexioExpenseDTO, type BexioExpenseQueryDTO } from "@repo/models";
import { ConflictError, NotFoundError } from "@/shared/domain/errors.js";
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
    const byAccountNo = new Map(
      accounts
        .filter((a) => a.bexioAccountNo)
        .map((a) => [a.bexioAccountNo!, a]),
    );
    const pieces = new Map(
      (await this.expenses.findByBexioExpenseIds(rows.map((r) => r.id))).map(
        (e) => [e.snapshot.bexioExpenseId!, e],
      ),
    );
    return rows.map((r) => {
      const account = r.bankAccountNo
        ? byAccountNo.get(r.bankAccountNo)
        : undefined;
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
        paymentAccountId: account?.id ?? null,
        paymentAccountName: account?.name ?? null,
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

  get(id: string) {
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
