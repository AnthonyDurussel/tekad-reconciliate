import { useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Grid,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowBackUp,
  IconFileInvoice,
  IconInfoCircle,
  IconLink,
  IconLinkOff,
  IconPaperclip,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  BexioExpenseIssueDTO,
  PermissionDTO,
  ReconciliationModeDTO,
  type BexioExpenseDetailDTO,
  type ExpenseDTO,
  type PaymentAccountDTO,
} from "@repo/models";
import Page from "@/components/Page";
import PageHeader from "@/components/PageHeader/PageHeader";
import ExpenseStatusBadge from "@/components/expense/ExpenseStatusBadge";
import usePermissions from "@/hooks/usePermissions";
import {
  bexioExpenseFileUrl,
  expenseFileUrl,
  useGetBexioExpenseQuery,
  useGetExpenseQuery,
  useGetPaymentAccountsQuery,
  useSetBexioExpensePaymentAccountMutation,
} from "@/store/slices/api";
import { getErrorMessage } from "@/utils/apiError";
import { formatAmount, formatDate, formatDateTime } from "@/utils/format";
import { lastThreeMonths } from "@/utils/period";
import BexioExpensePreview from "./BexioExpensePreview";
import LinkReceiptModal from "./LinkReceiptModal";
import {
  paymentSourceKey,
  previewFiles,
  reconciliationState,
  type ReconciliationState,
} from "./bexioExpenseDetail";
import useConfirmUnlink from "./useConfirmUnlink";

const RECONCILIATION_COLOR: Record<ReconciliationModeDTO, string> = {
  [ReconciliationModeDTO.BEXIO]: "blue",
  [ReconciliationModeDTO.STATEMENT_IMPORT]: "grape",
  [ReconciliationModeDTO.NONE]: "gray",
};

const STATE_COLOR: Record<ReconciliationState, string> = {
  inBexio: "teal",
  byStatement: "teal",
  toReconcileInBexio: "orange",
  toReconcileByStatement: "orange",
  linkReceiptFirst: "orange",
  unknownAccount: "orange",
  notRequired: "gray",
};

/**
 * Une dépense bexio : sa pièce à gauche (fichiers joints dans bexio, sinon la
 * pièce liée) ; à droite la dépense, son compte payeur (modifiable), sa
 * pièce et son rapprochement.
 */
export default function BexioExpenseDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const back = () =>
    navigate(
      `/bexio-expenses${(location.state as { back?: string } | null)?.back ?? ""}`,
    );
  const { can } = usePermissions();
  const canManage = can(PermissionDTO.EXPENSE_MANAGE);
  const { data: detail, error, isLoading } = useGetBexioExpenseQuery(id);
  const { data: accounts = [] } = useGetPaymentAccountsQuery();
  const { data: linked } = useGetExpenseQuery(detail?.expenseId ?? "", {
    skip: !detail?.expenseId,
  });
  const [linking, setLinking] = useState(false);
  const confirmUnlink = useConfirmUnlink();
  const fallbackPeriod = useMemo(() => lastThreeMonths(), []);

  const files = useMemo(
    () =>
      detail
        ? previewFiles(
            detail,
            { attachment: bexioExpenseFileUrl, expense: expenseFileUrl },
            linked && linked.id === detail.expenseId ? linked : null,
          )
        : [],
    [detail, linked],
  );

  if (!detail) {
    return (
      <Page maxWidth={1500}>
        <PageHeader
          icon={<IconFileInvoice size={22} stroke={1.7} />}
          title={t("bexioExpenseDetail.title")}
          onBack={back}
          backLabel={t("bexioExpenseDetail.back")}
        />
        {isLoading ? (
          <Text c="dimmed">{t("common.loading")}</Text>
        ) : (
          <Alert color="red" icon={<IconInfoCircle size={18} />}>
            {error ? getErrorMessage(error) : t("bexioExpenseDetail.notFound")}
          </Alert>
        )}
      </Page>
    );
  }

  const draft = detail.status === "DRAFT";

  return (
    <Page maxWidth={1600}>
      <PageHeader
        icon={<IconFileInvoice size={22} stroke={1.7} />}
        title={detail.vendor ?? detail.title ?? detail.documentNo}
        subtitle={[
          detail.documentNo,
          formatDate(detail.paidOn),
          formatAmount(detail.gross, detail.currency),
        ].join(" · ")}
        badge={
          <Group gap={6}>
            {draft && (
              <Badge size="lg" variant="outline" color="gray">
                {t("bexioExpenses.draft")}
              </Badge>
            )}
            {detail.issues.length === 0 ? (
              <Badge size="lg" variant="light" color="teal">
                {t("bexioExpenses.ok")}
              </Badge>
            ) : (
              detail.issues
                .filter((code) => code !== BexioExpenseIssueDTO.DRAFT)
                .map((code) => (
                  <Badge key={code} size="lg" variant="light" color="red">
                    {t(`bexioExpenses.issue.${code}`)}
                  </Badge>
                ))
            )}
          </Group>
        }
        onBack={back}
        backLabel={t("bexioExpenseDetail.back")}
      />
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <BexioExpensePreview
            // Une autre dépense : premier fichier.
            key={detail.id}
            files={files}
            canLink={canManage}
            onLink={() => setLinking(true)}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Stack gap="lg">
            <ExpenseCard detail={detail} />
            <PaymentAccountCard
              key={`${detail.paymentAccountId}:${detail.paymentAccountSource}`}
              detail={detail}
              accounts={accounts}
              canManage={canManage}
            />
            <ReceiptCard
              detail={detail}
              linked={linked && linked.id === detail.expenseId ? linked : null}
              canManage={canManage}
              onLink={() => setLinking(true)}
              onUnlink={() => confirmUnlink(detail)}
            />
            <ReconciliationCard detail={detail} />
          </Stack>
        </Grid.Col>
      </Grid>
      <LinkReceiptModal
        bexioExpense={linking ? detail : null}
        period={fallbackPeriod}
        onClose={() => setLinking(false)}
      />
    </Page>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <div style={{ fontSize: "var(--mantine-font-size-sm)" }}>{children}</div>
    </div>
  );
}

function CardTitle({ children }: { children: ReactNode }) {
  return (
    <Title order={4} mb="sm">
      {children}
    </Title>
  );
}

function ExpenseCard({ detail }: { detail: BexioExpenseDetailDTO }) {
  const { t } = useTranslation();
  return (
    <Card withBorder>
      <CardTitle>{t("bexioExpenseDetail.expense.title")}</CardTitle>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="sm">
        <Field label={t("bexioExpenses.paidOn")}>
          {formatDate(detail.paidOn)}
        </Field>
        <Field label={t("bexioExpenseDetail.expense.documentNo")}>
          <Text size="sm" ff="monospace">
            {detail.documentNo}
          </Text>
        </Field>
        <Field label={t("bexioExpenseDetail.expense.vendor")}>
          {detail.vendor ?? "—"}
        </Field>
        <Field label={t("bexioExpenseDetail.expense.titleField")}>
          {detail.title ?? "—"}
        </Field>
        <Field label={t("bexioExpenses.bookingAccount")}>
          {detail.bookingAccountNo ? (
            <>
              <Text span size="sm" ff="monospace">
                {detail.bookingAccountNo}
              </Text>{" "}
              {detail.bookingAccountName}
            </>
          ) : (
            "—"
          )}
        </Field>
        <Field label={t("expenses.amount")}>
          <Text size="sm" fw={600}>
            {formatAmount(detail.gross, detail.currency)}
          </Text>
        </Field>
        <Field label={t("bexioExpenseDetail.expense.status")}>
          {detail.status === "DRAFT"
            ? t("bexioExpenses.draft")
            : t("bexioExpenseDetail.expense.done")}
        </Field>
        <Field label={t("bexioExpenseDetail.expense.syncedAt")}>
          {formatDateTime(detail.syncedAt)}
        </Field>
      </SimpleGrid>
    </Card>
  );
}

function PaymentAccountCard({
  detail,
  accounts,
  canManage,
}: {
  detail: BexioExpenseDetailDTO;
  accounts: PaymentAccountDTO[];
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const [save, { isLoading: saving }] =
    useSetBexioExpensePaymentAccountMutation();
  const [selected, setSelected] = useState<string | null>(
    detail.paymentAccountId,
  );
  const [applyToBank, setApplyToBank] = useState(false);
  const source = paymentSourceKey(detail);
  const hasBank = detail.bankAccountId !== null;
  const bankOwner = hasBank
    ? accounts.find((a) => a.bexioBankAccountId === detail.bankAccountId)
    : undefined;
  const options = accounts
    .filter((a) => a.active || a.id === detail.paymentAccountId)
    .map((a) => ({ value: a.id, label: a.name }));
  const unchanged = selected === detail.paymentAccountId && !applyToBank;

  const submit = async (paymentAccountId: string | null) => {
    try {
      await save({
        id: detail.id,
        body: {
          paymentAccountId,
          ...(paymentAccountId && applyToBank && hasBank
            ? { applyToBankAccount: true }
            : {}),
        },
      }).unwrap();
      notifications.show({ color: "teal", message: t("common.saved") });
    } catch (e) {
      notifications.show({ color: "red", message: getErrorMessage(e) });
    }
  };

  return (
    <Card withBorder>
      <CardTitle>{t("bexioExpenseDetail.account.title")}</CardTitle>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" verticalSpacing="sm">
        <Field label={t("bexioExpenseDetail.account.bank")}>
          {hasBank ? (
            <>
              {detail.bankAccountNo && (
                <Text span size="sm" ff="monospace">
                  {detail.bankAccountNo}
                </Text>
              )}{" "}
              <Text span size="xs" c="dimmed">
                {t("bexioExpenseDetail.account.bankId", {
                  id: detail.bankAccountId,
                })}
              </Text>
              {bankOwner && (
                <Text size="xs" c="dimmed">
                  {t("bexioExpenseDetail.account.bankOwner", {
                    name: bankOwner.name,
                  })}
                </Text>
              )}
            </>
          ) : (
            <Text size="sm" c="dimmed">
              {t("bexioExpenseDetail.account.noBank")}
            </Text>
          )}
        </Field>
        <Field label={t("bexioExpenses.paymentAccount")}>
          {detail.paymentAccountId ? (
            <Stack gap={2} align="flex-start">
              <Text size="sm" fw={600}>
                {detail.paymentAccountName}
              </Text>
              {detail.reconciliation && (
                <Badge
                  size="xs"
                  variant="light"
                  color={RECONCILIATION_COLOR[detail.reconciliation]}
                >
                  {t(`enum.reconciliationMode.${detail.reconciliation}`)}
                </Badge>
              )}
            </Stack>
          ) : (
            <Badge size="sm" variant="light" color="orange">
              {t("bexioExpenses.toAssociate")}
            </Badge>
          )}
          <Text size="xs" c="dimmed" mt={2}>
            {t(`bexioExpenseDetail.account.source.${source}`)}
          </Text>
        </Field>
      </SimpleGrid>
      {canManage && (
        <Stack gap="sm" mt="md">
          <Select
            label={t("bexioExpenseDetail.account.choose")}
            placeholder={t("bexioExpenseDetail.account.choosePlaceholder")}
            data={options}
            value={selected}
            onChange={setSelected}
            maw={360}
          />
          <Checkbox
            label={t("bexioExpenseDetail.account.applyToBank")}
            description={
              hasBank
                ? t("bexioExpenseDetail.account.applyToBankHint", {
                    id: detail.bankAccountId,
                  })
                : t("bexioExpenseDetail.account.applyToBankDisabled")
            }
            checked={applyToBank && hasBank}
            disabled={!hasBank}
            onChange={(e) => setApplyToBank(e.currentTarget.checked)}
          />
          <Group gap="sm">
            <Button
              loading={saving}
              disabled={!selected || unchanged}
              onClick={() => submit(selected)}
            >
              {t("common.save")}
            </Button>
            {source === "MANUAL" && (
              <Button
                variant="default"
                leftSection={<IconArrowBackUp size={16} />}
                loading={saving}
                onClick={() => submit(null)}
              >
                {t("bexioExpenseDetail.account.automatic")}
              </Button>
            )}
          </Group>
        </Stack>
      )}
    </Card>
  );
}

function ReceiptCard({
  detail,
  linked,
  canManage,
  onLink,
  onUnlink,
}: {
  detail: BexioExpenseDetailDTO;
  linked: ExpenseDTO | null;
  canManage: boolean;
  onLink: () => void;
  onUnlink: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card withBorder>
      <CardTitle>{t("bexioExpenses.receipt")}</CardTitle>
      <Stack gap="sm">
        {detail.expenseId ? (
          <Group gap="sm" wrap="wrap">
            <Anchor component={Link} to={`/expenses/${detail.expenseId}`}>
              {detail.expenseFileName ?? t("bexioExpenses.openReceipt")}
            </Anchor>
            {linked && <ExpenseStatusBadge status={linked.status} />}
          </Group>
        ) : (
          <Text size="sm" c="dimmed">
            {t("bexioExpenseDetail.receipt.noLinked")}
          </Text>
        )}
        <Group gap={4} wrap="nowrap">
          <IconPaperclip size={14} />
          <Text size="sm" c={detail.attachmentCount > 0 ? undefined : "dimmed"}>
            {detail.attachmentCount > 0
              ? t("bexioExpenses.attached", { count: detail.attachmentCount })
              : t("bexioExpenseDetail.receipt.noAttachment")}
          </Text>
        </Group>
        {canManage && (
          <Group gap="sm">
            {detail.expenseId ? (
              <Button
                variant="default"
                color="red"
                leftSection={<IconLinkOff size={16} />}
                onClick={onUnlink}
              >
                {t("bexioExpenses.unlink.action")}
              </Button>
            ) : (
              <Button leftSection={<IconLink size={16} />} onClick={onLink}>
                {t("bexioExpenses.link.action")}
              </Button>
            )}
          </Group>
        )}
      </Stack>
    </Card>
  );
}

function ReconciliationCard({ detail }: { detail: BexioExpenseDetailDTO }) {
  const { t } = useTranslation();
  const state = reconciliationState(detail);
  return (
    <Card withBorder>
      <CardTitle>{t("bexioExpenses.reconciliation")}</CardTitle>
      <Stack gap="sm">
        <Group gap="sm">
          <Badge variant="light" color={STATE_COLOR[state]}>
            {t(`bexioExpenseDetail.reconciliation.state.${state}`)}
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          {t(`bexioExpenseDetail.reconciliation.hint.${state}`)}
        </Text>
        {state === "toReconcileByStatement" && detail.expenseId && (
          <Anchor component={Link} to={`/expenses/${detail.expenseId}`}>
            {t("bexioExpenseDetail.reconciliation.pickTransaction")}
          </Anchor>
        )}
        {detail.issues.length > 0 && (
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              {t("bexioExpenses.issues")}
            </Text>
            <Group gap={6}>
              {detail.issues.map((code) => (
                <Badge
                  key={code}
                  size="sm"
                  variant="light"
                  color={code === BexioExpenseIssueDTO.DRAFT ? "gray" : "red"}
                >
                  {t(`bexioExpenses.issue.${code}`)}
                </Badge>
              ))}
            </Group>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
