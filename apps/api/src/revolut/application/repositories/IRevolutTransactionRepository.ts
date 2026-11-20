import type {
  RevolutTransactionImport,
  RevolutTransactionProps,
} from "@/revolut/domain/RevolutTransaction.js";

export interface RevolutTransactionFilter {
  from?: Date;
  /** Exclu. */
  to?: Date;
  filter?: "all" | "missing" | "matched" | "ignored";
  search?: string;
}

export interface IRevolutTransactionRepository {
  list(filter: RevolutTransactionFilter): Promise<RevolutTransactionProps[]>;
  findById(id: string): Promise<RevolutTransactionProps | null>;
  findByExpense(expenseId: string): Promise<RevolutTransactionProps | null>;
  findByIds(ids: string[]): Promise<RevolutTransactionProps[]>;
  /**
   * Insère ou met à jour (état, montants, compte de paiement…) sans toucher
   * au rapprochement ni à la dispense.
   */
  upsertMany(
    rows: (RevolutTransactionImport & { paymentAccountId: string | null })[],
  ): Promise<{ created: number; updated: number }>;
  /** Transactions libres (sans pièce, non ignorées, à justifier) d'une période. */
  listUnmatched(from: Date, to: Date): Promise<RevolutTransactionProps[]>;
  setExpense(id: string, expenseId: string | null): Promise<void>;
  /** Détache la transaction rapprochée d'une pièce, s'il y en a une. */
  clearExpense(expenseId: string): Promise<void>;
  setIgnored(
    id: string,
    ignored: boolean,
    reason: string | null,
  ): Promise<void>;
  /** La transaction la plus récente importée. */
  latestOccurredAt(): Promise<Date | null>;
}
