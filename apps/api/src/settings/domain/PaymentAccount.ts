import {
  maskCardNumber,
  bookingModeFor,
  ReconciliationModeDTO,
  StatementFormatDTO,
  BookingModeDTO,
  PaymentAccountKindDTO,
  type CreatePaymentAccountDTO,
  type PaymentCardDTO,
  type UpdatePaymentAccountDTO,
} from "@repo/models";
import { ValidationError } from "@/shared/domain/errors.js";

export interface PaymentCard {
  id: string;
  last4: string;
  /** 6 premiers + 4 derniers chiffres ; le numéro entier n'est jamais gardé. */
  maskedNumber: string | null;
  label: string | null;
  holder: string | null;
  active: boolean;
}

export interface PaymentAccountProps {
  id: string;
  kind: PaymentAccountKindDTO;
  name: string;
  bexioAccountNo: string | null;
  reconciliation: ReconciliationModeDTO;
  statementFormat: StatementFormatDTO | null;
  /** Découle de `reconciliation`. */
  bookingMode: BookingModeDTO;
  /** Nom du compte dans un relevé multi-comptes (colonne « Account »). */
  revolutAccountId: string | null;
  position: number;
  active: boolean;
  cards: PaymentCard[];
}

/**
 * Rapprochement proposé à la création selon la nature du compte : une
 * banque dans bexio, Revolut par son relevé, le reste sans relevé.
 */
export function defaultReconciliation(kind: PaymentAccountKindDTO): {
  reconciliation: ReconciliationModeDTO;
  statementFormat: StatementFormatDTO | null;
} {
  if (kind === PaymentAccountKindDTO.UBS) {
    return {
      reconciliation: ReconciliationModeDTO.BEXIO,
      statementFormat: null,
    };
  }
  if (kind === PaymentAccountKindDTO.REVOLUT) {
    return {
      reconciliation: ReconciliationModeDTO.STATEMENT_IMPORT,
      statementFormat: StatementFormatDTO.REVOLUT_BUSINESS,
    };
  }
  return { reconciliation: ReconciliationModeDTO.NONE, statementFormat: null };
}

/** L'ancien champ `bookingMode` seul (sans `reconciliation`) se traduit encore. */
function reconciliationFrom(
  input: CreatePaymentAccountDTO | UpdatePaymentAccountDTO,
  fallback: ReconciliationModeDTO,
): ReconciliationModeDTO {
  if (input.reconciliation) return input.reconciliation;
  if (input.bookingMode === BookingModeDTO.BEXIO_RECONCILIATION) {
    return ReconciliationModeDTO.BEXIO;
  }
  if (
    input.bookingMode === BookingModeDTO.MANUAL_ENTRY &&
    fallback === ReconciliationModeDTO.BEXIO
  ) {
    return ReconciliationModeDTO.NONE;
  }
  return fallback;
}

function toCards(
  cards: PaymentCardDTO[] | undefined,
  newId: () => string,
): PaymentCard[] {
  return (cards ?? []).map((c) => {
    const fromNumber = c.number ? maskCardNumber(c.number) : null;
    if (c.number && (!fromNumber || fromNumber.last4 !== c.last4.trim())) {
      throw new ValidationError(
        "le numéro de carte ne finit pas par ses 4 chiffres",
      );
    }
    return {
      id: c.id ?? newId(),
      last4: c.last4.trim(),
      maskedNumber:
        fromNumber?.masked ??
        (c.maskedNumber?.trim() || maskCardNumber(c.last4)?.masked || null),
      label: c.label?.trim() || null,
      holder: c.holder?.trim() || null,
      active: c.active ?? true,
    };
  });
}

/** Cohérence : un compte importé a son format ; les autres n'en ont pas. */
function check(account: PaymentAccountProps): PaymentAccountProps {
  if (!account.name.trim()) throw new ValidationError("le nom est requis");
  const imported =
    account.reconciliation === ReconciliationModeDTO.STATEMENT_IMPORT;
  if (imported && !account.statementFormat) {
    throw new ValidationError("choisissez le format du relevé importé");
  }
  return {
    ...account,
    statementFormat: imported ? account.statementFormat : null,
    revolutAccountId: imported ? account.revolutAccountId : null,
    bookingMode: bookingModeFor(account.reconciliation),
  };
}

export function createPaymentAccount(
  id: string,
  input: CreatePaymentAccountDTO,
  newId: () => string,
): PaymentAccountProps {
  const defaults = defaultReconciliation(input.kind);
  const reconciliation = reconciliationFrom(input, defaults.reconciliation);
  return check({
    id,
    kind: input.kind,
    name: input.name.trim(),
    bexioAccountNo: input.bexioAccountNo ?? null,
    reconciliation,
    statementFormat:
      input.statementFormat ??
      (reconciliation === ReconciliationModeDTO.STATEMENT_IMPORT
        ? (defaults.statementFormat ?? StatementFormatDTO.REVOLUT_BUSINESS)
        : null),
    bookingMode: bookingModeFor(reconciliation),
    revolutAccountId: input.revolutAccountId?.trim() || null,
    position: input.position ?? 0,
    active: input.active ?? true,
    cards: toCards(input.cards, newId),
  });
}

export function patchPaymentAccount(
  current: PaymentAccountProps,
  input: UpdatePaymentAccountDTO,
  newId: () => string,
): PaymentAccountProps {
  const reconciliation = reconciliationFrom(input, current.reconciliation);
  return check({
    ...current,
    kind: input.kind ?? current.kind,
    reconciliation,
    statementFormat:
      input.statementFormat !== undefined
        ? input.statementFormat
        : (current.statementFormat ??
          (reconciliation === ReconciliationModeDTO.STATEMENT_IMPORT
            ? StatementFormatDTO.REVOLUT_BUSINESS
            : null)),
    name: input.name?.trim() ?? current.name,
    bexioAccountNo:
      input.bexioAccountNo !== undefined
        ? input.bexioAccountNo
        : current.bexioAccountNo,
    bookingMode: bookingModeFor(reconciliation),
    revolutAccountId:
      input.revolutAccountId !== undefined
        ? input.revolutAccountId?.trim() || null
        : current.revolutAccountId,
    position: input.position ?? current.position,
    active: input.active ?? current.active,
    cards: input.cards ? toCards(input.cards, newId) : current.cards,
  });
}
