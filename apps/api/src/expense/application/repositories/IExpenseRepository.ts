import type { ExpenseStatusDTO } from "@repo/models";
import type { Expense, ReceiptProps } from "@/expense/domain/Expense.js";

export interface ExpenseFilter {
  from?: Date;
  /** Exclu. */
  to?: Date;
  /** `none` : sans compte. */
  paymentAccountId?: string;
  categoryId?: string;
  status?: ExpenseStatusDTO;
  search?: string;
}

export interface IExpenseRepository {
  list(filter: ExpenseFilter): Promise<Expense[]>;
  findById(id: string): Promise<Expense | null>;
  /** Fichiers bexio déjà importés (comme pièces) parmi ceux donnés. */
  existingFileIds(fileIds: string[]): Promise<Set<string>>;
  /** Renseigne l'UUID bexio des pièces importées avant qu'on le garde. */
  setMissingFileUuids(uuids: Map<string, string>): Promise<void>;
  /** Les dépenses dont la pièce a l'un de ces UUID de fichier. */
  findByFileUuids(uuids: string[]): Promise<Expense[]>;
  findByBexioExpenseIds(ids: string[]): Promise<Expense[]>;
  findByTransactionId(transactionId: string): Promise<Expense | null>;
  listByStatus(
    statuses: ExpenseStatusDTO[],
    limit?: number,
  ): Promise<Expense[]>;
  /** Crée la dépense (et sa pièce, si elle est nouvelle). */
  create(expense: Expense): Promise<void>;
  /** Enregistre la dépense et sa pièce rattachée. */
  save(expense: Expense): Promise<void>;

  delete(id: string): Promise<void>;
  /** Les dépenses rattachées à une dépense bexio. */
  listLinkedToBexio(): Promise<Expense[]>;
  /** Les dépenses qui ne sont qu'une pièce (`Expense.isLoneReceipt`). */
  listLoneReceiptExpenses(): Promise<Expense[]>;

  /** Pièces sans dépense (détachées), les plus récentes d'abord. */
  listUnlinkedReceipts(): Promise<ReceiptProps[]>;
  findReceipt(
    id: string,
  ): Promise<(ReceiptProps & { expenseId: string | null }) | null>;
  /** Les pièces non lues (dépense comprise), les plus anciennes d'abord. */
  listUnreadReceiptExpenses(limit: number): Promise<Expense[]>;
}
