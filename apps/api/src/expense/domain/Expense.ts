import {
  accountForCard,
  expenseIssues,
  ExpenseIssueDTO,
  bookingProposal,
  categoryByRules,
  expenseStatus,
  ExpenseSourceDTO,
  ExpenseStatusDTO,
  ReconciliationModeDTO,
  SuggestionSourceDTO,
  type BookingProposalDTO,
  type ExtractionDTO,
  type UpdateExpenseDTO,
} from "@repo/models";
import { InvalidStateError } from "@/shared/domain/errors.js";
import type { PaymentAccountProps } from "@/settings/domain/PaymentAccount.js";
import type { ExpenseCategoryProps } from "@/settings/domain/ExpenseCategory.js";
import type { RevolutTransactionProps } from "@/revolut/domain/RevolutTransaction.js";

/** Champs lus sur la pièce : une saisie manuelle les protège des relectures. */
export const READ_FIELDS = [
  "date",
  "merchant",
  "description",
  "totalAmount",
  "currency",
  "vatAmount",
  "vatRate",
  "cardLast4",
  "paymentMethod",
] as const;
type ReadField = (typeof READ_FIELDS)[number];

/** La pièce rattachée : un fichier de l'inbox bexio et sa lecture. */
export interface ReceiptProps {
  id: string;
  bexioFileId: string;
  /** UUID du fichier bexio (les dépenses bexio joignent les fichiers par UUID). */
  bexioFileUuid: string | null;
  fileName: string;
  mimeType: string | null;
  importedAt: Date;
  extraction: ExtractionDTO | null;
  extractedAt: Date | null;
}

export interface ExpenseProps {
  id: string;
  status: ExpenseStatusDTO;
  source: ExpenseSourceDTO;
  createdAt: Date;
  /** La pièce rattachée (`null` : dépense sans pièce). */
  receipt: ReceiptProps | null;

  date: string | null;
  merchant: string | null;
  description: string | null;
  totalAmount: number | null;
  currency: string | null;
  vatAmount: number | null;
  vatRate: number | null;
  cardLast4: string | null;
  paymentMethod: string | null;
  /** Données renseignées (lecture de la pièce, transaction ou bexio). */
  extractedAt: Date | null;
  manualFields: string[];

  paymentAccountId: string | null;
  paymentAccountSource: SuggestionSourceDTO | null;
  categoryId: string | null;
  categorySource: SuggestionSourceDTO | null;

  debitAccountNo: string | null;
  creditAccountNo: string | null;
  bexioTaxId: number | null;

  transactionId: string | null;
  bexioEntryId: string | null;
  /** Dépense bexio (« Ausgabe ») créée par l'application ou liée. */
  bexioExpenseId: string | null;
  bookedAt: Date | null;
  bookedById: string | null;
  note: string | null;
  ignoreReason: string | null;
}

/** Le paramétrage et la transaction rapprochée, lus par le cas d'usage. */
export interface ExpenseContext {
  accounts: readonly PaymentAccountProps[];
  categories: readonly ExpenseCategoryProps[];
  transaction: RevolutTransactionProps | null;
}

/** Une dépense vide, à compléter par la fabrique qui l'appelle. */
function blank(id: string, source: ExpenseSourceDTO, now: Date): ExpenseProps {
  return {
    id,
    status: ExpenseStatusDTO.NEW,
    source,
    createdAt: now,
    receipt: null,
    date: null,
    merchant: null,
    description: null,
    totalAmount: null,
    currency: null,
    vatAmount: null,
    vatRate: null,
    cardLast4: null,
    paymentMethod: null,
    extractedAt: null,
    manualFields: [],
    paymentAccountId: null,
    paymentAccountSource: null,
    categoryId: null,
    categorySource: null,
    debitAccountNo: null,
    creditAccountNo: null,
    bexioTaxId: null,
    transactionId: null,
    bexioEntryId: null,
    bexioExpenseId: null,
    bookedAt: null,
    bookedById: null,
    note: null,
    ignoreReason: null,
  };
}

/** Ce qu'une dépense bexio apporte à la dépense créée pour elle. */
export interface BexioExpenseData {
  bexioExpenseId: string;
  paidOn: string | null;
  gross: number;
  currency: string;
  vendor: string | null;
  title: string | null;
  bookingAccountNo: string | null;
  paymentAccountId: string | null;
}

/**
 * La dépense : l'élément central. Elle porte sa pièce (fichier + lecture),
 * sa dépense bexio et sa transaction de relevé. Toute modification finit par
 * `refresh()` : le compte, le type et le statut se recalculent ; une valeur
 * saisie (MANUAL) n'est jamais remplacée par une proposition.
 */
export class Expense {
  private constructor(private props: ExpenseProps) {}

  static restore(props: ExpenseProps): Expense {
    return new Expense({
      ...props,
      receipt: props.receipt ? { ...props.receipt } : null,
      manualFields: [...props.manualFields],
    });
  }

  /** Une pièce arrive de l'inbox bexio : sa dépense naît avec elle. */
  static importFromInbox(input: {
    id: string;
    receiptId: string;
    bexioFileId: string;
    bexioFileUuid?: string | null;
    fileName: string;
    mimeType: string | null;
    now?: Date;
  }): Expense {
    const now = input.now ?? new Date();
    return new Expense({
      ...blank(input.id, ExpenseSourceDTO.RECEIPT, now),
      receipt: {
        id: input.receiptId,
        bexioFileId: input.bexioFileId,
        bexioFileUuid: input.bexioFileUuid ?? null,
        fileName: input.fileName,
        mimeType: input.mimeType,
        importedAt: now,
        extraction: null,
        extractedAt: null,
      },
    });
  }

  /** Une sortie de relevé sans pièce : la dépense à justifier. */
  static fromTransaction(
    id: string,
    tx: RevolutTransactionProps,
    ctx: ExpenseContext,
    now = new Date(),
  ): Expense {
    const e = new Expense({
      ...blank(id, ExpenseSourceDTO.TRANSACTION, now),
      date: tx.occurredAt.toISOString().slice(0, 10),
      merchant: tx.merchantName ?? tx.description,
      totalAmount: Math.abs(tx.billAmount ?? tx.amount),
      currency: (tx.billCurrency ?? tx.currency).toUpperCase(),
      cardLast4: tx.cardLast4,
      paymentMethod: tx.cardLast4 ? "card" : null,
      transactionId: tx.id,
      extractedAt: now,
    });
    e.refresh({ ...ctx, transaction: tx });
    return e;
  }

  /** Une dépense saisie dans bexio : déjà comptabilisée, à rattacher ici. */
  static fromBexio(
    id: string,
    data: BexioExpenseData,
    ctx: ExpenseContext,
    now = new Date(),
  ): Expense {
    const category = data.bookingAccountNo
      ? ctx.categories.find(
          (c) => c.active && c.bexioAccountNo === data.bookingAccountNo,
        )
      : undefined;
    const e = new Expense({
      ...blank(id, ExpenseSourceDTO.BEXIO, now),
      date: data.paidOn,
      merchant: data.vendor ?? data.title,
      description: data.vendor ? data.title : null,
      totalAmount: data.gross,
      currency: data.currency.toUpperCase(),
      extractedAt: now,
      paymentAccountId: data.paymentAccountId,
      paymentAccountSource: data.paymentAccountId
        ? SuggestionSourceDTO.MANUAL
        : null,
      categoryId: category?.id ?? null,
      categorySource: category ? SuggestionSourceDTO.MANUAL : null,
      debitAccountNo: category ? null : data.bookingAccountNo,
      manualFields: ["date", "merchant", "totalAmount", "currency"],
    });
    e.refresh(ctx);
    e.props.status = ExpenseStatusDTO.BOOKED;
    e.props.bexioExpenseId = data.bexioExpenseId;
    e.props.bookedAt = now;
    return e;
  }

  get snapshot(): Readonly<ExpenseProps> {
    return this.props;
  }
  get id() {
    return this.props.id;
  }
  get status() {
    return this.props.status;
  }
  get transactionId() {
    return this.props.transactionId;
  }
  get extracted(): boolean {
    return this.props.extractedAt !== null;
  }
  get receipt(): Readonly<ReceiptProps> | null {
    return this.props.receipt;
  }
  get extraction(): ExtractionDTO | null {
    return this.props.receipt?.extraction ?? null;
  }

  private assertEditable(): void {
    if (this.props.status === ExpenseStatusDTO.BOOKED) {
      throw new InvalidStateError(
        "dépense comptabilisée : annulez d'abord la comptabilisation",
      );
    }
  }

  /**
   * Résultat de la lecture de la pièce : remplit ce qui n'a pas été saisi à
   * la main. Une dépense déjà renseignée par sa transaction ou par bexio ne
   * prend que les champs encore vides.
   */
  applyExtraction(
    extraction: ExtractionDTO,
    ctx: ExpenseContext,
    now = new Date(),
    onlyEmpty = this.props.source !== ExpenseSourceDTO.RECEIPT,
  ): void {
    if (!this.props.receipt) {
      throw new InvalidStateError("cette dépense n'a pas de pièce à lire");
    }
    this.props.receipt.extraction = extraction;
    this.props.receipt.extractedAt = now;
    if (this.props.status === ExpenseStatusDTO.BOOKED) return;
    const values: Record<ReadField, unknown> = {
      date: extraction.date,
      merchant: extraction.merchant,
      description: extraction.description,
      totalAmount: extraction.totalAmount,
      currency: extraction.currency,
      vatAmount: extraction.vatAmount,
      vatRate: extraction.vatRate,
      cardLast4: extraction.cardLast4,
      paymentMethod: extraction.paymentMethod,
    };
    const p = this.props as unknown as Record<string, unknown>;
    for (const field of READ_FIELDS) {
      if (this.props.manualFields.includes(field)) continue;
      if (!onlyEmpty) p[field] = values[field] ?? null;
      else if (p[field] === null) p[field] = values[field] ?? null;
    }
    this.props.extractedAt ??= now;
    this.refresh(ctx);
  }

  /** Rattache une pièce (sans dépense) ; sa lecture complète les champs vides. */
  attachReceipt(receipt: ReceiptProps, ctx: ExpenseContext): void {
    if (this.props.receipt) {
      throw new InvalidStateError("cette dépense a déjà sa pièce");
    }
    this.props.receipt = { ...receipt };
    if (receipt.extraction && this.props.status !== ExpenseStatusDTO.BOOKED) {
      // Les champs déjà renseignés restent ; la pièce complète les autres.
      this.applyExtraction(
        receipt.extraction,
        ctx,
        receipt.extractedAt ?? new Date(),
        this.extracted,
      );
    } else {
      this.refresh(ctx);
    }
  }

  /** Détache la pièce (elle redevient une pièce sans dépense). */
  detachReceipt(ctx: ExpenseContext): ReceiptProps | null {
    const receipt = this.props.receipt;
    this.props.receipt = null;
    this.refresh(ctx);
    return receipt;
  }

  /** Corrections : chaque champ fourni devient une saisie manuelle. */
  update(patch: UpdateExpenseDTO, ctx: ExpenseContext): void {
    this.assertEditable();
    const p = this.props as unknown as Record<string, unknown>;
    for (const field of READ_FIELDS) {
      if (patch[field] !== undefined) {
        p[field] = patch[field];
        if (!this.props.manualFields.includes(field)) {
          this.props.manualFields.push(field);
        }
      }
    }
    if (patch.paymentAccountId !== undefined) {
      this.props.paymentAccountId = patch.paymentAccountId;
      this.props.paymentAccountSource = patch.paymentAccountId
        ? SuggestionSourceDTO.MANUAL
        : null;
    }
    if (patch.categoryId !== undefined) {
      this.props.categoryId = patch.categoryId;
      this.props.categorySource = patch.categoryId
        ? SuggestionSourceDTO.MANUAL
        : null;
    }
    if (patch.debitAccountNo !== undefined)
      this.props.debitAccountNo = patch.debitAccountNo;
    if (patch.creditAccountNo !== undefined)
      this.props.creditAccountNo = patch.creditAccountNo;
    if (patch.bexioTaxId !== undefined)
      this.props.bexioTaxId = patch.bexioTaxId;
    if (patch.note !== undefined) this.props.note = patch.note;
    // Une pièce saisie à la main sans lecture compte comme lue.
    if (
      !this.props.extractedAt &&
      READ_FIELDS.some((f) => patch[f] !== undefined)
    ) {
      this.props.extractedAt = new Date();
    }
    this.refresh(ctx);
  }

  /** Rapproche (ou détache, `null`) une transaction Revolut. */
  attachTransaction(
    transaction: RevolutTransactionProps | null,
    ctx: ExpenseContext,
  ): void {
    this.assertEditable();
    this.props.transactionId = transaction?.id ?? null;
    this.refresh({ ...ctx, transaction });
  }

  /**
   * Recalcule les propositions et le statut :
   * - compte : carte du ticket → compte de la transaction rapprochée ;
   * - type : mots-clés / MCC → proposition de la lecture.
   */
  refresh(ctx: ExpenseContext): void {
    const p = this.props;
    if (p.paymentAccountSource !== SuggestionSourceDTO.MANUAL) {
      const byCard = accountForCard(p.cardLast4, ctx.accounts);
      const byTx = ctx.transaction?.paymentAccountId ?? null;
      if (byCard) {
        p.paymentAccountId = byCard.id;
        p.paymentAccountSource = SuggestionSourceDTO.CARD;
      } else if (byTx) {
        p.paymentAccountId = byTx;
        p.paymentAccountSource = SuggestionSourceDTO.TRANSACTION;
      } else {
        p.paymentAccountId = null;
        p.paymentAccountSource = null;
      }
    }
    if (p.categorySource !== SuggestionSourceDTO.MANUAL) {
      const byRule = categoryByRules(
        {
          merchant: p.merchant ?? ctx.transaction?.merchantName,
          description: p.description,
          mcc: ctx.transaction?.mcc,
        },
        ctx.categories,
      );
      const aiCode = this.extraction?.categoryCode;
      const byAi = aiCode
        ? ctx.categories.find((c) => c.active && c.code === aiCode)
        : undefined;
      if (byRule) {
        p.categoryId = byRule.id;
        p.categorySource = SuggestionSourceDTO.RULE;
      } else if (byAi) {
        p.categoryId = byAi.id;
        p.categorySource = SuggestionSourceDTO.AI;
      } else {
        p.categoryId = null;
        p.categorySource = null;
      }
    }
    p.status = expenseStatus({
      status: p.status,
      extracted: this.extracted,
      date: p.date,
      totalAmount: p.totalAmount,
      paymentAccount: this.account(ctx),
      hasCategory: !!p.categoryId,
      transactionId: p.transactionId,
      hasReceipt: !!p.receipt,
    });
  }

  account(ctx: Pick<ExpenseContext, "accounts">): PaymentAccountProps | null {
    return (
      ctx.accounts.find((a) => a.id === this.props.paymentAccountId) ?? null
    );
  }

  category(
    ctx: Pick<ExpenseContext, "categories">,
  ): ExpenseCategoryProps | null {
    return ctx.categories.find((c) => c.id === this.props.categoryId) ?? null;
  }

  /** Une pièce d'un compte importé, ou de compte inconnu, cherche sa transaction. */
  canMatchRevolut(ctx: Pick<ExpenseContext, "accounts">): boolean {
    const account = this.account(ctx);
    return (
      !this.props.transactionId &&
      this.props.status !== ExpenseStatusDTO.BOOKED &&
      this.props.status !== ExpenseStatusDTO.IGNORED &&
      (!account ||
        account.reconciliation === ReconciliationModeDTO.STATEMENT_IMPORT)
    );
  }

  booking(ctx: ExpenseContext): BookingProposalDTO {
    const p = this.props;
    const tx = ctx.transaction;
    return bookingProposal({
      date: p.date,
      merchant: p.merchant,
      description: p.description,
      totalAmount: p.totalAmount,
      currency: p.currency,
      transactionAmountChf:
        tx && tx.currency.toUpperCase() === "CHF" ? tx.amount : null,
      paymentAccount: this.account(ctx),
      category: this.category(ctx),
      debitAccountNo: p.debitAccountNo,
      creditAccountNo: p.creditAccountNo,
      bexioTaxId: p.bexioTaxId,
      transactionId: p.transactionId,
      hasReceipt: !!p.receipt,
    });
  }

  markBooked(
    entryId: string | null,
    userId: string | null,
    now = new Date(),
    bexioExpenseId: string | null = null,
  ): void {
    if (this.props.status !== ExpenseStatusDTO.READY) {
      throw new InvalidStateError("seule une dépense prête se comptabilise");
    }
    this.props.status = ExpenseStatusDTO.BOOKED;
    this.props.bexioEntryId = entryId;
    this.props.bexioExpenseId = bexioExpenseId;
    this.props.bookedAt = now;
    this.props.bookedById = userId;
  }

  /** Les liens qui manquent : pièce, dépense bexio, rapprochement. */
  issues(ctx: Pick<ExpenseContext, "accounts">): ExpenseIssueDTO[] {
    return expenseIssues({
      status: this.props.status,
      hasReceipt: !!this.props.receipt,
      bexioExpenseId: this.props.bexioExpenseId,
      bexioEntryId: this.props.bexioEntryId,
      reconciliation: this.account(ctx)?.reconciliation ?? null,
      transactionId: this.props.transactionId,
    });
  }

  /**
   * Une dépense qui n'est que sa pièce (née de l'inbox, sans transaction,
   * sans bexio, non comptabilisée) : sa pièce peut passer à une autre dépense.
   */
  isLoneReceipt(): boolean {
    const p = this.props;
    return (
      p.source === ExpenseSourceDTO.RECEIPT &&
      !!p.receipt &&
      !p.transactionId &&
      !p.bexioExpenseId &&
      !p.bexioEntryId &&
      p.status !== ExpenseStatusDTO.BOOKED
    );
  }

  setFileUuid(uuid: string): void {
    if (this.props.receipt) this.props.receipt.bexioFileUuid = uuid;
  }

  /**
   * La pièce est celle d'une dépense saisie dans bexio : elle y est
   * comptabilisée, quel que soit son état ici (sauf ignorée).
   */
  linkBexioExpense(bexioExpenseId: string, now = new Date()): void {
    if (this.props.status === ExpenseStatusDTO.IGNORED) {
      throw new InvalidStateError("dépense ignorée : restaurez-la d'abord");
    }
    if (
      this.props.bexioExpenseId &&
      this.props.bexioExpenseId !== bexioExpenseId
    ) {
      throw new InvalidStateError(
        "cette dépense est déjà rattachée à une autre dépense bexio",
      );
    }
    this.props.bexioExpenseId = bexioExpenseId;
    if (this.props.status !== ExpenseStatusDTO.BOOKED) {
      this.props.status = ExpenseStatusDTO.BOOKED;
      this.props.bookedAt = now;
    }
  }

  /** La dépense bexio liée a disparu de bexio : la pièce n'y est plus. */
  unlinkBexioExpense(ctx: ExpenseContext): void {
    if (!this.props.bexioExpenseId) return;
    this.props.bexioExpenseId = null;
    if (
      this.props.status === ExpenseStatusDTO.BOOKED &&
      !this.props.bexioEntryId
    ) {
      this.props.status = ExpenseStatusDTO.TO_REVIEW;
      this.props.bookedAt = null;
      this.props.bookedById = null;
      this.refresh(ctx);
    }
  }

  /** Rouvre une pièce comptabilisée (l'écriture bexio reste à annuler dans bexio). */
  unbook(ctx: ExpenseContext): void {
    if (this.props.status !== ExpenseStatusDTO.BOOKED) {
      throw new InvalidStateError("cette dépense n'est pas comptabilisée");
    }
    this.props.status = ExpenseStatusDTO.TO_REVIEW;
    this.props.bexioEntryId = null;
    this.props.bexioExpenseId = null;
    this.props.bookedAt = null;
    this.props.bookedById = null;
    this.refresh(ctx);
  }

  ignore(reason: string | null): void {
    this.assertEditable();
    this.props.status = ExpenseStatusDTO.IGNORED;
    this.props.ignoreReason = reason?.trim() || null;
  }

  restoreFromIgnored(ctx: ExpenseContext): void {
    if (this.props.status !== ExpenseStatusDTO.IGNORED) {
      throw new InvalidStateError("cette dépense n'est pas ignorée");
    }
    this.props.status = ExpenseStatusDTO.TO_REVIEW;
    this.props.ignoreReason = null;
    this.refresh(ctx);
  }
}
