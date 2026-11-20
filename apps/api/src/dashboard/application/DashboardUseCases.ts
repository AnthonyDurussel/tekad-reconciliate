import { inject, injectable } from "inversify";
import type { DashboardDTO } from "@repo/models";
import { dayToDate } from "@/shared/domain/dates.js";
import type { ExpenseUseCases } from "@/expense/application/usecases/ExpenseUseCases.js";
import { EXPENSE_TYPES } from "@/expense/infrastructure/ioc/types.expense.js";
import { ExpenseMapper } from "@/expense/infrastructure/ExpenseMapper.js";
import type { RevolutUseCases } from "@/revolut/application/usecases/RevolutUseCases.js";
import { REVOLUT_TYPES } from "@/revolut/infrastructure/ioc/types.revolut.js";
import { RevolutMapper } from "@/revolut/infrastructure/RevolutMapper.js";
import { buildDashboard } from "@/dashboard/domain/buildDashboard.js";

@injectable()
export class DashboardUseCases {
  constructor(
    @inject(EXPENSE_TYPES.ExpenseUseCases) private expenses: ExpenseUseCases,
    @inject(REVOLUT_TYPES.RevolutUseCases) private revolut: RevolutUseCases,
  ) {}

  async dashboard(from: string, to: string): Promise<DashboardDTO> {
    const start = dayToDate(from)!;
    const end = new Date(dayToDate(to)!.getTime() + 86_400_000);
    const [views, missing] = await Promise.all([
      this.expenses.list({ from: start, to: end }),
      this.revolut.list({ from: start, to: end, filter: "missing" }),
    ]);
    return buildDashboard(
      from,
      to,
      views.map((v) => ExpenseMapper.toDTO(v, false)),
      missing.map(RevolutMapper.toDTO),
    );
  }
}
