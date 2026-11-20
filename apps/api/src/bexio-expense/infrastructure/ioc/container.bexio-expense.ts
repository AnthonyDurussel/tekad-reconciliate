import type { ContainerModuleLoadOptions } from "inversify";
import { BEXIO_EXPENSE_TYPES } from "./types.bexio-expense.js";
import { PrismaBexioExpenseRepository } from "@/bexio-expense/infrastructure/PrismaBexioExpenseRepository.js";
import { BexioExpenseUseCases } from "@/bexio-expense/application/BexioExpenseUseCases.js";
import { BexioExpenseController } from "@/bexio-expense/infrastructure/BexioExpenseController.js";

export function configureBexioExpenseContainer(
  c: ContainerModuleLoadOptions,
): void {
  c.bind(BEXIO_EXPENSE_TYPES.IBexioExpenseRepository)
    .to(PrismaBexioExpenseRepository)
    .inSingletonScope();
  c.bind(BEXIO_EXPENSE_TYPES.BexioExpenseUseCases)
    .to(BexioExpenseUseCases)
    .inSingletonScope();
  c.bind(BEXIO_EXPENSE_TYPES.BexioExpenseController)
    .to(BexioExpenseController)
    .inSingletonScope();
}
