import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconDeviceFloppy } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type {
  ExpenseCategoryDTO,
  ExpenseDTO,
  PaymentAccountDTO,
  UpdateExpenseDTO,
} from "@repo/models";
import SourceBadge from "@/components/expense/SourceBadge";
import BexioAccountSelect from "@/components/bexio/BexioAccountSelect";
import {
  EXPENSE_ACCOUNT_TYPES,
  PAYMENT_ACCOUNT_TYPES,
} from "@/components/bexio/bexioOptions";
import { useUpdateExpenseMutation } from "@/store/slices/api";
import { getErrorMessage } from "@/utils/apiError";
import { formatRate } from "@/components/dashboard/dashboardFormat";

type Num = number | "";

interface Values {
  date: string | null;
  merchant: string;
  description: string;
  totalAmount: Num;
  currency: string;
  vatAmount: Num;
  vatRate: Num;
  cardLast4: string;
  paymentAccountId: string | null;
  categoryId: string | null;
  debitAccountNo: string;
  creditAccountNo: string;
  bexioTaxId: Num;
  note: string;
}

const valuesOf = (e: ExpenseDTO): Values => ({
  date: e.date,
  merchant: e.merchant ?? "",
  description: e.description ?? "",
  totalAmount: e.totalAmount ?? "",
  currency: e.currency ?? "",
  vatAmount: e.vatAmount ?? "",
  vatRate: e.vatRate ?? "",
  cardLast4: e.cardLast4 ?? "",
  paymentAccountId: e.paymentAccountId,
  categoryId: e.categoryId,
  debitAccountNo: e.debitAccountNo ?? "",
  creditAccountNo: e.creditAccountNo ?? "",
  bexioTaxId: e.bexioTaxId ?? "",
  note: e.note ?? "",
});

/** La valeur envoyée à l'API : vide → `null`. */
function toBody(v: Values): Required<UpdateExpenseDTO> {
  const text = (s: string) => s.trim() || null;
  const num = (n: Num) => (n === "" ? null : Number(n));
  return {
    date: v.date,
    merchant: text(v.merchant),
    description: text(v.description),
    totalAmount: num(v.totalAmount),
    currency: text(v.currency)?.toUpperCase() ?? null,
    vatAmount: num(v.vatAmount),
    vatRate: num(v.vatRate),
    cardLast4: text(v.cardLast4),
    paymentAccountId: v.paymentAccountId,
    categoryId: v.categoryId,
    debitAccountNo: text(v.debitAccountNo),
    creditAccountNo: text(v.creditAccountNo),
    bexioTaxId: num(v.bexioTaxId),
    note: text(v.note),
  };
}

/**
 * Les champs de la pièce, corrigeables. Seuls les champs changés partent :
 * l'API les marque saisis (MANUAL), et une relecture ne les écrase plus.
 */
export default function ExpenseForm({
  expense,
  accounts,
  categories,
  readOnly,
}: {
  expense: ExpenseDTO;
  accounts: PaymentAccountDTO[];
  categories: ExpenseCategoryDTO[];
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const [initial] = useState(() => valuesOf(expense));
  const [values, setValues] = useState(initial);
  const [update, { isLoading }] = useUpdateExpenseMutation();
  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const before = toBody(initial);
  const after = toBody(values);
  const changes = Object.fromEntries(
    Object.entries(after).filter(
      ([key, value]) => before[key as keyof UpdateExpenseDTO] !== value,
    ),
  ) as UpdateExpenseDTO;
  const dirty = Object.keys(changes).length > 0;
  const cardInvalid = !!values.cardLast4 && !/^\d{4}$/.test(values.cardLast4);
  const accountNoError = (s: string) =>
    s && !/^\d{3,6}$/.test(s.trim())
      ? t("expenseDetail.accountNoInvalid")
      : null;

  const save = async () => {
    try {
      await update({ id: expense.id, body: changes }).unwrap();
      notifications.show({ color: "teal", message: t("common.saved") });
    } catch (error) {
      notifications.show({ color: "red", message: getErrorMessage(error) });
    }
  };

  const accountOptions = accounts
    .filter((a) => a.active || a.id === values.paymentAccountId)
    .map((a) => ({
      value: a.id,
      label: a.bexioAccountNo ? `${a.name} (${a.bexioAccountNo})` : a.name,
    }));
  const categoryOptions = categories
    .filter((c) => c.active || c.id === values.categoryId)
    .map((c) => ({ value: c.id, label: `${c.label} (${c.bexioAccountNo})` }));
  const { booking, extraction } = expense;

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={700}>{t("expenseDetail.fields")}</Text>
          {extraction?.confidence != null && (
            <Text size="xs" c="dimmed">
              {t("expenseDetail.confidence", {
                value: formatRate(extraction.confidence),
              })}
            </Text>
          )}
        </Group>
        {extraction?.error && (
          <Alert
            color="red"
            variant="light"
            icon={<IconAlertTriangle size={16} />}
            title={t("expenseDetail.extractionError")}
          >
            {extraction.error}
          </Alert>
        )}
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <DateInput
            label={t("expenses.date")}
            valueFormat="DD.MM.YYYY"
            value={values.date}
            onChange={(v) => set("date", v)}
            clearable
            readOnly={readOnly}
          />
          <TextInput
            label={t("expenses.merchant")}
            value={values.merchant}
            onChange={(e) => set("merchant", e.currentTarget.value)}
            readOnly={readOnly}
          />
        </SimpleGrid>
        <Textarea
          label={t("expenseDetail.description")}
          autosize
          minRows={1}
          value={values.description}
          onChange={(e) => set("description", e.currentTarget.value)}
          readOnly={readOnly}
        />
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <NumberInput
            label={t("expenses.amount")}
            decimalScale={2}
            value={values.totalAmount}
            onChange={(v) => set("totalAmount", v === "" ? "" : Number(v))}
            readOnly={readOnly}
          />
          <TextInput
            label={t("expenseDetail.currency")}
            maxLength={3}
            value={values.currency}
            onChange={(e) =>
              set("currency", e.currentTarget.value.toUpperCase())
            }
            readOnly={readOnly}
          />
          <NumberInput
            label={t("expenseDetail.vatAmount")}
            decimalScale={2}
            value={values.vatAmount}
            onChange={(v) => set("vatAmount", v === "" ? "" : Number(v))}
            readOnly={readOnly}
          />
          <NumberInput
            label={t("expenseDetail.vatRate")}
            decimalScale={2}
            min={0}
            max={100}
            suffix=" %"
            value={values.vatRate}
            onChange={(v) => set("vatRate", v === "" ? "" : Number(v))}
            readOnly={readOnly}
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label={t("expenses.card")}
            description={
              expense.paymentMethod
                ? t("expenseDetail.paymentMethod", {
                    method: expense.paymentMethod,
                  })
                : undefined
            }
            leftSection={<Text size="xs">••••</Text>}
            maxLength={4}
            value={values.cardLast4}
            error={cardInvalid ? t("expenseDetail.cardInvalid") : null}
            onChange={(e) =>
              set("cardLast4", e.currentTarget.value.replace(/\D/g, ""))
            }
            readOnly={readOnly}
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label={
              <Group gap={6} component="span">
                {t("expenses.account")}
                <SourceBadge source={expense.paymentAccountSource} />
              </Group>
            }
            placeholder={t("expenses.unclassified")}
            data={accountOptions}
            value={values.paymentAccountId}
            onChange={(v) => set("paymentAccountId", v)}
            clearable
            readOnly={readOnly}
          />
          <Select
            label={
              <Group gap={6} component="span">
                {t("expenses.category")}
                <SourceBadge source={expense.categorySource} />
              </Group>
            }
            placeholder={
              extraction?.categoryCode
                ? t("expenseDetail.aiCategory", {
                    code: extraction.categoryCode,
                  })
                : t("expenses.noCategory")
            }
            data={categoryOptions}
            value={values.categoryId}
            onChange={(v) => set("categoryId", v)}
            clearable
            searchable
            readOnly={readOnly}
          />
        </SimpleGrid>
        <Stack gap={2} mt="xs">
          <Text size="sm" fw={600}>
            {t("expenseDetail.overrides")}
          </Text>
          <Text size="xs" c="dimmed">
            {t("expenseDetail.overridesHint")}
          </Text>
        </Stack>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <BexioAccountSelect
            label={t("expenseDetail.debit")}
            types={EXPENSE_ACCOUNT_TYPES}
            placeholder={booking.debitAccountNo ?? undefined}
            value={values.debitAccountNo}
            error={accountNoError(values.debitAccountNo)}
            onChange={(accountNo) => set("debitAccountNo", accountNo)}
            readOnly={readOnly}
          />
          <BexioAccountSelect
            label={t("expenseDetail.credit")}
            types={PAYMENT_ACCOUNT_TYPES}
            placeholder={booking.creditAccountNo ?? undefined}
            value={values.creditAccountNo}
            error={accountNoError(values.creditAccountNo)}
            onChange={(accountNo) => set("creditAccountNo", accountNo)}
            readOnly={readOnly}
          />
          <NumberInput
            label={t("expenseDetail.taxId")}
            placeholder={
              booking.bexioTaxId != null
                ? String(booking.bexioTaxId)
                : undefined
            }
            min={1}
            allowDecimal={false}
            value={values.bexioTaxId}
            onChange={(v) => set("bexioTaxId", v === "" ? "" : Number(v))}
            readOnly={readOnly}
          />
        </SimpleGrid>
        <Textarea
          label={t("expenseDetail.note")}
          autosize
          minRows={2}
          value={values.note}
          onChange={(e) => set("note", e.currentTarget.value)}
          readOnly={readOnly}
        />
        {!readOnly && (
          <Group justify="flex-end">
            <Button
              variant="default"
              disabled={!dirty}
              onClick={() => setValues(initial)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              disabled={
                !dirty ||
                cardInvalid ||
                !!accountNoError(values.debitAccountNo) ||
                !!accountNoError(values.creditAccountNo)
              }
              loading={isLoading}
              onClick={save}
            >
              {t("common.save")}
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
}
