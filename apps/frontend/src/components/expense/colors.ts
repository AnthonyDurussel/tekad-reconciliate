import { ExpenseStatusDTO, PaymentAccountKindDTO } from "@repo/models";

/** Une teinte par genre de compte, la même partout (badges, graphiques). */
export const ACCOUNT_KIND_COLOR: Record<PaymentAccountKindDTO, string> = {
  [PaymentAccountKindDTO.REVOLUT]: "indigo",
  [PaymentAccountKindDTO.UBS]: "red",
  [PaymentAccountKindDTO.PERSONAL]: "grape",
  [PaymentAccountKindDTO.OTHER]: "gray",
};

export const EXPENSE_STATUS_COLOR: Record<ExpenseStatusDTO, string> = {
  [ExpenseStatusDTO.NEW]: "gray",
  [ExpenseStatusDTO.TO_REVIEW]: "orange",
  [ExpenseStatusDTO.READY]: "blue",
  [ExpenseStatusDTO.BOOKED]: "teal",
  [ExpenseStatusDTO.IGNORED]: "dark",
};
