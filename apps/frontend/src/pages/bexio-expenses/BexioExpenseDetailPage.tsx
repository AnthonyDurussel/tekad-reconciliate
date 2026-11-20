import { useMemo, type ReactNode } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  IconExternalLink,
  IconFileInvoice,
  IconInfoCircle,
  IconPlus,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  PermissionDTO,
  type BexioExpenseDetailDTO,
  type ExpenseDTO,
} from "@repo/models";
import Page from "@/components/Page";
import PageHeader from "@/components/PageHeader/PageHeader";
import ExpenseLinkIcons from "@/components/expense/ExpenseLinkIcons";
import ExpenseStatusBadge from "@/components/expense/ExpenseStatusBadge";
import usePermissions from "@/hooks/usePermissions";
import useCreateExpense from "@/hooks/useCreateExpense";
import {
  bexioExpenseFileUrl,
  expenseFileUrl,
  useGetBexioExpenseQuery,
  useGetExpenseQuery,
} from "@/store/slices/api";
import { getErrorMessage, isConflict } from "@/utils/apiError";
import { formatAmount, formatDate } from "@/utils/format";
import { expenseLabel } from "@/pages/expenses/expenseLinks";
import BexioExpensePreview from "./BexioExpensePreview";
import { previewFiles } from "./bexioExpenseDetail";
import { STATE_COLOR, reconciliationState } from "./bexioExpenses";

/**
 * Une dépense bexio, lue en direct : ses fichiers joints à gauche ; à droite
 * la dépense, son rapprochement et la dépense de l'application rattachée
 * (ou « Créer la dépense »).
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
  const { data: linked } = useGetExpenseQuery(detail?.expenseId ?? "", {
    skip: !detail?.expenseId,
  });
  const linkedExpense =
    linked && detail && linked.id === detail.expenseId ? linked : null;

  const files = useMemo(
    () =>
      detail
        ? previewFiles(
            detail,
            { attachment: bexioExpenseFileUrl, expense: expenseFileUrl },
            linkedExpense,
          )
        : [],
    [detail, linkedExpense],
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
            {error && isConflict(error)
              ? t("bexioExpenses.notConfiguredShort")
              : error
                ? getErrorMessage(error)
                : t("bexioExpenseDetail.notFound")}
          </Alert>
        )}
      </Page>
    );
  }

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
            {detail.status === "DRAFT" && (
              <Badge size="lg" variant="outline" color="gray">
                {t("bexioExpenses.draft")}
              </Badge>
            )}
            <Badge
              size="lg"
              variant="light"
              color={detail.expenseId ? "teal" : "orange"}
            >
              {detail.expenseId
                ? t("bexioExpenses.linked")
                : t("bexioExpenses.unlinked")}
            </Badge>
          </Group>
        }
        onBack={back}
        backLabel={t("bexioExpenseDetail.back")}
      />
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, lg: 5 }}>
          {/* Une autre dépense : premier fichier. */}
          <BexioExpensePreview key={detail.id} files={files} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Stack gap="lg">
            <LinkedExpenseCard
              detail={detail}
              linked={linkedExpense}
              canManage={canManage}
            />
            <ExpenseCard detail={detail} />
          </Stack>
        </Grid.Col>
      </Grid>
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
  const state = reconciliationState(detail);
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
        <Field label={t("bexioExpenseDetail.expense.bank")}>
          {detail.bankAccountNo ? (
            <>
              <Text span size="sm" ff="monospace">
                {detail.bankAccountNo}
              </Text>{" "}
              {detail.bankAccountName}
            </>
          ) : (
            "—"
          )}
        </Field>
        <Field label={t("bexioExpenseDetail.expense.paymentAccount")}>
          {detail.paymentAccountName ?? (
            <Text span size="sm" c="dimmed">
              {t("bexioExpenseDetail.expense.noPaymentAccount")}
            </Text>
          )}
        </Field>
        <Field label={t("bexioExpenseDetail.expense.status")}>
          {detail.status === "DRAFT"
            ? t("bexioExpenses.draft")
            : t("bexioExpenseDetail.expense.done")}
        </Field>
        <Field label={t("bexioExpenses.reconciliation")}>
          <Stack gap={2} align="flex-start">
            <Badge size="sm" variant="light" color={STATE_COLOR[state]}>
              {t(`bexioExpenses.reconciliationState.${state}`)}
            </Badge>
            <Text size="xs" c="dimmed">
              {t(`bexioExpenseDetail.reconciliationHint.${state}`)}
            </Text>
          </Stack>
        </Field>
      </SimpleGrid>
    </Card>
  );
}

function LinkedExpenseCard({
  detail,
  linked,
  canManage,
}: {
  detail: BexioExpenseDetailDTO;
  linked: ExpenseDTO | null;
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const create = useCreateExpense();
  return (
    <Card withBorder>
      <CardTitle>{t("bexioExpenseDetail.linked.title")}</CardTitle>
      {detail.expenseId ? (
        <Stack gap="sm">
          {linked ? (
            <Group gap="sm" wrap="wrap" justify="space-between">
              <Stack gap={2}>
                <Text fw={600}>
                  {expenseLabel(linked) ?? t("expenseDetail.title")}
                </Text>
                <Text size="sm" c="dimmed">
                  {[
                    formatDate(linked.date),
                    formatAmount(linked.totalAmount, linked.currency),
                    linked.paymentAccountName,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </Stack>
              <Group gap="sm">
                <ExpenseStatusBadge status={linked.status} />
                <ExpenseLinkIcons expense={linked} />
              </Group>
            </Group>
          ) : (
            <Text size="sm" c="dimmed">
              {t("common.loading")}
            </Text>
          )}
          <Group>
            <Button
              component={Link}
              to={`/expenses/${detail.expenseId}`}
              variant="default"
              size="xs"
              leftSection={<IconExternalLink size={14} />}
            >
              {t("bexioExpenses.openExpense")}
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            {t("bexioExpenseDetail.linked.none")}
          </Text>
          {canManage && (
            <Group>
              <Button
                leftSection={<IconPlus size={16} />}
                loading={create.pendingBexioId === detail.id}
                onClick={() => create.fromBexio(detail.id)}
              >
                {t("bexioExpenses.create")}
              </Button>
            </Group>
          )}
          <Anchor component={Link} to="/expenses" size="xs" c="dimmed">
            {t("bexioExpenseDetail.linked.orLink")}
          </Anchor>
        </Stack>
      )}
    </Card>
  );
}
