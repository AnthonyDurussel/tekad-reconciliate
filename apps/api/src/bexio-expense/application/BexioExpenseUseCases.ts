import { inject, injectable } from "inversify";
import type {
  BexioExpenseDetailDTO,
  BexioExpenseDTO,
  BexioExpenseQueryDTO,
} from "@repo/models";
import { NotFoundError } from "@/shared/domain/errors.js";
import type { StoredFile } from "@/shared/application/ports/StoredFile.js";
import { log } from "@/shared/infrastructure/logging/logger.js";
import type {
  BexioExpense,
  IBexioGateway,
} from "@/bexio/application/ports/IBexioGateway.js";
import { BEXIO_TYPES } from "@/bexio/infrastructure/ioc/types.bexio.js";
import type { IExpenseRepository } from "@/expense/application/repositories/IExpenseRepository.js";
import { EXPENSE_TYPES } from "@/expense/infrastructure/ioc/types.expense.js";
import type { ISettingsRepository } from "@/settings/application/repositories/ISettingsRepository.js";
import { SETTINGS_TYPES } from "@/settings/infrastructure/ioc/types.settings.js";

/**
 * Les dépenses de bexio, lues en direct (rien n'est copié ici) : comptes
 * résolus par le plan comptable, compte de paiement par le compte du plan
 * comptable de leur compte bancaire payeur, dépense de l'application
 * rattachée par `expenses.bexio_expense_id`.
 */
@injectable()
export class BexioExpenseUseCases {
  constructor(
    @inject(BEXIO_TYPES.IBexioGateway) private bexio: IBexioGateway,
    @inject(EXPENSE_TYPES.IExpenseRepository)
    private expenses: IExpenseRepository,
    @inject(SETTINGS_TYPES.ISettingsRepository)
    private settings: ISettingsRepository,
  ) {}

  get configured() {
    return this.bexio.configured;
  }

  async list(query: BexioExpenseQueryDTO): Promise<BexioExpenseDTO[]> {
    const rows = await this.bexio.listExpenses({
      paidFrom: query.from,
      paidTo: query.to,
      vendor: query.search,
      withBankAccount: true,
    });
    const dtos = await this.toDTOs(rows);
    return query.unlinked ? dtos.filter((d) => !d.expenseId) : dtos;
  }

  /** Une dépense bexio (404 si elle n'existe pas). */
  async find(id: string): Promise<BexioExpenseDTO> {
    const row = await this.bexio.getExpense(id);
    if (!row) throw new NotFoundError("Bexio expense");
    return (await this.toDTOs([row]))[0];
  }

  async toDTOs(rows: BexioExpense[]): Promise<BexioExpenseDTO[]> {
    if (!rows.length) return [];
    const [chart, banks, accounts, linked] = await Promise.all([
      this.bexio.listAccounts(),
      this.bexio.listBankAccounts(),
      this.settings.listPaymentAccounts(),
      this.expenses.findByBexioExpenseIds(rows.map((r) => r.id)),
    ]);
    const chartById = new Map(chart.map((a) => [a.id, a]));
    const bankChart = new Map(
      banks.map((b) => [
        b.id,
        b.accountId ? chartById.get(b.accountId) : undefined,
      ]),
    );
    const byAccountNo = new Map(
      accounts
        .filter((a) => a.bexioAccountNo)
        .map((a) => [a.bexioAccountNo!, a]),
    );
    const expenseOf = new Map(
      linked.map((e) => [e.snapshot.bexioExpenseId!, e.id]),
    );
    return rows.map((r) => {
      const booking = r.bookingAccountId
        ? chartById.get(r.bookingAccountId)
        : undefined;
      const bank = r.bankAccountId ? bankChart.get(r.bankAccountId) : undefined;
      const account = bank ? byAccountNo.get(bank.accountNo) : undefined;
      return {
        id: r.id,
        documentNo: r.documentNo,
        title: r.title,
        vendor: r.vendor,
        status: r.status,
        paidOn: r.paidOn,
        gross: r.gross,
        currency: r.currency,
        bookingAccountNo: booking?.accountNo ?? null,
        bookingAccountName: booking?.name ?? null,
        bankAccountNo: bank?.accountNo ?? null,
        bankAccountName: bank?.name ?? null,
        paymentAccountId: account?.id ?? null,
        paymentAccountName: account?.name ?? null,
        reconciliation: account?.reconciliation ?? null,
        bexioReconciled: !!r.transactionId,
        attachmentIds: r.attachmentIds,
        expenseId: expenseOf.get(r.id) ?? null,
      };
    });
  }

  /** La dépense et ses fichiers joints (noms lus dans bexio). */
  async get(id: string): Promise<BexioExpenseDetailDTO> {
    const dto = await this.find(id);
    const attachments = await Promise.all(
      dto.attachmentIds.map(async (uuid) => {
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

  /** Un fichier joint à la dépense dans bexio : jamais un autre fichier. */
  async file(id: string, uuid: string): Promise<StoredFile> {
    const row = await this.bexio.getExpense(id);
    if (!row) throw new NotFoundError("Bexio expense");
    if (!row.attachmentIds.includes(uuid))
      throw new NotFoundError("Attachment");
    const found = await this.bexio.findFileByUuid(uuid);
    if (!found) throw new NotFoundError("Attachment");
    const file = await this.bexio.downloadFile(found.id);
    return {
      ...file,
      fileName: found.name,
      mimeType: found.mimeType ?? file.mimeType,
    };
  }
}
