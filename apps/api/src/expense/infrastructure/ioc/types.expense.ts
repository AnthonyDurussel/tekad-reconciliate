export const EXPENSE_TYPES = {
  IExpenseRepository: Symbol.for("Expense.IExpenseRepository"),
  ExpenseUseCases: Symbol.for("Expense.ExpenseUseCases"),
  ExpenseController: Symbol.for("Expense.ExpenseController"),
} as const;
