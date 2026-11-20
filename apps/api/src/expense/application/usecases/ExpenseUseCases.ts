import { randomUUID } from "node:crypto";
import { inject, injectable } from "inversify";
import {
  BookingModeDTO,
  autoMatch,
  rankCandidates,
  ExpenseStatusDTO,
  type ExtractionDTO,
  type UpdateExpenseDTO,
} from "@repo/models";
import {
  ConflictError,
  InvalidStateError,
  NotFoundError,
} from "@/shared/domain/errors.js";
import { dayToDate } from "@/shared/domain/dates.js";
import { log } from "@/shared/infrastructure/logging/logger.js";
import type { StoredFile } from "@/shared/application/ports/StoredFile.js";
import { Expense, type ExpenseContext } from "@/expense/domain/Expense.js";
import type {
  ExpenseFilter,
  IExpenseRepository,
} from "@/expense/application/repositories/IExpenseRepository.js";
import { EXPENSE_TYPES } from "@/expense/infrastructure/ioc/types.expense.js";
import type { ISettingsRepository } from "@/settings/application/repositories/ISettingsRepository.js";
import { SETTINGS_TYPES } from "@/settings/infrastructure/ioc/types.settings.js";
import type { PaymentAccountProps } from "@/settings/domain/PaymentAccount.js";
import type { ExpenseCategoryProps } from "@/settings/domain/ExpenseCategory.js";
import type { IRevolutTransactionRepository } from "@/revolut/application/repositories/IRevolutTransactionRepository.js";
import type { RevolutTransactionProps } from "@/revolut/domain/RevolutTransaction.js";
import { REVOLUT_TYPES } from "@/revolut/infrastructure/ioc/types.revolut.js";
import type { IBexioGateway } from "@/bexio/application/ports/IBexioGateway.js";
import { BEXIO_TYPES } from "@/bexio/infrastructure/ioc/types.bexio.js";
import type { IReceiptReader } from "@/extraction/application/ports/IReceiptReader.js";
import { EXTRACTION_TYPES } from "@/extraction/infrastructure/ioc/types.extraction.js";

/** Fenêtre de recherche d'une transaction autour de la date du ticket. */
const MATCH_WINDOW_DAYS = 6;
/** Pièces lues par passage (une lecture prend quelques secondes). */
export const EXTRACT_BATCH = 15;

type Matchable = RevolutTransactionProps & { date: string };
const matchable = (t: RevolutTransactionProps): Matchable => ({
  ...t,
  date: t.occurredAt.toISOString().slice(0, 10),
});

export interface ExpenseView {
  expense: Expense;
  ctx: ExpenseContext;
}

/**
 * Les pièces : import de l'inbox bexio, lecture, classement, rapprochement
 * Revolut, comptabilisation dans bexio.
 */
@injectable()
export class ExpenseUseCases {
  private settingsCache: Promise<{
    accounts: PaymentAccountProps[];
    categories: ExpenseCategoryProps[];
  }> | null = null;

  constructor(
    @inject(EXPENSE_TYPES.IExpenseRepository)
    private expenses: IExpenseRepository,
    @inject(SETTINGS_TYPES.ISettingsRepository)
    private settings: ISettingsRepository,
    @inject(REVOLUT_TYPES.IRevolutTransactionRepository)
    private transactions: IRevolutTransactionRepository,
    @inject(BEXIO_TYPES.IBexioGateway) private bexio: IBexioGateway,
    @inject(EXTRACTION_TYPES.IReceiptReader) private reader: IReceiptReader,
  ) {}

  /** Paramétrage lu une fois par requête. */
  private loadSettings() {
    this.settingsCache ??= Promise.all([
      this.settings.listPaymentAccounts(),
      this.settings.listCategories(),
    ]).then(([accounts, categories]) => ({ accounts, categories }));
    return this.settingsCache;
  }

  private async context(expense: Expense): Promise<ExpenseContext> {
    const { accounts, categories } = await this.loadSettings();
    const transaction = expense.transactionId
      ? await this.transactions.findByExpense(expense.id)
      : null;
    return { accounts, categories, transaction };
  }

  private async load(id: string): Promise<ExpenseView> {
    const expense = await this.expenses.findById(id);
    if (!expense) throw new NotFoundError("Expense");
    return { expense, ctx: await this.context(expense) };
  }

  readerConfigured(): Promise<boolean> {
    return this.reader.isConfigured();
  }
  get bexioConfigured() {
    return this.bexio.configured;
  }

  async list(filter: ExpenseFilter): Promise<ExpenseView[]> {
    const [list, { accounts, categories }] = await Promise.all([
      this.expenses.list(filter),
      this.loadSettings(),
    ]);
    const txs = await this.transactions.findByIds(
      list.map((e) => e.transactionId).filter((id): id is string => !!id),
    );
    const byId = new Map(txs.map((t) => [t.id, t]));
    return list.map((expense) => ({
      expense,
      ctx: {
        accounts,
        categories,
        transaction: expense.transactionId
          ? (byId.get(expense.transactionId) ?? null)
          : null,
      },
    }));
  }

  get(id: string): Promise<ExpenseView> {
    return this.load(id);
  }

  async file(id: string): Promise<StoredFile> {
    const { expense } = await this.load(id);
    return this.bexio.downloadFile(expense.snapshot.bexioFileId);
  }

  async update(id: string, patch: UpdateExpenseDTO): Promise<ExpenseView> {
    const view = await this.load(id);
    view.expense.update(patch, view.ctx);
    await this.expenses.save(view.expense);
    // Montant, date ou compte corrigés : la transaction peut maintenant se trouver.
    await this.tryAutoMatch(view.expense, view.ctx, new Set());
    return this.load(id);
  }

  /** Relit la pièce (Claude), reclasse, cherche sa transaction Revolut. */
  async extract(id: string): Promise<ExpenseView> {
    const view = await this.load(id);
    await this.readAndClassify(view);
    return this.load(id);
  }

  private async readAndClassify(view: ExpenseView): Promise<void> {
    const { expense, ctx } = view;
    let extraction: ExtractionDTO;
    try {
      const file = await this.bexio.downloadFile(expense.snapshot.bexioFileId);
      extraction = await this.reader.read(file, {
        categories: ctx.categories
          .filter((c) => c.active)
          .map((c) => ({ code: c.code, label: c.label })),
        knownCards: ctx.accounts.flatMap((a) =>
          a.active ? a.cards.filter((c) => c.active).map((c) => c.last4) : [],
        ),
      });
    } catch (error) {
      if (error instanceof ConflictError && !(await this.reader.isConfigured()))
        throw error;
      log.warn(`[extraction] ${expense.snapshot.fileName}`, error);
      extraction = {
        merchant: null,
        date: null,
        totalAmount: null,
        currency: null,
        vatAmount: null,
        vatRate: null,
        cardLast4: null,
        paymentMethod: null,
        categoryCode: null,
        description: null,
        confidence: 0,
        error: error instanceof Error ? error.message : "lecture impossible",
      };
    }
    expense.applyExtraction(extraction, ctx);
    await this.expenses.save(expense);
    await this.tryAutoMatch(expense, ctx, new Set());
  }

  async candidates(id: string) {
    const { expense, ctx } = await this.load(id);
    const s = expense.snapshot;
    if (!s.date) return [];
    const pool = await this.window(s.date);
    if (ctx.transaction) pool.push(matchable(ctx.transaction));
    return rankCandidates(s, pool).slice(0, 10);
  }

  private async window(day: string): Promise<Matchable[]> {
    const date = dayToDate(day)!;
    const ms = MATCH_WINDOW_DAYS * 86_400_000;
    const list = await this.transactions.listUnmatched(
      new Date(date.getTime() - ms),
      new Date(date.getTime() + ms + 86_400_000),
    );
    return list.map(matchable);
  }

  async match(id: string, transactionId: string | null): Promise<ExpenseView> {
    const view = await this.load(id);
    let transaction: RevolutTransactionProps | null = null;
    if (transactionId) {
      transaction = await this.transactions.findById(transactionId);
      if (!transaction) throw new NotFoundError("Revolut transaction");
      if (transaction.expenseId && transaction.expenseId !== id) {
        throw new ConflictError(
          "cette transaction est déjà rapprochée d'une autre pièce",
        );
      }
    }
    view.expense.attachTransaction(transaction, view.ctx);
    await this.transactions.clearExpense(id);
    if (transaction) await this.transactions.setExpense(transaction.id, id);
    await this.expenses.save(view.expense);
    return this.load(id);
  }

  /** Rapproche si une seule transaction convient nettement. */
  private async tryAutoMatch(
    expense: Expense,
    ctx: ExpenseContext,
    used: Set<string>,
  ): Promise<boolean> {
    const s = expense.snapshot;
    if (!s.date || !expense.canMatchRevolut(ctx)) return false;
    const pool = (await this.window(s.date)).filter((t) => !used.has(t.id));
    const found = autoMatch(s, pool);
    if (!found) return false;
    expense.attachTransaction(found, ctx);
    await this.transactions.setExpense(found.id, expense.id);
    await this.expenses.save(expense);
    used.add(found.id);
    return true;
  }

  async ignore(id: string, reason: string | null): Promise<ExpenseView> {
    const view = await this.load(id);
    await this.transactions.clearExpense(id);
    view.expense.attachTransaction(null, view.ctx);
    view.expense.ignore(reason);
    await this.expenses.save(view.expense);
    return this.load(id);
  }

  async restore(id: string): Promise<ExpenseView> {
    const view = await this.load(id);
    view.expense.restoreFromIgnored(view.ctx);
    await this.expenses.save(view.expense);
    return this.load(id);
  }

  /**
   * Comptabilise une pièce prête : une dépense bexio (« Ausgabe », pièce
   * jointe) quand le compte crédité est un compte bancaire de bexio, sinon
   * une écriture manuelle (compte courant…) ; pour un compte rapproché dans
   * bexio (UBS), simple marque — la dépense naît du rapprochement bexio.
   */
  async book(id: string, userId: string | null): Promise<ExpenseView> {
    const { expense, ctx } = await this.load(id);
    if (expense.status !== ExpenseStatusDTO.READY) {
      throw new InvalidStateError("seule une pièce prête se comptabilise");
    }
    const booking = expense.booking(ctx);
    if (booking.missing.length) {
      throw new InvalidStateError(
        `imputation incomplète : ${booking.missing.join(", ")}`,
      );
    }
    let entryId: string | null = null;
    let bexioExpenseId: string | null = null;
    if (booking.mode === BookingModeDTO.MANUAL_ENTRY) {
      const target = await this.bexioExpenseTarget(
        booking.creditAccountNo!,
        booking.debitAccountNo!,
      );
      if (target) {
        // Compte bancaire dans bexio : une dépense (« Ausgabe »), pièce jointe.
        bexioExpenseId = await this.bexio.createExpense({
          paidOn: booking.date!,
          title: booking.description,
          amountChf: booking.amountChf!,
          bankAccountId: target.bankAccountId,
          bookingAccountId: target.bookingAccountId,
          taxId: booking.bexioTaxId,
          attachmentIds: [await this.fileUuid(expense)],
        });
      } else {
        // Sans compte bancaire (compte courant…) : écriture manuelle.
        const file = await this.bexio.downloadFile(
          expense.snapshot.bexioFileId,
        );
        entryId = await this.bexio.createManualEntry({
          date: booking.date!,
          reference: expense.snapshot.fileName,
          description: booking.description,
          amountChf: booking.amountChf!,
          debitAccountNo: booking.debitAccountNo!,
          creditAccountNo: booking.creditAccountNo!,
          taxId: booking.bexioTaxId,
          attachment: file,
        });
      }
    }
    expense.markBooked(entryId, userId, new Date(), bexioExpenseId);
    await this.expenses.save(expense);
    return this.load(id);
  }

  /** L'UUID du fichier de la pièce (lu dans bexio s'il manque). */
  private async fileUuid(expense: Expense): Promise<string> {
    if (expense.snapshot.bexioFileUuid) return expense.snapshot.bexioFileUuid;
    const uuid = await this.bexio.fileUuid(expense.snapshot.bexioFileId);
    expense.setFileUuid(uuid);
    return uuid;
  }

  /**
   * Le compte bancaire bexio du compte crédité et l'id du compte de charge :
   * `null` quand le compte crédité n'est pas un compte bancaire de bexio.
   */
  private async bexioExpenseTarget(
    creditAccountNo: string,
    debitAccountNo: string,
  ): Promise<{ bankAccountId: number; bookingAccountId: number } | null> {
    const [chart, banks] = await Promise.all([
      this.bexio.listAccounts(),
      this.bexio.listBankAccounts(),
    ]);
    const credit = chart.find((a) => a.accountNo === creditAccountNo);
    const debit = chart.find((a) => a.accountNo === debitAccountNo);
    const bank = credit
      ? banks.find((b) => b.accountId === credit.id)
      : undefined;
    if (!bank || !debit) return null;
    return { bankAccountId: bank.id, bookingAccountId: debit.id };
  }

  async unbook(id: string): Promise<ExpenseView> {
    const view = await this.load(id);
    view.expense.unbook(view.ctx);
    await this.expenses.save(view.expense);
    return this.load(id);
  }

  // ---------------------------------------------------- synchronisations

  /** Nouvelles pièces de l'inbox bexio ; rend leur nombre. */
  async importInbox(): Promise<number> {
    const files = await this.bexio.listInboxFiles();
    if (!files.length) return 0;
    const known = await this.expenses.existingFileIds(files.map((f) => f.id));
    await this.expenses.setMissingFileUuids(
      new Map(
        files
          .filter((f) => f.uuid && known.has(f.id))
          .map((f) => [f.id, f.uuid!]),
      ),
    );
    let created = 0;
    for (const file of files) {
      if (known.has(file.id)) continue;
      await this.expenses.create(
        Expense.importFromInbox({
          id: randomUUID(),
          bexioFileId: file.id,
          bexioFileUuid: file.uuid,
          fileName: file.name,
          mimeType: file.mimeType,
        }),
      );
      created++;
    }
    return created;
  }

  /** Lit les pièces pas encore lues, par lots ; rend le nombre lu. */
  async extractPending(limit = EXTRACT_BATCH): Promise<number> {
    if (!(await this.reader.isConfigured())) {
      throw new ConflictError(
        "la lecture des pièces n'est pas configurée (Administration → Intelligence artificielle)",
      );
    }
    const pending = await this.expenses.listByStatus(
      [ExpenseStatusDTO.NEW],
      limit,
    );
    for (const expense of pending) {
      await this.readAndClassify({ expense, ctx: await this.context(expense) });
    }
    return pending.length;
  }

  /** Reclasse et rapproche toutes les pièces en cours ; rend le nombre rapproché. */
  async autoMatchAll(): Promise<number> {
    const open = await this.expenses.listByStatus([
      ExpenseStatusDTO.TO_REVIEW,
      ExpenseStatusDTO.READY,
    ]);
    const used = new Set<string>();
    let matched = 0;
    for (const expense of open) {
      const ctx = await this.context(expense);
      const before = expense.status;
      expense.refresh(ctx);
      if (expense.status !== before) await this.expenses.save(expense);
      if (await this.tryAutoMatch(expense, ctx, used)) matched++;
    }
    return matched;
  }
}
