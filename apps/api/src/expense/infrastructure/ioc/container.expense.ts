import type { ContainerModuleLoadOptions } from "inversify";
import { EXPENSE_TYPES } from "./types.expense.js";
import { PrismaExpenseRepository } from "@/expense/infrastructure/PrismaExpenseRepository.js";
import { ExpenseUseCases } from "@/expense/application/usecases/ExpenseUseCases.js";
import { ExpenseController } from "@/expense/infrastructure/ExpenseController.js";

export function configureExpenseContainer(c: ContainerModuleLoadOptions): void {
  c.bind(EXPENSE_TYPES.IExpenseRepository)
    .to(PrismaExpenseRepository)
    .inSingletonScope();
  c.bind(EXPENSE_TYPES.ExpenseUseCases).to(ExpenseUseCases).inSingletonScope();
  c.bind(EXPENSE_TYPES.ExpenseController)
    .to(ExpenseController)
    .inSingletonScope();
}
