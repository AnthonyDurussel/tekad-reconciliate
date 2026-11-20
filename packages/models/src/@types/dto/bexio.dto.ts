/**
 * Plan comptable et codes TVA lus dans bexio (`GET 2.0/accounts`,
 * `GET 3.0/taxes`) : les types de dépense en reprennent les comptes de
 * charge, les comptes de paiement leur compte de trésorerie ou de passif.
 */

/** `account_type` de bexio. */
export enum BexioAccountTypeDTO {
  EARNING = "EARNING",
  EXPENSE = "EXPENSE",
  ASSET = "ASSET",
  LIABILITY = "LIABILITY",
  CLOSING = "CLOSING",
  OTHER = "OTHER",
}

export interface BexioAccountDTO {
  id: number;
  accountNo: string;
  name: string;
  type: BexioAccountTypeDTO;
  /** Code TVA par défaut du compte dans bexio. */
  taxId: number | null;
  active: boolean;
}

export interface BexioTaxDTO {
  id: number;
  /** Code court bexio (« VB81 »). */
  code: string;
  /** Libellé affiché par bexio. */
  label: string;
  /** Taux en %. */
  rate: number | null;
  /** `pre_tax` (TVA préalable, achats), `sales_tax` (ventes)… */
  type: string;
  active: boolean;
}

/** `POST expense-categories/sync-bexio` */
export interface CategorySyncResultDTO {
  /** Comptes de charge actifs lus dans bexio. */
  accounts: number;
  created: number;
  updated: number;
  /** Types dont le compte n'existe plus (ou plus actif) dans bexio. */
  deactivated: number;
}
