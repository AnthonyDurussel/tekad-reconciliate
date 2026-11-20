import {
  accountForCard,
  bookingProposal,
  categoryByRules,
  expenseStatus,
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

export interface ExpenseProps {
  id: string;
  status: ExpenseStatusDTO;
  bexioFileId: string;
  fileName: string;
  mimeType: string | null;
  importedAt: Date;

  date: string | null;
  merchant: string | null;
  description: string | null;
  totalAmount: number | null;
  currency: string | null;
  vatAmount: number | null;
  vatRate: number | null;
  cardLast4: string | null;
  paymentMethod: string | null;
  extraction: ExtractionDTO | null;
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

/**
 * Pièce de l'inbox bexio. Toute modification finit par `refresh()` : le
 * compte, le type et le statut se recalculent ; une valeur saisie (MANUAL)
 * n'est jamais remplacée par une proposition.
 */
export class Expense {
  private constructor(private props: ExpenseProps) {}

  static restore(props: ExpenseProps): Expense {
    return new Expense({ ...props, manualFields: [...props.manualFields] });
  }

  static importFromInbox(input: {
    id: string;
    bexioFileId: string;
    fileName: string;
    mimeType: string | null;
    now?: Date;
  }): Expense {
    return new Expense({
      id: input.id,
      status: ExpenseStatusDTO.NEW,
      bexioFileId: input.bexioFileId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      importedAt: input.now ?? new Date(),
      date: null,
      merchant: null,
      description: null,
      totalAmount: null,
      currency: null,
      vatAmount: null,
      vatRate: null,
      cardLast4: null,
      paymentMethod: null,
      extraction: null,
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
      bookedAt: null,
      bookedById: null,
      note: null,
      ignoreReason: null,
    });
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

  private assertEditable(): void {
    if (this.props.status === ExpenseStatusDTO.BOOKED) {
      throw new InvalidStateError(
        "pièce comptabilisée : annulez d'abord la comptabilisation",
      );
    }
  }

  /** Résultat de la lecture : remplit ce qui n'a pas été saisi à la main. */
  applyExtraction(
    extraction: ExtractionDTO,
    ctx: ExpenseContext,
    now = new Date(),
  ): void {
    this.assertEditable();
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
    for (const field of READ_FIELDS) {
      if (!this.props.manualFields.includes(field)) {
        (this.props as unknown as Record<string, unknown>)[field] =
          values[field] ?? null;
      }
    }
    this.props.extraction = extraction;
    this.props.extractedAt = now;
    this.refresh(ctx);
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
      const byAi = p.extraction?.categoryCode
        ? ctx.categories.find(
            (c) => c.active && c.code === p.extraction!.categoryCode,
          )
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
    });
  }

  markBooked(
    entryId: string | null,
    userId: string | null,
    now = new Date(),
  ): void {
    if (this.props.status !== ExpenseStatusDTO.READY) {
      throw new InvalidStateError("seule une pièce prête se comptabilise");
    }
    this.props.status = ExpenseStatusDTO.BOOKED;
    this.props.bexioEntryId = entryId;
    this.props.bookedAt = now;
    this.props.bookedById = userId;
  }

  /** Rouvre une pièce comptabilisée (l'écriture bexio reste à annuler dans bexio). */
  unbook(ctx: ExpenseContext): void {
    if (this.props.status !== ExpenseStatusDTO.BOOKED) {
      throw new InvalidStateError("cette pièce n'est pas comptabilisée");
    }
    this.props.status = ExpenseStatusDTO.TO_REVIEW;
    this.props.bexioEntryId = null;
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
      throw new InvalidStateError("cette pièce n'est pas ignorée");
    }
    this.props.status = ExpenseStatusDTO.TO_REVIEW;
    this.props.ignoreReason = null;
    this.refresh(ctx);
  }
}
