import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Paper,
  Radio,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconBuildingBank,
  IconCreditCard,
  IconEdit,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  PaymentAccountKindDTO,
  ReconciliationModeDTO,
  StatementFormatDTO,
  type CreatePaymentAccountDTO,
  type PaymentAccountDTO,
  type PaymentCardDTO,
} from "@repo/models";
import Page from "@/components/Page";
import PageHeader from "@/components/PageHeader/PageHeader";
import { ACCOUNT_KIND_COLOR } from "@/components/expense/colors";
import BexioAccountSelect from "@/components/bexio/BexioAccountSelect";
import {
  PAYMENT_ACCOUNT_TYPES,
  readCardNumber,
} from "@/components/bexio/bexioOptions";
import {
  useCreatePaymentAccountMutation,
  useDeletePaymentAccountMutation,
  useGetPaymentAccountsQuery,
  useUpdatePaymentAccountMutation,
} from "@/store/slices/api";
import { enumOptions } from "@/utils/enumOptions";
import { getErrorMessage } from "@/utils/apiError";
import { formatCard } from "@/utils/format";

/**
 * Les comptes qui paient (Revolut, UBS, compte courant d'Anthony…) : leur
 * compte bexio crédité (pris dans le plan comptable bexio), la façon dont
 * une pièce finit dans bexio, et les cartes reconnues sur les tickets par
 * leurs 4 derniers chiffres. Le numéro de carte saisi ne quitte le
 * formulaire que masqué ; l'API n'en garde que la forme masquée.
 */
export default function PaymentAccountsPage() {
  const { t } = useTranslation();
  const { data: accounts = [] } = useGetPaymentAccountsQuery();
  const [remove] = useDeletePaymentAccountMutation();
  const [editing, setEditing] = useState<PaymentAccountDTO | null | undefined>(
    undefined,
  );

  const confirmDelete = (account: PaymentAccountDTO) =>
    modals.openConfirmModal({
      title: t("admin.accounts.deleteTitle"),
      children: (
        <Text size="sm">
          {t("admin.accounts.deleteConfirm", { name: account.name })}
        </Text>
      ),
      labels: { confirm: t("common.delete"), cancel: t("common.cancel") },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await remove(account.id).unwrap();
        } catch (error) {
          notifications.show({ color: "red", message: getErrorMessage(error) });
        }
      },
    });

  return (
    <Page maxWidth={1300}>
      <PageHeader
        icon={<IconBuildingBank size={22} stroke={1.7} />}
        title={t("admin.accounts.title")}
        subtitle={t("admin.accounts.subtitle")}
        count={accounts.length}
        actions={
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setEditing(null)}
          >
            {t("admin.accounts.create")}
          </Button>
        }
      />
      <Card withBorder p={0}>
        <Table.ScrollContainer minWidth={980}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("admin.accounts.name")}</Table.Th>
                <Table.Th>{t("admin.accounts.kind")}</Table.Th>
                <Table.Th>{t("admin.accounts.bexioAccount")}</Table.Th>
                <Table.Th>{t("admin.accounts.reconciliation")}</Table.Th>
                <Table.Th>{t("admin.accounts.cards")}</Table.Th>
                <Table.Th ta="right">{t("admin.common.usage")}</Table.Th>
                <Table.Th>{t("admin.common.active")}</Table.Th>
                <Table.Th w={90} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {accounts.map((a) => (
                <Table.Tr key={a.id}>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {a.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={ACCOUNT_KIND_COLOR[a.kind]}>
                      {t(`enum.paymentAccountKind.${a.kind}`)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {a.bexioAccountNo ?? "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {t(`enum.reconciliationMode.${a.reconciliation}`)}
                    </Text>
                    {a.reconciliation ===
                      ReconciliationModeDTO.STATEMENT_IMPORT && (
                      <Text size="xs" c="dimmed">
                        {[
                          a.statementFormat &&
                            t(`enum.statementFormat.${a.statementFormat}`),
                          a.revolutAccountId,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {a.cards.length === 0 && (
                        <Text size="sm" c="dimmed">
                          —
                        </Text>
                      )}
                      {a.cards.map((c) => (
                        <Tooltip
                          key={c.id ?? c.last4}
                          label={[c.label, c.holder]
                            .filter(Boolean)
                            .join(" · ")}
                          disabled={!c.label && !c.holder}
                        >
                          <Badge
                            variant="outline"
                            color={c.active === false ? "gray" : "dark"}
                            ff="monospace"
                          >
                            {c.maskedNumber || formatCard(c.last4)}
                          </Badge>
                        </Tooltip>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">{a.expenseCount ?? 0}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={a.active ? "teal" : "gray"}>
                      {a.active ? t("common.yes") : t("common.no")}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <ActionIcon
                        variant="subtle"
                        color="dark"
                        onClick={() => setEditing(a)}
                        aria-label={t("common.edit")}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <Tooltip
                        label={t("admin.common.inUse")}
                        disabled={!a.expenseCount}
                      >
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          disabled={!!a.expenseCount}
                          onClick={() => confirmDelete(a)}
                          aria-label={t("common.delete")}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {accounts.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Text c="dimmed" ta="center" py="lg">
                      {t("admin.accounts.empty")}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      <Modal
        size="xl"
        opened={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? t("admin.accounts.edit") : t("admin.accounts.create")}
      >
        {editing !== undefined && (
          <AccountForm
            account={editing}
            nextPosition={accounts.length}
            onClose={() => setEditing(undefined)}
          />
        )}
      </Modal>
    </Page>
  );
}

/** Une carte du formulaire ; `numberInput` (tapé ou collé) n'en sort que masqué. */
type CardRow = PaymentCardDTO & { key: number; numberInput: string };

/** Les 4 derniers chiffres d'une carte du formulaire : ceux du numéro tapé, sinon ceux enregistrés. */
const cardLast4 = (card: CardRow) => {
  const read = readCardNumber(card.numberInput);
  return read.valid ? (read.last4 ?? "") : read.empty ? card.last4 : "";
};

/**
 * La nature du compte suggère son rapprochement : une banque (UBS) dans
 * bexio, Revolut par l'import du relevé Revolut Business, le reste sans relevé.
 */
function defaultReconciliation(kind: PaymentAccountKindDTO): {
  reconciliation: ReconciliationModeDTO;
  statementFormat: StatementFormatDTO | null;
} {
  switch (kind) {
    case PaymentAccountKindDTO.UBS:
      return {
        reconciliation: ReconciliationModeDTO.BEXIO,
        statementFormat: null,
      };
    case PaymentAccountKindDTO.REVOLUT:
      return {
        reconciliation: ReconciliationModeDTO.STATEMENT_IMPORT,
        statementFormat: StatementFormatDTO.REVOLUT_BUSINESS,
      };
    default:
      return {
        reconciliation: ReconciliationModeDTO.NONE,
        statementFormat: null,
      };
  }
}

const RECONCILIATION_MODES = [
  ReconciliationModeDTO.BEXIO,
  ReconciliationModeDTO.STATEMENT_IMPORT,
  ReconciliationModeDTO.NONE,
];

function AccountForm({
  account,
  nextPosition,
  onClose,
}: {
  account: PaymentAccountDTO | null;
  nextPosition: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [create, { isLoading: creating }] = useCreatePaymentAccountMutation();
  const [update, { isLoading: updating }] = useUpdatePaymentAccountMutation();
  const [kind, setKind] = useState<PaymentAccountKindDTO>(
    account?.kind ?? PaymentAccountKindDTO.REVOLUT,
  );
  const [name, setName] = useState(account?.name ?? "");
  const [bexioAccountNo, setBexioAccountNo] = useState(
    account?.bexioAccountNo ?? "",
  );
  const [reconciliation, setReconciliation] = useState<ReconciliationModeDTO>(
    () => account?.reconciliation ?? defaultReconciliation(kind).reconciliation,
  );
  const [statementFormat, setStatementFormat] =
    useState<StatementFormatDTO | null>(
      () =>
        account?.statementFormat ?? defaultReconciliation(kind).statementFormat,
    );
  const byImport = reconciliation === ReconciliationModeDTO.STATEMENT_IMPORT;
  const [revolutAccountId, setRevolutAccountId] = useState(
    account?.revolutAccountId ?? "",
  );
  const [active, setActive] = useState(account?.active ?? true);
  const [cards, setCards] = useState<CardRow[]>(
    (account?.cards ?? []).map((c, key) => ({ ...c, key, numberInput: "" })),
  );
  const [showErrors, setShowErrors] = useState(false);

  const patchCard = (key: number, patch: Partial<CardRow>) =>
    setCards((all) => all.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  const accountNoInvalid =
    !!bexioAccountNo.trim() && !/^\d{3,6}$/.test(bexioAccountNo.trim());
  /** Saisie illisible : dit tout de suite ; numéro manquant ou doublon : à l'enregistrement. */
  const cardError = (card: CardRow) => {
    const read = readCardNumber(card.numberInput);
    if (!read.empty && !read.valid)
      return t("admin.accounts.cardNumberInvalid");
    if (!showErrors) return null;
    const last4 = cardLast4(card);
    if (!/^\d{4}$/.test(last4)) return t("admin.accounts.cardNumberRequired");
    if (cards.filter((c) => cardLast4(c) === last4).length > 1)
      return t("admin.accounts.last4Duplicate");
    return null;
  };

  const addCard = () =>
    setCards((all) => [
      ...all,
      {
        key: Date.now(),
        last4: "",
        numberInput: "",
        label: "",
        holder: "",
        active: true,
      },
    ]);

  const submit = async () => {
    setShowErrors(true);
    const cardsInvalid = cards.some((c) => {
      const last4 = cardLast4(c);
      const read = readCardNumber(c.numberInput);
      return (
        (!read.empty && !read.valid) ||
        !/^\d{4}$/.test(last4) ||
        cards.filter((x) => cardLast4(x) === last4).length > 1
      );
    });
    if (
      !name.trim() ||
      accountNoInvalid ||
      cardsInvalid ||
      (byImport && !statementFormat)
    )
      return;
    const body: CreatePaymentAccountDTO = {
      kind,
      name: name.trim(),
      bexioAccountNo: bexioAccountNo.trim() || null,
      reconciliation,
      statementFormat: byImport ? statementFormat : null,
      revolutAccountId: byImport ? revolutAccountId.trim() || null : null,
      position: account?.position ?? nextPosition,
      active,
      cards: cards.map((c) => {
        const read = readCardNumber(c.numberInput);
        return {
          ...(c.id ? { id: c.id } : {}),
          // Le numéro ne part que masqué : l'API n'en garde pas plus.
          ...(read.valid && read.masked ? { number: read.masked } : {}),
          last4: read.valid && read.last4 ? read.last4 : c.last4,
          maskedNumber:
            read.valid && read.masked ? read.masked : (c.maskedNumber ?? null),
          label: c.label?.trim() || null,
          holder: c.holder?.trim() || null,
          active: c.active ?? true,
        };
      }),
    };
    try {
      if (account) await update({ id: account.id, body }).unwrap();
      else await create(body).unwrap();
      notifications.show({ color: "teal", message: t("common.saved") });
      onClose();
    } catch (error) {
      notifications.show({ color: "red", message: getErrorMessage(error) });
    }
  };

  return (
    <Stack>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput
          label={t("admin.accounts.name")}
          value={name}
          error={showErrors && !name.trim() ? t("common.required") : null}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <Select
          label={t("admin.accounts.kind")}
          data={enumOptions(t, "paymentAccountKind", PaymentAccountKindDTO)}
          value={kind}
          allowDeselect={false}
          onChange={(v) => {
            if (!v) return;
            const next = v as PaymentAccountKindDTO;
            setKind(next);
            if (!account) {
              const defaults = defaultReconciliation(next);
              setReconciliation(defaults.reconciliation);
              setStatementFormat(defaults.statementFormat);
            }
          }}
        />
        <BexioAccountSelect
          label={t("admin.accounts.bexioAccount")}
          description={t("admin.accounts.bexioAccountHint")}
          types={PAYMENT_ACCOUNT_TYPES}
          value={bexioAccountNo}
          error={accountNoInvalid ? t("admin.common.accountNoInvalid") : null}
          onChange={(accountNo) => setBexioAccountNo(accountNo)}
        />
      </SimpleGrid>
      <Radio.Group
        label={t("admin.accounts.reconciliation")}
        description={t("admin.accounts.reconciliationHint")}
        value={reconciliation}
        onChange={(v) => {
          const next = v as ReconciliationModeDTO;
          setReconciliation(next);
          if (
            next === ReconciliationModeDTO.STATEMENT_IMPORT &&
            !statementFormat
          )
            setStatementFormat(StatementFormatDTO.REVOLUT_BUSINESS);
        }}
      >
        <SimpleGrid cols={{ base: 1, sm: 3 }} mt="xs">
          {RECONCILIATION_MODES.map((mode) => (
            <Paper
              key={mode}
              withBorder
              p="sm"
              style={{
                borderColor:
                  mode === reconciliation
                    ? "var(--mantine-primary-color-filled)"
                    : undefined,
              }}
            >
              <Radio
                value={mode}
                label={t(`enum.reconciliationMode.${mode}`)}
                description={t(`admin.accounts.reconciliationModeHint.${mode}`)}
              />
            </Paper>
          ))}
        </SimpleGrid>
      </Radio.Group>
      {byImport && (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label={t("admin.accounts.statementFormat")}
            description={t("admin.accounts.statementFormatHint")}
            data={enumOptions(t, "statementFormat", StatementFormatDTO)}
            value={statementFormat}
            allowDeselect={false}
            error={showErrors && !statementFormat ? t("common.required") : null}
            onChange={(v) => setStatementFormat(v as StatementFormatDTO | null)}
          />
          <TextInput
            label={t("admin.accounts.revolutAccountId")}
            description={t("admin.accounts.revolutAccountIdHint")}
            value={revolutAccountId}
            onChange={(e) => setRevolutAccountId(e.currentTarget.value)}
          />
        </SimpleGrid>
      )}
      <Group justify="space-between" align="flex-end" wrap="nowrap">
        <Stack gap={4}>
          <Text fw={600} size="sm">
            {t("admin.accounts.cards")}
          </Text>
          <Text size="xs" c="dimmed">
            {t("admin.accounts.cardsHint")}
          </Text>
        </Stack>
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={addCard}
          style={{ flexShrink: 0 }}
        >
          {t("admin.accounts.addCard")}
        </Button>
      </Group>
      {cards.length === 0 && (
        <Paper withBorder p="md" ta="center">
          <Text size="sm" c="dimmed">
            {t("admin.accounts.noCard")}
          </Text>
        </Paper>
      )}
      {cards.map((c) => {
        const read = readCardNumber(c.numberInput);
        const saved = c.maskedNumber || (c.last4 ? formatCard(c.last4) : null);
        return (
          <Paper key={c.key} withBorder p="sm">
            <Group align="flex-start" gap="xs" wrap="nowrap">
              <TextInput
                label={t("admin.accounts.cardNumber")}
                placeholder={saved ?? t("admin.accounts.cardNumberPlaceholder")}
                leftSection={<IconCreditCard size={16} />}
                autoComplete="off"
                inputMode="numeric"
                spellCheck={false}
                maxLength={40}
                autoFocus={!c.id && !c.numberInput}
                styles={{
                  input: { fontFamily: "var(--mantine-font-family-monospace)" },
                }}
                style={{ flex: 1.4 }}
                value={c.numberInput}
                error={cardError(c)}
                onChange={(e) =>
                  patchCard(c.key, { numberInput: e.currentTarget.value })
                }
              />
              <TextInput
                label={t("admin.accounts.cardLabel")}
                value={c.label ?? ""}
                onChange={(e) =>
                  patchCard(c.key, { label: e.currentTarget.value })
                }
                style={{ flex: 1 }}
              />
              <TextInput
                label={t("admin.accounts.holder")}
                value={c.holder ?? ""}
                onChange={(e) =>
                  patchCard(c.key, { holder: e.currentTarget.value })
                }
                style={{ flex: 1 }}
              />
              <Switch
                mt={32}
                label={t("admin.common.active")}
                checked={c.active ?? true}
                onChange={(e) =>
                  patchCard(c.key, { active: e.currentTarget.checked })
                }
              />
              <ActionIcon
                mt={28}
                variant="subtle"
                color="red"
                aria-label={t("admin.accounts.removeCard")}
                onClick={() =>
                  setCards((all) => all.filter((x) => x.key !== c.key))
                }
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
            <Text size="xs" c={read.valid ? "teal.8" : "dimmed"} mt={6}>
              {read.valid
                ? t("admin.accounts.cardNumberRead", {
                    masked: read.masked,
                    last4: read.last4,
                  })
                : c.id && saved
                  ? t("admin.accounts.cardNumberSaved", { masked: saved })
                  : t("admin.accounts.cardNumberHint")}
            </Text>
          </Paper>
        );
      })}
      <Switch
        label={t("admin.common.active")}
        description={t("admin.accounts.activeHint")}
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
