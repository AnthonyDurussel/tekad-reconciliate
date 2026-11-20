import { randomUUID } from "node:crypto";
import { inject, injectable } from "inversify";
import {
  BookingModeDTO,
  ExpenseIssueDTO,
  autoMatch,
  type BexioExpenseDTO,
  rankCandidates,
  ExpenseStatusDTO,
  type ExtractionDTO,
  type ReceiptDTO,
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
import {
  Expense,
  type ExpenseContext,
  type ReceiptProps,
} from "@/expense/domain/Expense.js";
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
import type { BexioExpenseUseCases } from "@/bexio-expense/application/BexioExpenseUseCases.js";
import { BEXIO_EXPENSE_TYPES } from "@/bexio-expense/infrastructure/ioc/types.bexio-expense.js";

/** Fenêtre de recherche d'une dépense bexio autour de la date (jours). */
const BEXIO_WINDOW_DAYS = 10;
/** Fenêtre de recherche d'une transaction autour de la date du ticket. */
const MATCH_WINDOW_DAYS = 6;
/** Pièces lues par passage (une lecture prend quelques secondes). */
export const EXTRACT_BATCH = 15;

type Matchable = RevolutTransactionProps & { date: string };
const matchable = (t: RevolutTransactionProps): Matchable => ({
  ...t,
  date: t.occurredAt.toISOString().slice(0, 10),
});

export const receiptDTO = (
  r: Readonly<ReceiptProps>,
  expenseId: string | null,
): ReceiptDTO => ({
  id: r.id,
  bexioFileId: r.bexioFileId,
  bexioFileUuid: r.bexioFileUuid,
  fileName: r.fileName,
  mimeType: r.mimeType,
  importedAt: r.importedAt.toISOString(),
  extractedAt: r.extractedAt?.toISOString() ?? null,
  extraction: r.extraction,
  expenseId,
});

export interface ExpenseView {
  expense: Expense;
  ctx: ExpenseContext;
}

/**
 * Les dépenses, élément central : chacune porte sa pièce (importée de
 * l'inbox bexio, lue), sa dépense bexio (lue en direct) et, pour un compte
 * rapproché par relevé, sa transaction. Une dépense naît d'une pièce, d'une
 * sortie de relevé ou d'une dépense bexio ; les autres liens se posent ensuite.
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
    @inject(BEXIO_EXPENSE_TYPES.BexioExpenseUseCases)
    private bexioExpenses: BexioExpenseUseCases,
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

  /** Les liens à faire d'une dépense (pièce, bexio, rapprochement). */
  issues({ expense, ctx }: ExpenseView): ExpenseIssueDTO[] {
    return expense.issues(ctx);
  }

  async list(
    filter: ExpenseFilter & { issue?: ExpenseIssueDTO | "ok" },
  ): Promise<ExpenseView[]> {
    const views = await this.listAll(filter);
    if (!filter.issue) return views;
    return views.filter((v) => {
      const issues = this.issues(v);
      return filter.issue === "ok"
        ? issues.length === 0
        : issues.includes(filter.issue as ExpenseIssueDTO);
    });
  }

  private async listAll(filter: ExpenseFilter): Promise<ExpenseView[]> {
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

  /** Le fichier de la pièce de la dépense. */
  async file(id: string): Promise<StoredFile> {
    const { expense } = await this.load(id);
    if (!expense.receipt) throw new NotFoundError("Receipt");
    return this.receiptFile(expense.receipt);
  }

  /** Le fichier d'une pièce (aperçu avant de la rattacher). */
  async receiptFileById(receiptId: string): Promise<StoredFile> {
    const receipt = await this.expenses.findReceipt(receiptId);
    if (!receipt) throw new NotFoundError("Receipt");
    return this.receiptFile(receipt);
  }

  private async receiptFile(receipt: {
    bexioFileId: string;
    fileName: string;
    mimeType: string | null;
  }): Promise<StoredFile> {
    const file = await this.bexio.downloadFile(receipt.bexioFileId);
    return {
      ...file,
      fileName: receipt.fileName,
      mimeType: receipt.mimeType ?? file.mimeType,
    };
  }

  async update(id: string, patch: UpdateExpenseDTO): Promise<ExpenseView> {
    const view = await this.load(id);
    view.expense.update(patch, view.ctx);
    await this.expenses.save(view.expense);
    // Montant, date ou compte corrigés : la transaction peut maintenant se trouver.
    await this.tryAutoMatch(view.expense, view.ctx, new Set());
    return this.load(id);
  }

  /** Relit la pièce (IA), reclasse, cherche sa transaction de relevé. */
  async extract(id: string): Promise<ExpenseView> {
    const view = await this.load(id);
    await this.readAndClassify(view);
    return this.load(id);
  }

  private async readAndClassify(view: ExpenseView): Promise<void> {
    const { expense, ctx } = view;
    const receipt = expense.receipt;
    if (!receipt) {
      throw new InvalidStateError("cette dépense n'a pas de pièce à lire");
    }
    let extraction: ExtractionDTO;
    try {
      const file = await this.receiptFile(receipt);
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
      log.warn(`[extraction] ${receipt.fileName}`, error);
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
          "cette transaction est déjà rapprochée d'une autre dépense",
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
      throw new InvalidStateError("seule une dépense prête se comptabilise");
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
        const receipt = expense.receipt!;
        const file = await this.receiptFile(receipt);
        entryId = await this.bexio.createManualEntry({
          date: booking.date!,
          reference: receipt.fileName,
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
    const receipt = expense.receipt;
    if (!receipt) throw new InvalidStateError("cette dépense n'a pas de pièce");
    if (receipt.bexioFileUuid) return receipt.bexioFileUuid;
    const uuid = await this.bexio.fileUuid(receipt.bexioFileId);
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

  // ---------------------------------------------------- création

  /** Une dépense pour une sortie de relevé (sa pièce viendra ensuite). */
  async createFromTransaction(transactionId: string): Promise<ExpenseView> {
    const tx = await this.transactions.findById(transactionId);
    if (!tx) throw new NotFoundError("Revolut transaction");
    if (tx.expenseId) {
      throw new ConflictError("cette transaction a déjà sa dépense");
    }
    const { accounts, categories } = await this.loadSettings();
    const expense = Expense.fromTransaction(randomUUID(), tx, {
      accounts,
      categories,
      transaction: tx,
    });
    await this.expenses.create(expense);
    await this.transactions.setExpense(tx.id, expense.id);
    return this.load(expense.id);
  }

  /**
   * Une dépense pour une dépense bexio : si l'un de ses fichiers joints est
   * la pièce d'une dépense d'ici, c'est celle-ci qu'on y rattache.
   */
  async createFromBexio(bexioExpenseId: string): Promise<ExpenseView> {
    const bexio = await this.bexioExpenses.find(bexioExpenseId);
    if (bexio.expenseId) {
      throw new ConflictError("cette dépense bexio a déjà sa dépense");
    }
    const withFile = (
      await this.expenses.findByFileUuids(bexio.attachmentIds)
    ).find((e) => !e.snapshot.bexioExpenseId && e.status !== "IGNORED");
    if (withFile) {
      withFile.linkBexioExpense(bexio.id);
      await this.expenses.save(withFile);
      return this.load(withFile.id);
    }
    const { accounts, categories } = await this.loadSettings();
    const expense = Expense.fromBexio(
      randomUUID(),
      {
        bexioExpenseId: bexio.id,
        paidOn: bexio.paidOn,
        gross: bexio.gross,
        currency: bexio.currency,
        vendor: bexio.vendor,
        title: bexio.title,
        bookingAccountNo: bexio.bookingAccountNo,
        paymentAccountId: bexio.paymentAccountId,
      },
      { accounts, categories, transaction: null },
    );
    await this.expenses.create(expense);
    const ctx = await this.context(expense);
    await this.tryAutoMatch(expense, ctx, new Set());
    return this.load(expense.id);
  }

  // ---------------------------------------------------- pièce

  /**
   * Les pièces qu'on peut rattacher : celles sans dépense et celles dont la
   * dépense n'a rien d'autre (ni transaction, ni bexio, ni comptabilisation).
   */
  async receiptCandidates(id: string): Promise<ReceiptDTO[]> {
    await this.load(id);
    const [orphans, lone] = await Promise.all([
      this.expenses.listUnlinkedReceipts(),
      this.expenses.listLoneReceiptExpenses(),
    ]);
    return [
      ...orphans.map((r) => receiptDTO(r, null)),
      ...lone
        .filter((e) => e.id !== id && e.receipt)
        .map((e) => receiptDTO(e.receipt!, e.id)),
    ];
  }

  /**
   * Rattache une pièce : une pièce seule (sa dépense n'a rien d'autre) quitte
   * sa dépense, qui disparaît. Si la dépense est déjà dans bexio, le fichier
   * y est joint.
   */
  async linkReceipt(id: string, receiptId: string): Promise<ExpenseView> {
    const view = await this.load(id);
    const receipt = await this.expenses.findReceipt(receiptId);
    if (!receipt) throw new NotFoundError("Receipt");
    if (receipt.expenseId === id) return view;
    if (receipt.expenseId) {
      const owner = await this.expenses.findById(receipt.expenseId);
      if (owner && !owner.isLoneReceipt()) {
        throw new ConflictError(
          "cette pièce appartient déjà à une autre dépense",
        );
      }
      await this.expenses.delete(receipt.expenseId);
    }
    const { expenseId: _owner, ...props } = receipt;
    view.expense.attachReceipt(props, view.ctx);
    await this.expenses.save(view.expense);
    if (view.expense.snapshot.bexioExpenseId) {
      await this.attachToBexio(
        view.expense,
        view.expense.snapshot.bexioExpenseId,
      );
    }
    await this.tryAutoMatch(view.expense, view.ctx, new Set());
    return this.load(id);
  }

  /**
   * Détache la pièce : elle retrouve une dépense à elle (chaque pièce a sa
   * dépense). Le fichier reste joint dans bexio s'il l'était.
   */
  async unlinkReceipt(id: string): Promise<ExpenseView> {
    const view = await this.load(id);
    const receipt = view.expense.detachReceipt(view.ctx);
    if (!receipt) return view;
    await this.expenses.save(view.expense);
    const own = Expense.importFromInbox({
      id: randomUUID(),
      receiptId: receipt.id,
      bexioFileId: receipt.bexioFileId,
      bexioFileUuid: receipt.bexioFileUuid,
      fileName: receipt.fileName,
      mimeType: receipt.mimeType,
      now: receipt.importedAt,
    });
    const ctx = {
      accounts: view.ctx.accounts,
      categories: view.ctx.categories,
      transaction: null,
    };
    if (receipt.extraction) {
      own.applyExtraction(
        receipt.extraction,
        ctx,
        receipt.extractedAt ?? new Date(),
      );
    }
    await this.expenses.create(own);
    return this.load(id);
  }

  // ---------------------------------------------------- dépense bexio

  /** Les dépenses bexio proches (date, montant) et libres, la plus probable d'abord. */
  async bexioCandidates(id: string): Promise<BexioExpenseDTO[]> {
    const { expense } = await this.load(id);
    const s = expense.snapshot;
    if (!s.date) return [];
    const date = dayToDate(s.date)!;
    const ms = BEXIO_WINDOW_DAYS * 86_400_000;
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const list = await this.bexioExpenses.list({
      from: day(new Date(date.getTime() - ms)),
      to: day(new Date(date.getTime() + ms)),
    });
    const uuid = expense.receipt?.bexioFileUuid ?? null;
    const amount = s.totalAmount;
    const score = (b: BexioExpenseDTO) =>
      (uuid && b.attachmentIds.includes(uuid) ? -1e9 : 0) +
      (amount !== null ? Math.abs(Math.abs(b.gross) - amount) * 100 : 0) +
      Math.abs(
        (dayToDate(b.paidOn ?? s.date)!.getTime() - date.getTime()) /
          86_400_000,
      );
    return list
      .filter((b) => !b.expenseId)
      .sort((a, b) => score(a) - score(b))
      .slice(0, 10);
  }

  /**
   * Rattache une dépense bexio existante : la pièce y est jointe si elle
   * n'y est pas, et la dépense est comptabilisée (par bexio).
   */
  async linkBexio(id: string, bexioExpenseId: string): Promise<ExpenseView> {
    const view = await this.load(id);
    const bexio = await this.bexioExpenses.find(bexioExpenseId);
    if (bexio.expenseId && bexio.expenseId !== id) {
      throw new ConflictError(
        "cette dépense bexio est rattachée à une autre dépense",
      );
    }
    view.expense.linkBexioExpense(bexio.id);
    if (view.expense.receipt) {
      await this.attachToBexio(view.expense, bexio.id, bexio.attachmentIds);
    }
    await this.expenses.save(view.expense);
    return this.load(id);
  }

  /** Défait le lien ici (rien n'est changé dans bexio). */
  async unlinkBexio(id: string): Promise<ExpenseView> {
    const view = await this.load(id);
    view.expense.unlinkBexioExpense(view.ctx);
    await this.expenses.save(view.expense);
    return this.load(id);
  }

  /** Joint le fichier de la pièce à la dépense bexio s'il n'y est pas. */
  private async attachToBexio(
    expense: Expense,
    bexioExpenseId: string,
    attachmentIds?: string[],
  ): Promise<void> {
    const uuid = await this.fileUuid(expense);
    const current =
      attachmentIds ??
      (await this.bexioExpenses.find(bexioExpenseId)).attachmentIds;
    if (!current.includes(uuid)) {
      await this.bexio.attachFilesToExpense(bexioExpenseId, [uuid]);
    }
    await this.expenses.save(expense);
  }

  // ---------------------------------------------------- synchronisations

  /**
   * Relit les dépenses bexio : rattache chaque dépense dont le fichier de la
   * pièce y est joint, détache celles dont la dépense bexio a disparu.
   * Rend le nombre de dépenses nouvellement rattachées.
   */
  async linkBexioExpenses(): Promise<number> {
    const list = await this.bexio.listExpenses();
    const ids = new Set(list.map((e) => e.id));
    const linked = await this.expenses.listLinkedToBexio();
    for (const expense of linked) {
      if (ids.has(expense.snapshot.bexioExpenseId!)) continue;
      expense.unlinkBexioExpense(await this.context(expense));
      await this.expenses.save(expense);
    }
    const taken = new Set(linked.map((e) => e.snapshot.bexioExpenseId!));
    const byUuid = new Map(
      (
        await this.expenses.findByFileUuids(
          list.flatMap((e) => e.attachmentIds),
        )
      )
        .filter((e) => !e.snapshot.bexioExpenseId && e.status !== "IGNORED")
        .map((e) => [e.receipt!.bexioFileUuid!, e]),
    );
    let count = 0;
    for (const bexio of list) {
      if (taken.has(bexio.id)) continue;
      const expense = bexio.attachmentIds
        .map((uuid) => byUuid.get(uuid))
        .find((e) => e && !e.snapshot.bexioExpenseId);
      if (!expense) continue;
      expense.linkBexioExpense(bexio.id);
      await this.expenses.save(expense);
      taken.add(bexio.id);
      count++;
    }
    return count;
  }

  // ----------------------------------------------------

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
          receiptId: randomUUID(),
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
    const pending = await this.expenses.listUnreadReceiptExpenses(limit);
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
