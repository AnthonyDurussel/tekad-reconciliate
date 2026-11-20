import {
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
  label: string | null;
  holder: string | null;
  active: boolean;
}

export interface PaymentAccountProps {
  id: string;
  kind: PaymentAccountKindDTO;
  name: string;
  bexioAccountNo: string | null;
  bookingMode: BookingModeDTO;
  revolutAccountId: string | null;
  position: number;
  active: boolean;
  cards: PaymentCard[];
}

/** UBS se rapproche dans bexio ; les autres comptes passent par l'application. */
export function defaultBookingMode(
  kind: PaymentAccountKindDTO,
): BookingModeDTO {
  return kind === PaymentAccountKindDTO.UBS
    ? BookingModeDTO.BEXIO_RECONCILIATION
    : BookingModeDTO.MANUAL_ENTRY;
}

function toCards(
  cards: PaymentCardDTO[] | undefined,
  newId: () => string,
): PaymentCard[] {
  return (cards ?? []).map((c) => ({
    id: c.id ?? newId(),
    last4: c.last4.trim(),
    label: c.label?.trim() || null,
    holder: c.holder?.trim() || null,
    active: c.active ?? true,
  }));
}

function check(account: PaymentAccountProps): PaymentAccountProps {
  if (!account.name.trim()) throw new ValidationError("le nom est requis");
  if (
    account.revolutAccountId &&
    account.kind !== PaymentAccountKindDTO.REVOLUT
  ) {
    throw new ValidationError(
      "seul un compte Revolut porte un identifiant de compte Revolut",
    );
  }
  return account;
}

export function createPaymentAccount(
  id: string,
  input: CreatePaymentAccountDTO,
  newId: () => string,
): PaymentAccountProps {
  return check({
    id,
    kind: input.kind,
    name: input.name.trim(),
    bexioAccountNo: input.bexioAccountNo ?? null,
    bookingMode: input.bookingMode ?? defaultBookingMode(input.kind),
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
  return check({
    ...current,
    kind: input.kind ?? current.kind,
    name: input.name?.trim() ?? current.name,
    bexioAccountNo:
      input.bexioAccountNo !== undefined
        ? input.bexioAccountNo
        : current.bexioAccountNo,
    bookingMode: input.bookingMode ?? current.bookingMode,
    revolutAccountId:
      input.revolutAccountId !== undefined
        ? input.revolutAccountId?.trim() || null
        : current.revolutAccountId,
    position: input.position ?? current.position,
    active: input.active ?? current.active,
    cards: input.cards ? toCards(input.cards, newId) : current.cards,
  });
}
