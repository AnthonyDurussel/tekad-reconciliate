import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  TagsInput,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconCategory,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type {
  BexioAccountDTO,
  CreateExpenseCategoryDTO,
  ExpenseCategoryDTO,
} from "@repo/models";
import Page from "@/components/Page";
import PageHeader from "@/components/PageHeader/PageHeader";
import BexioAccountSelect from "@/components/bexio/BexioAccountSelect";
import BexioTaxSelect from "@/components/bexio/BexioTaxSelect";
import { EXPENSE_ACCOUNT_TYPES } from "@/components/bexio/bexioOptions";
import { useBexioStatus } from "@/components/bexio/useBexioStatus";
import {
  useCreateExpenseCategoryMutation,
  useDeleteExpenseCategoryMutation,
  useGetBexioAccountsQuery,
  useGetBexioTaxesQuery,
  useGetExpenseCategoriesQuery,
  useSyncExpenseCategoriesFromBexioMutation,
  useUpdateExpenseCategoryMutation,
} from "@/store/slices/api";
import { getErrorMessage } from "@/utils/apiError";

/** Combien de mots-clés montrer dans la liste avant « +N ». */
const SHOWN_KEYWORDS = 4;

/**
 * Les types de dépense, repris du plan comptable bexio (un par compte de
 * charge) : le compte débité, la TVA par défaut, et les règles qui les
 * reconnaissent (mots-clés du commerçant ou du ticket, codes MCC des
 * paiements par carte), propres à l'application.
 */
export default function ExpenseCategoriesPage() {
  const { t } = useTranslation();
  const { data: categories = [] } = useGetExpenseCategoriesQuery();
  const [remove] = useDeleteExpenseCategoryMutation();
  const [syncFromBexio, { isLoading: syncing }] =
    useSyncExpenseCategoriesFromBexioMutation();
  const bexio = useBexioStatus();
  const [editing, setEditing] = useState<ExpenseCategoryDTO | null | undefined>(
    undefined,
  );

  const confirmDelete = (category: ExpenseCategoryDTO) =>
    modals.openConfirmModal({
      title: t("admin.categories.deleteTitle"),
      children: (
        <Text size="sm">
          {t("admin.categories.deleteConfirm", { label: category.label })}
        </Text>
      ),
      labels: { confirm: t("common.delete"), cancel: t("common.cancel") },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await remove(category.id).unwrap();
        } catch (error) {
          notifications.show({ color: "red", message: getErrorMessage(error) });
        }
      },
    });

  const sync = async () => {
    try {
      const result = await syncFromBexio().unwrap();
      notifications.show({
        color: "teal",
        title: t("admin.categories.syncDone", { count: result.accounts }),
        message: t("admin.categories.syncDetail", {
          created: result.created,
          updated: result.updated,
          deactivated: result.deactivated,
        }),
        autoClose: 8000,
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: t("admin.categories.syncFailed"),
        message: getErrorMessage(error),
      });
    }
  };

  return (
    <Page maxWidth={1400}>
      <PageHeader
        icon={<IconCategory size={22} stroke={1.7} />}
        title={t("admin.categories.title")}
        subtitle={t("admin.categories.subtitle")}
        count={categories.length}
        actions={
          <Group gap="xs">
            <Button
              variant="default"
              leftSection={<IconPlus size={16} />}
              onClick={() => setEditing(null)}
            >
              {t("admin.categories.create")}
            </Button>
            <Tooltip
              label={t("bexio.notConnected")}
              disabled={bexio.connected !== false}
              multiline
              w={280}
            >
              <Button
                leftSection={<IconRefresh size={16} />}
                loading={syncing}
                disabled={!bexio.connected}
                onClick={sync}
              >
                {t("admin.categories.sync")}
              </Button>
            </Tooltip>
          </Group>
        }
      />
      <Card withBorder p={0}>
        <Table.ScrollContainer minWidth={1050}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("admin.categories.code")}</Table.Th>
                <Table.Th>{t("admin.categories.label")}</Table.Th>
                <Table.Th>{t("admin.categories.bexioAccount")}</Table.Th>
                <Table.Th>{t("admin.categories.tax")}</Table.Th>
                <Table.Th>{t("admin.categories.rules")}</Table.Th>
                <Table.Th ta="right">{t("admin.common.usage")}</Table.Th>
                <Table.Th>{t("admin.common.active")}</Table.Th>
                <Table.Th w={90} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {categories.map((c) => (
                <Table.Tr key={c.id}>
                  <Table.Td ff="monospace" fw={600}>
                    {c.code}
                  </Table.Td>
                  <Table.Td>{c.label}</Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <Text size="sm" ff="monospace">
                        {c.bexioAccountNo}
                      </Text>
                      {c.bexioAccountId != null && (
                        <Tooltip label={t("admin.categories.fromBexio")}>
                          <Badge size="xs" variant="light" color="green">
                            bexio
                          </Badge>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {c.vatRate != null ? `${c.vatRate} %` : "—"}
                      {c.bexioTaxId != null && (
                        <Text span size="xs" c="dimmed">
                          {" "}
                          ·{" "}
                          {t("admin.categories.taxIdShort", {
                            id: c.bexioTaxId,
                          })}
                        </Text>
                      )}
                    </Text>
                  </Table.Td>
                  <Table.Td maw={360}>
                    <Group gap={4}>
                      {c.keywords.slice(0, SHOWN_KEYWORDS).map((k) => (
                        <Badge key={k} size="xs" variant="light" color="grape">
                          {k}
                        </Badge>
                      ))}
                      {c.keywords.length > SHOWN_KEYWORDS && (
                        <Tooltip
                          label={c.keywords.slice(SHOWN_KEYWORDS).join(", ")}
                          multiline
                          w={280}
                        >
                          <Badge size="xs" variant="outline" color="grape">
                            +{c.keywords.length - SHOWN_KEYWORDS}
                          </Badge>
                        </Tooltip>
                      )}
                      {c.mccCodes.length > 0 && (
                        <Tooltip label={c.mccCodes.join(", ")}>
                          <Badge size="xs" variant="light" color="indigo">
                            {t("admin.categories.mccCount", {
                              count: c.mccCodes.length,
                            })}
                          </Badge>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">{c.expenseCount ?? 0}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={c.active ? "teal" : "gray"}>
                      {c.active ? t("common.yes") : t("common.no")}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <ActionIcon
                        variant="subtle"
                        color="dark"
                        onClick={() => setEditing(c)}
                        aria-label={t("common.edit")}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <Tooltip
                        label={t("admin.common.inUse")}
                        disabled={!c.expenseCount}
                      >
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          disabled={!!c.expenseCount}
                          onClick={() => confirmDelete(c)}
                          aria-label={t("common.delete")}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {categories.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Stack align="center" gap="xs" py="lg">
                      <Text c="dimmed" ta="center">
                        {t("admin.categories.empty")}
                      </Text>
                      {bexio.connected && (
                        <Button
                          size="xs"
                          leftSection={<IconRefresh size={14} />}
                          loading={syncing}
                          onClick={sync}
                        >
                          {t("admin.categories.sync")}
                        </Button>
                      )}
                    </Stack>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      <Modal
        size="lg"
        opened={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={
          editing ? t("admin.categories.edit") : t("admin.categories.create")
        }
      >
        {editing !== undefined && (
          <CategoryForm
            category={editing}
            nextPosition={categories.length}
            onClose={() => setEditing(undefined)}
          />
        )}
      </Modal>
    </Page>
  );
}

function CategoryForm({
  category,
  nextPosition,
  onClose,
}: {
  category: ExpenseCategoryDTO | null;
  nextPosition: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [create, { isLoading: creating }] = useCreateExpenseCategoryMutation();
  const [update, { isLoading: updating }] = useUpdateExpenseCategoryMutation();
  const [code, setCode] = useState(category?.code ?? "");
  const [label, setLabel] = useState(category?.label ?? "");
  const [bexioAccountNo, setBexioAccountNo] = useState(
    category?.bexioAccountNo ?? "",
  );
  const [bexioAccountId, setBexioAccountId] = useState<number | null>(
    category?.bexioAccountId ?? null,
  );
  const { data: bexioAccounts = [] } = useGetBexioAccountsQuery();
  const { data: bexioTaxes = [] } = useGetBexioTaxesQuery();
  const [bexioTaxId, setBexioTaxId] = useState<number | "">(
    category?.bexioTaxId ?? "",
  );
  const [vatRate, setVatRate] = useState<number | "">(category?.vatRate ?? "");
  const [keywords, setKeywords] = useState<string[]>(category?.keywords ?? []);
  const [mccCodes, setMccCodes] = useState<string[]>(category?.mccCodes ?? []);
  const [active, setActive] = useState(category?.active ?? true);
  const [showErrors, setShowErrors] = useState(false);

  const accountNoInvalid = !/^\d{3,6}$/.test(bexioAccountNo.trim());

  /**
   * Choisir un compte bexio reprend son numéro comme code, son nom comme
   * libellé et son code TVA — sauf ce que l'on a saisi soi-même.
   */
  const pickAccount = (accountNo: string, account: BexioAccountDTO | null) => {
    const previous = bexioAccounts.find((a) => a.accountNo === bexioAccountNo);
    const follows = (value: string, derived?: string | null) =>
      !value.trim() || (derived != null && value === derived);
    setBexioAccountNo(accountNo);
    setBexioAccountId(account?.id ?? null);
    if (!account) return;
    if (follows(code, previous?.accountNo)) setCode(account.accountNo);
    if (follows(label, previous?.name)) setLabel(account.name);
    const taxFollows =
      bexioTaxId === "" ||
      (previous?.taxId != null && bexioTaxId === previous.taxId);
    if (account.taxId != null && taxFollows) {
      setBexioTaxId(account.taxId);
      const tax = bexioTaxes.find((x) => x.id === account.taxId);
      if (tax?.rate != null) setVatRate(tax.rate);
    }
  };
  const badMcc = mccCodes.filter((m) => !/^\d{4}$/.test(m));
  const badKeywords = keywords.filter((k) => k.trim().length < 2);

  const submit = async () => {
    setShowErrors(true);
    if (
      !code.trim() ||
      !label.trim() ||
      accountNoInvalid ||
      badMcc.length ||
      badKeywords.length
    )
      return;
    const body: CreateExpenseCategoryDTO = {
      bexioAccountId:
        bexioAccountId ??
        (category && bexioAccountNo.trim() === category.bexioAccountNo
          ? category.bexioAccountId
          : null),
      code: code.trim(),
      label: label.trim(),
      bexioAccountNo: bexioAccountNo.trim(),
      bexioTaxId: bexioTaxId === "" ? null : Number(bexioTaxId),
      vatRate: vatRate === "" ? null : Number(vatRate),
      keywords: keywords.map((k) => k.trim().toLowerCase()),
      mccCodes,
      position: category?.position ?? nextPosition,
      active,
    };
    try {
      if (category) await update({ id: category.id, body }).unwrap();
      else await create(body).unwrap();
      notifications.show({ color: "teal", message: t("common.saved") });
      onClose();
    } catch (error) {
      notifications.show({ color: "red", message: getErrorMessage(error) });
    }
  };

  const required = (v: string) =>
    showErrors && !v.trim() ? t("common.required") : null;

  return (
    <Stack>
      <BexioAccountSelect
        label={t("admin.categories.bexioAccount")}
        description={t("admin.categories.bexioAccountHint")}
        types={EXPENSE_ACCOUNT_TYPES}
        value={bexioAccountNo}
        clearable={false}
        error={
          showErrors && accountNoInvalid
            ? t("admin.common.accountNoInvalid")
            : null
        }
        onChange={pickAccount}
      />
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput
          label={t("admin.categories.code")}
          description={t("admin.categories.codeHint")}
          value={code}
          error={required(code)}
          onChange={(e) => setCode(e.currentTarget.value.toUpperCase())}
        />
        <TextInput
          label={t("admin.categories.label")}
          description={t("admin.categories.labelHint")}
          value={label}
          error={required(label)}
          onChange={(e) => setLabel(e.currentTarget.value)}
        />
        <BexioTaxSelect
          label={t("admin.categories.taxId")}
          description={t("admin.categories.taxIdHint")}
          value={bexioTaxId}
          onChange={(id, tax) => {
            setBexioTaxId(id);
            if (tax?.rate != null) setVatRate(tax.rate);
          }}
        />
        <NumberInput
          label={t("admin.categories.vatRate")}
          description={t("admin.categories.vatRateHint")}
          min={0}
          max={100}
          decimalScale={2}
          suffix=" %"
          value={vatRate}
          onChange={(v) => setVatRate(v === "" ? "" : Number(v))}
        />
      </SimpleGrid>
      <TagsInput
        label={t("admin.categories.keywords")}
        description={t("admin.categories.keywordsHint")}
        value={keywords}
        onChange={setKeywords}
        clearable
        error={badKeywords.length ? t("admin.categories.keywordInvalid") : null}
      />
      <TagsInput
        label={t("admin.categories.mccCodes")}
        description={t("admin.categories.mccCodesHint")}
        value={mccCodes}
        onChange={(v) => setMccCodes(v.map((m) => m.trim()))}
        clearable
        error={
          badMcc.length
            ? t("admin.categories.mccInvalid", { codes: badMcc.join(", ") })
            : null
        }
      />
      <Switch
        label={t("admin.common.active")}
        description={t("admin.categories.activeHint")}
        checked={active}
        onChange={(e) => setActive(e.currentTarget.checked)}
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button loading={creating || updating} onClick={submit}>
          {t("common.save")}
        </Button>
      </Group>
    </Stack>
  );
}
