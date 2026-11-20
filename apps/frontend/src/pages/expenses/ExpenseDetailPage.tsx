import { useState } from "react";
import {
  Alert,
  Button,
  Grid,
  Group,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconArrowBackUp,
  IconBan,
  IconCircleCheck,
  IconInfoCircle,
  IconReceipt,
  IconRestore,
  IconScan,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  BookingModeDTO,
  ExpenseStatusDTO,
  PaymentAccountKindDTO,
  PermissionDTO,
  type ExpenseDTO,
} from "@repo/models";
import Page from "@/components/Page";
import PageHeader from "@/components/PageHeader/PageHeader";
import ExpenseStatusBadge from "@/components/expense/ExpenseStatusBadge";
import IgnoreModal from "@/components/expense/IgnoreModal";
import usePermissions from "@/hooks/usePermissions";
import {
  useBookExpenseMutation,
  useExtractExpenseMutation,
  useGetExpenseCategoriesQuery,
  useGetExpenseQuery,
  useGetPaymentAccountsQuery,
  useIgnoreExpenseMutation,
  useRestoreExpenseMutation,
  useUnbookExpenseMutation,
} from "@/store/slices/api";
import { getErrorMessage } from "@/utils/apiError";
import { formatAmount, formatDate, formatDateTime } from "@/utils/format";
import ReceiptPreview from "./detail/ReceiptPreview";
import ExpenseForm from "./detail/ExpenseForm";
import BookingCard from "./detail/BookingCard";
import RevolutCard from "./detail/RevolutCard";

/** Ce que le formulaire affiche : s'il change côté serveur, il repart de là. */
const formVersion = (e: ExpenseDTO) =>
  JSON.stringify([
    e.id,
    e.extractedAt,
    e.date,
    e.merchant,
    e.description,
    e.totalAmount,
    e.currency,
    e.vatAmount,
    e.vatRate,
    e.cardLast4,
    e.paymentAccountId,
    e.categoryId,
    e.debitAccountNo,
    e.creditAccountNo,
    e.bexioTaxId,
    e.note,
    e.status,
  ]);

/**
 * Une pièce : le fichier à gauche ; à droite ses champs (corrigeables), son
 * imputation bexio, son rapprochement Revolut et les actions — relire,
 * comptabiliser, ignorer.
 */
export default function ExpenseDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const back = () =>
    navigate(
      `/expenses${(location.state as { back?: string } | null)?.back ?? ""}`,
    );
  const { can } = usePermissions();
  const canManage = can(PermissionDTO.EXPENSE_MANAGE);
  const canBook = can(PermissionDTO.EXPENSE_BOOK);
  const { data: expense, error, isLoading } = useGetExpenseQuery(id);
  const { data: accounts = [] } = useGetPaymentAccountsQuery();
  const { data: categories = [] } = useGetExpenseCategoriesQuery();
  const [extract, { isLoading: extracting }] = useExtractExpenseMutation();
  const [book, { isLoading: booking }] = useBookExpenseMutation();
  const [unbook, { isLoading: unbooking }] = useUnbookExpenseMutation();
  const [ignore, { isLoading: ignoring }] = useIgnoreExpenseMutation();
  const [restore, { isLoading: restoring }] = useRestoreExpenseMutation();
  const [ignoreOpen, setIgnoreOpen] = useState(false);

  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      notifications.show({ color: "teal", message: done });
    } catch (e) {
      notifications.show({ color: "red", message: getErrorMessage(e) });
    }
  };

  if (!expense) {
    return (
      <Page maxWidth={1500}>
        <PageHeader
          icon={<IconReceipt size={22} stroke={1.7} />}
          title={t("expenseDetail.title")}
          onBack={back}
          backLabel={t("expenseDetail.back")}
        />
        {isLoading ? (
          <Text c="dimmed">{t("common.loading")}</Text>
        ) : (
          <Alert color="red" icon={<IconInfoCircle size={18} />}>
            {error ? getErrorMessage(error) : t("expenseDetail.notFound")}
          </Alert>
        )}
      </Page>
    );
  }

  const status = expense.status;
  const booked = status === ExpenseStatusDTO.BOOKED;
  const ignored = status === ExpenseStatusDTO.IGNORED;
  const account = accounts.find((a) => a.id === expense.paymentAccountId);
  const showRevolut =
    !!expense.transactionId ||
    !account ||
    account.kind === PaymentAccountKindDTO.REVOLUT;
  const reconciliationMode =
    expense.booking.mode === BookingModeDTO.BEXIO_RECONCILIATION;

  const confirmUnbook = () =>
    modals.openConfirmModal({
      title: t("expenseDetail.unbookTitle"),
      children: (
        <Text size="sm">
          {expense.bexioEntryId
            ? t("expenseDetail.unbookConfirmEntry", {
                id: expense.bexioEntryId,
              })
            : t("expenseDetail.unbookConfirm")}
        </Text>
      ),
      labels: {
        confirm: t("expenseDetail.unbook"),
        cancel: t("common.cancel"),
      },
      confirmProps: { color: "red" },
      onConfirm: () =>
        run(() => unbook(expense.id).unwrap(), t("expenseDetail.unbookedDone")),
    });

  const actions = (
    <>
      {canManage && !booked && !ignored && (
        <Button
          variant="default"
          leftSection={<IconScan size={16} />}
          loading={extracting}
          onClick={() =>
            run(
              () => extract(expense.id).unwrap(),
              t("expenseDetail.extractedDone"),
            )
          }
        >
          {t("expenseDetail.extract")}
        </Button>
      )}
      {canManage && !booked && !ignored && (
        <Button
          variant="default"
          leftSection={<IconBan size={16} />}
          onClick={() => setIgnoreOpen(true)}
        >
          {t("expenseDetail.ignore")}
        </Button>
      )}
      {canManage && ignored && (
        <Button
          variant="default"
          leftSection={<IconRestore size={16} />}
          loading={restoring}
          onClick={() =>
            run(
              () => restore(expense.id).unwrap(),
              t("expenseDetail.restoredDone"),
            )
          }
        >
          {t("expenseDetail.restore")}
        </Button>
      )}
      {canBook && booked && (
        <Button
          variant="default"
          color="red"
          leftSection={<IconArrowBackUp size={16} />}
          loading={unbooking}
          onClick={confirmUnbook}
        >
          {t("expenseDetail.unbook")}
        </Button>
      )}
      {canBook && !booked && !ignored && (
        <Tooltip
          label={t("expenseDetail.bookDisabled")}
          disabled={status === ExpenseStatusDTO.READY}
        >
          <Button
            leftSection={<IconCircleCheck size={16} />}
            disabled={status !== ExpenseStatusDTO.READY}
            loading={booking}
            onClick={() =>
              run(
                () => book(expense.id).unwrap(),
                reconciliationMode
                  ? t("expenseDetail.markedBookedDone")
                  : t("expenseDetail.bookedDone"),
              )
            }
          >
            {reconciliationMode
              ? t("expenseDetail.markBooked")
              : t("expenseDetail.book")}
          </Button>
        </Tooltip>
      )}
    </>
  );

  return (
    <Page maxWidth={1600}>
      <PageHeader
        icon={<IconReceipt size={22} stroke={1.7} />}
        title={expense.merchant ?? expense.fileName}
        subtitle={[
          formatDate(expense.date),
          formatAmount(expense.totalAmount, expense.currency),
          t("expenseDetail.imported", {
            date: formatDateTime(expense.importedAt),
          }),
        ].join(" · ")}
        badge={<ExpenseStatusBadge status={status} size="lg" />}
        onBack={back}
        backLabel={t("expenseDetail.back")}
        actions={actions}
      />
      {ignored && (
        <Alert color="gray" mb="md" icon={<IconBan size={18} />}>
          {t("expenseDetail.ignoredHint")}
        </Alert>
      )}
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <ReceiptPreview expense={expense} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Stack gap="lg">
            <ExpenseForm
              key={formVersion(expense)}
              expense={expense}
              accounts={accounts}
              categories={categories}
              readOnly={!canManage || booked}
            />
            <BookingCard expense={expense} />
            {showRevolut && (
              <RevolutCard expense={expense} canManage={canManage} />
            )}
            {!expense.extractedAt && (
              <Group gap="xs">
                <IconInfoCircle size={16} />
                <Text size="sm" c="dimmed">
                  {t("expenseDetail.notExtracted")}
                </Text>
              </Group>
            )}
          </Stack>
        </Grid.Col>
      </Grid>
      <IgnoreModal
        opened={ignoreOpen}
        title={t("expenseDetail.ignoreTitle")}
        description={t("expenseDetail.ignoreHint")}
        suggestions={[
          t("expenseDetail.ignoreReasons.duplicate"),
          t("expenseDetail.ignoreReasons.private"),
          t("expenseDetail.ignoreReasons.notExpense"),
        ]}
        loading={ignoring}
        onClose={() => setIgnoreOpen(false)}
        onConfirm={async (reason) => {
          await run(
            () => ignore({ id: expense.id, body: { reason } }).unwrap(),
            t("expenseDetail.ignoredDone"),
          );
          setIgnoreOpen(false);
        }}
      />
    </Page>
  );
}
