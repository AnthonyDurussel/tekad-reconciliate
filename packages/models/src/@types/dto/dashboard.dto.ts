import type { ExpenseStatusDTO } from "./expense.dto.js";

export interface AmountByKeyDTO {
  key: string | null;
  label: string;
  count: number;
  amountChf: number;
}

/** `GET dashboard?from&to` */
export interface DashboardDTO {
  from: string;
  to: string;
  byStatus: Record<ExpenseStatusDTO, number>;
  byAccount: AmountByKeyDTO[];
  byCategory: AmountByKeyDTO[];
  /** Dépenses de la période à qui il manque une pièce, bexio ou un rapprochement. */
  issues: { missingReceipt: number; notInBexio: number; notReconciled: number };
  /** Sorties Revolut de la période sans pièce ni dispense. */
  missingReceipts: { count: number; amountChf: number };
  totalChf: number;
}
