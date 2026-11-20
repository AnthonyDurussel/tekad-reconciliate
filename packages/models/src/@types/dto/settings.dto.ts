/**
 * Paramétrage : les comptes qui paient (Revolut, UBS, compte courant
 * d'Anthony), leurs cartes — reconnues sur les tickets par leurs 4 derniers
 * chiffres — et les types de dépense avec leur imputation bexio.
 */

export enum PaymentAccountKindDTO {
  /** Revolut Business : rapproché ici, transaction par transaction. */
  REVOLUT = "REVOLUT",
  /** UBS : le rapprochement bancaire se fait dans bexio. */
  UBS = "UBS",
  /** Compte courant de l'associé (carte privée, espèces) : dette envers Anthony. */
  PERSONAL = "PERSONAL",
  OTHER = "OTHER",
}

/** Comment une pièce prête finit dans bexio. */
export enum BookingModeDTO {
  /** L'application passe l'écriture manuelle dans bexio, pièce jointe. */
  MANUAL_ENTRY = "MANUAL_ENTRY",
  /**
   * L'écriture naît du rapprochement bancaire dans bexio (UBS) :
   * l'application propose l'imputation, puis on marque la pièce comptabilisée.
   */
  BEXIO_RECONCILIATION = "BEXIO_RECONCILIATION",
}

export interface PaymentCardDTO {
  id?: string;
  /** 4 derniers chiffres imprimés sur le ticket (`**** 1234`). */
  last4: string;
  label?: string | null;
  holder?: string | null;
  active?: boolean;
}

export interface PaymentAccountDTO {
  id: string;
  kind: PaymentAccountKindDTO;
  name: string;
  /** Compte du plan comptable bexio crédité (ex. 1021 Revolut, 2210 CC Anthony). */
  bexioAccountNo: string | null;
  bookingMode: BookingModeDTO;
  /** Compte Revolut (`account_id` des transactions) ; Revolut seulement. */
  revolutAccountId: string | null;
  position: number;
  active: boolean;
  cards: PaymentCardDTO[];
  /** Pièces rattachées (une utilisée ne se supprime pas). */
  expenseCount?: number;
}

export interface CreatePaymentAccountDTO {
  kind: PaymentAccountKindDTO;
  name: string;
  bexioAccountNo?: string | null;
  bookingMode?: BookingModeDTO;
  revolutAccountId?: string | null;
  position?: number;
  active?: boolean;
  /** Remplace toutes les cartes du compte. */
  cards?: PaymentCardDTO[];
}

export type UpdatePaymentAccountDTO = Partial<CreatePaymentAccountDTO>;

/** Type de dépense : son compte de charge et la TVA par défaut. */
export interface ExpenseCategoryDTO {
  id: string;
  code: string;
  label: string;
  /** Compte de charge débité (ex. 6570 Informatique). */
  bexioAccountNo: string;
  /** Code TVA bexio (`tax_id`) ; vide : sans TVA. */
  bexioTaxId: number | null;
  /** Taux de TVA indicatif (8.1, 2.6, 3.8, 0). */
  vatRate: number | null;
  /** Mots repérés dans le commerçant ou le texte du ticket (« swisscom », « sbb »). */
  keywords: string[];
  /** Codes MCC des transactions par carte (5812 restaurants…). */
  mccCodes: string[];
  position: number;
  active: boolean;
  expenseCount?: number;
}

export interface CreateExpenseCategoryDTO {
  code: string;
  label: string;
  bexioAccountNo: string;
  bexioTaxId?: number | null;
  vatRate?: number | null;
  keywords?: string[];
  mccCodes?: string[];
  position?: number;
  active?: boolean;
}

export type UpdateExpenseCategoryDTO = Partial<CreateExpenseCategoryDTO>;
