import { Badge, type BadgeProps } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { ExpenseStatusDTO } from "@repo/models";
import { EXPENSE_STATUS_COLOR } from "./colors";

export default function ExpenseStatusBadge({
  status,
  size,
}: {
  status: ExpenseStatusDTO;
  size?: BadgeProps["size"];
}) {
  const { t } = useTranslation();
  return (
    <Badge variant="light" color={EXPENSE_STATUS_COLOR[status]} size={size}>
      {t(`enum.expenseStatus.${status}`)}
    </Badge>
  );
}
