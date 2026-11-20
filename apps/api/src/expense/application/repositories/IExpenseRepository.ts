import type { ExpenseStatusDTO } from "@repo/models";
import type { Expense } from "@/expense/domain/Expense.js";

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
  /** Identifiants bexio déjà importés parmi ceux donnés. */
  existingFileIds(fileIds: string[]): Promise<Set<string>>;
  /** Renseigne l'UUID bexio des pièces importées avant qu'on le garde. */
  setMissingFileUuids(uuids: Map<string, string>): Promise<void>;
  findByFileUuids(uuids: string[]): Promise<Expense[]>;
  findByBexioExpenseIds(ids: string[]): Promise<Expense[]>;
  listByStatus(
    statuses: ExpenseStatusDTO[],
    limit?: number,
  ): Promise<Expense[]>;
  create(expense: Expense): Promise<void>;
  save(expense: Expense): Promise<void>;
}
