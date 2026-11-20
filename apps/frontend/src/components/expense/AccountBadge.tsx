import { Badge } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { PaymentAccountDTO } from "@repo/models";
import { ACCOUNT_KIND_COLOR } from "./colors";

/** Le compte de paiement d'une pièce ; sans compte : « Non classé ». */
export default function AccountBadge({
  accountId,
  name,
  accounts,
}: {
  accountId: string | null;
  name?: string | null;
  accounts: PaymentAccountDTO[];
}) {
  const { t } = useTranslation();
  if (!accountId) {
    return (
      <Badge variant="outline" color="orange" size="sm">
        {t("expenses.unclassified")}
      </Badge>
    );
  }
  const account = accounts.find((a) => a.id === accountId);
  return (
    <Badge
      variant="light"
      size="sm"
      color={account ? ACCOUNT_KIND_COLOR[account.kind] : "gray"}
    >
      {account?.name ?? name ?? "—"}
    </Badge>
  );
}
