import { Badge, Tooltip } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { ExpenseSourceDTO } from "@repo/models";

const COLOR: Record<ExpenseSourceDTO, string> = {
  [ExpenseSourceDTO.RECEIPT]: "gray",
  [ExpenseSourceDTO.TRANSACTION]: "indigo",
  [ExpenseSourceDTO.BEXIO]: "cyan",
};

/** D'où vient une dépense : une pièce, une sortie du relevé, bexio. */
export default function ExpenseOriginBadge({
  source,
  size = "xs",
}: {
  source: ExpenseSourceDTO;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const { t } = useTranslation();
  return (
    <Tooltip label={t(`enum.expenseSourceHint.${source}`)} multiline w={240}>
      <Badge size={size} variant="light" color={COLOR[source]}>
        {t(`enum.expenseSource.${source}`)}
      </Badge>
    </Tooltip>
  );
}
