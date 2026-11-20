import { RoleDTO } from "../@types/authorization.js";
import {
  BookingModeDTO,
  PaymentAccountKindDTO,
} from "../@types/dto/settings.dto.js";
import { ExpenseStatusDTO } from "../@types/dto/expense.dto.js";

/** Libellés français pour l'API (e-mails, export Excel) ; l'écran passe par i18n. */
export const ROLE_LABELS: Record<RoleDTO, string> = {
  [RoleDTO.ADMIN]: "Administrateur·trice",
  [RoleDTO.ACCOUNTANT]: "Comptable",
  [RoleDTO.VIEWER]: "Lecture seule",
};

export const PAYMENT_ACCOUNT_KIND_LABELS: Record<PaymentAccountKindDTO, string> = {
  [PaymentAccountKindDTO.REVOLUT]: "Revolut Business",
  [PaymentAccountKindDTO.UBS]: "UBS",
  [PaymentAccountKindDTO.PERSONAL]: "Compte courant associé",
  [PaymentAccountKindDTO.OTHER]: "Autre",
};

export const BOOKING_MODE_LABELS: Record<BookingModeDTO, string> = {
  [BookingModeDTO.MANUAL_ENTRY]: "Écriture passée par l'application",
  [BookingModeDTO.BEXIO_RECONCILIATION]: "Rapprochement bancaire dans bexio",
};

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatusDTO, string> = {
  [ExpenseStatusDTO.NEW]: "À lire",
  [ExpenseStatusDTO.TO_REVIEW]: "À compléter",
  [ExpenseStatusDTO.READY]: "Prête",
  [ExpenseStatusDTO.BOOKED]: "Comptabilisée",
  [ExpenseStatusDTO.IGNORED]: "Ignorée",
};
