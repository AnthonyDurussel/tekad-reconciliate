import { Group, ThemeIcon, Tooltip } from "@mantine/core";
import {
  IconFileInvoice,
  IconLink,
  IconReceipt,
  type TablerIcon,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { ExpenseDTO } from "@repo/models";
import { linkStates, type LinkState } from "@/pages/expenses/expenseLinks";

const COLOR: Record<LinkState, string> = {
  ok: "teal",
  missing: "red",
  na: "gray",
};

function LinkIcon({
  icon: IconComponent,
  state,
  label,
}: {
  icon: TablerIcon;
  state: LinkState;
  label: string;
}) {
  return (
    <Tooltip label={label}>
      <ThemeIcon
        size="md"
        radius="xl"
        variant={state === "na" ? "subtle" : "light"}
        color={COLOR[state]}
        aria-label={label}
        style={state === "na" ? { opacity: 0.45 } : undefined}
      >
        <IconComponent size={15} />
      </ThemeIcon>
    </Tooltip>
  );
}

/**
 * Les trois liens d'une dépense en icônes : pièce, bexio, rapprochement avec
 * le relevé (vert : fait ; rouge : à faire ; gris : rien à faire).
 */
export default function ExpenseLinkIcons({ expense }: { expense: ExpenseDTO }) {
  const { t } = useTranslation();
  const states = linkStates(expense);
  return (
    <Group gap={4} wrap="nowrap">
      <LinkIcon
        icon={IconReceipt}
        state={states.receipt}
        label={t(`expenses.links.receipt.${states.receipt}`)}
      />
      <LinkIcon
        icon={IconFileInvoice}
        state={states.bexio}
        label={t(`expenses.links.bexio.${states.bexio}`)}
      />
      <LinkIcon
        icon={IconLink}
        state={states.reconciliation}
        label={t(`expenses.links.reconciliation.${states.reconciliation}`)}
      />
    </Group>
  );
}
