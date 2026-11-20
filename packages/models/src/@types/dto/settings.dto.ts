/**
 * Paramétrage : les comptes qui paient (Revolut, UBS, compte courant
 * d'Anthony), leurs cartes — reconnues sur les tickets par leurs 4 derniers
 * chiffres — et les types de dépense avec leur imputation bexio.
 */

/**
 * Nature du compte, pour l'affichage et les valeurs proposées à la création
 * (le comportement dépend de `ReconciliationModeDTO`, pas de la nature).
 */
export enum PaymentAccountKindDTO {
  REVOLUT = "REVOLUT",
  /** Banque (UBS, PostFinance…). */
  UBS = "UBS",
  /** Compte courant de l'associé (carte privée, espèces) : dette envers Anthony. */
  PERSONAL = "PERSONAL",
  OTHER = "OTHER",
}

/**
 * Comment les sorties du compte sont rapprochées de leurs pièces.
 */
export enum ReconciliationModeDTO {
  /**
   * Dans bexio (rapprochement bancaire, ex. UBS) : l'application propose
   * l'imputation ; l'écriture naît du rapprochement dans bexio.
   */
  BEXIO = "BEXIO",
  /**
   * Par l'import d'un relevé CSV (ex. Revolut) : chaque sortie doit trouver
   * sa pièce ici, les sorties sans pièce sont à demander ; l'application
   * passe l'écriture dans bexio.
   */
  STATEMENT_IMPORT = "STATEMENT_IMPORT",
  /**
   * Aucun relevé (ex. compte courant de l'associé, espèces) : la pièce seule
   * suffit, l'application passe l'écriture.
   */
  NONE = "NONE",
}

/** Format du relevé CSV d'un compte rapproché par import. */
export enum StatementFormatDTO {
  /** Revolut Business → Transactions → Relevé → CSV. */
  REVOLUT_BUSINESS = "REVOLUT_BUSINESS",
  /** Application Revolut (compte personnel) → Relevé → CSV. */
  REVOLUT_PERSONAL = "REVOLUT_PERSONAL",
}

/** Le mode d'écriture qui découle du rapprochement. */
export function bookingModeFor(mode: ReconciliationModeDTO): BookingModeDTO {
  return mode === ReconciliationModeDTO.BEXIO
    ? BookingModeDTO.BEXIO_RECONCILIATION
    : BookingModeDTO.MANUAL_ENTRY;
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
  /**
   * Saisie : le numéro de la carte, entier ou masqué (« 5167 6012 3456 4721 »,
   * « 516760******4721 »). Il n'est **jamais gardé** : l'API n'en retient que
   * les 4 derniers chiffres et la forme masquée.
   */
  number?: string;
  /** 4 derniers chiffres imprimés sur le ticket (`**** 1234`). */
  last4: string;
  /** Forme masquée (6 premiers et 4 derniers chiffres), pour la reconnaître. */
  maskedNumber?: string | null;
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
  /** Rapprochement des sorties : dans bexio, par import de relevé, ou aucun. */
  reconciliation: ReconciliationModeDTO;
  /** Format du relevé importé (import seulement). */
  statementFormat: StatementFormatDTO | null;
  /** Découle de `reconciliation` (BEXIO → BEXIO_RECONCILIATION, sinon MANUAL_ENTRY). */
  bookingMode: BookingModeDTO;
  /**
   * Nom du compte dans le relevé (colonne « Account » de Revolut Business,
   * ex. « CHF Main ») quand un relevé couvre plusieurs comptes ; import seulement.
   */
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
  reconciliation?: ReconciliationModeDTO;
  statementFormat?: StatementFormatDTO | null;
  /** Ignoré : découle de `reconciliation` (gardé pour compatibilité). */
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
  /** Le compte de charge bexio dont le type est repris (`null` : saisi à la main). */
  bexioAccountId: number | null;
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
  bexioAccountId?: number | null;
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
