import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
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
  IconEdit,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  BookingModeDTO,
  PaymentAccountKindDTO,
  type CreatePaymentAccountDTO,
  type PaymentAccountDTO,
  type PaymentCardDTO,
} from "@repo/models";
import Page from "@/components/Page";
import PageHeader from "@/components/PageHeader/PageHeader";
import { ACCOUNT_KIND_COLOR } from "@/components/expense/colors";
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
 * compte bexio crédité, la façon dont une pièce finit dans bexio, et les
 * cartes reconnues sur les tickets par leurs 4 derniers chiffres.
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
                <Table.Th>{t("admin.accounts.bookingMode")}</Table.Th>
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
                    {a.revolutAccountId && (
                      <Text size="xs" c="dimmed" ff="monospace">
                        {a.revolutAccountId}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={ACCOUNT_KIND_COLOR[a.kind]}>
                      {t(`enum.paymentAccountKind.${a.kind}`)}
                    </Badge>
                  </Table.Td>
                  <Table.Td ff="monospace">{a.bexioAccountNo ?? "—"}</Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {t(`enum.bookingMode.${a.bookingMode}`)}
                    </Text>
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
                          key={c.last4}
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
                            {formatCard(c.last4)}
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

type CardRow = PaymentCardDTO & { key: number };

/** Le genre de compte suggère le mode de comptabilisation (UBS : dans bexio). */
const defaultMode = (kind: PaymentAccountKindDTO) =>
  kind === PaymentAccountKindDTO.UBS
    ? BookingModeDTO.BEXIO_RECONCILIATION
    : BookingModeDTO.MANUAL_ENTRY;

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
  const [bookingMode, setBookingMode] = useState<BookingModeDTO>(
    () => account?.bookingMode ?? defaultMode(kind),
  );
  const [revolutAccountId, setRevolutAccountId] = useState(
    account?.revolutAccountId ?? "",
  );
  const [active, setActive] = useState(account?.active ?? true);
  const [cards, setCards] = useState<CardRow[]>(
    (account?.cards ?? []).map((c, key) => ({ ...c, key })),
  );
  const [showErrors, setShowErrors] = useState(false);

  const patchCard = (key: number, patch: Partial<CardRow>) =>
    setCards((all) => all.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  const accountNoInvalid =
    !!bexioAccountNo.trim() && !/^\d{3,6}$/.test(bexioAccountNo.trim());
  const cardError = (card: CardRow) => {
    if (!showErrors) return null;
    if (!/^\d{4}$/.test(card.last4)) return t("admin.accounts.last4Invalid");
    if (cards.filter((c) => c.last4 === card.last4).length > 1)
      return t("admin.accounts.last4Duplicate");
    return null;
  };

  const submit = async () => {
    setShowErrors(true);
    const cardsInvalid = cards.some(
      (c) =>
        !/^\d{4}$/.test(c.last4) ||
        cards.filter((x) => x.last4 === c.last4).length > 1,
    );
    if (!name.trim() || accountNoInvalid || cardsInvalid) return;
    const body: CreatePaymentAccountDTO = {
      kind,
      name: name.trim(),
      bexioAccountNo: bexioAccountNo.trim() || null,
      bookingMode,
      revolutAccountId:
        kind === PaymentAccountKindDTO.REVOLUT
          ? revolutAccountId.trim() || null
          : null,
      position: account?.position ?? nextPosition,
      active,
      cards: cards.map(({ id, last4, label, holder, active: cardActive }) => ({
        ...(id ? { id } : {}),
        last4,
        label: label?.trim() || null,
        holder: holder?.trim() || null,
        active: cardActive ?? true,
      })),
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
            if (!account) setBookingMode(defaultMode(next));
          }}
        />
        <TextInput
          label={t("admin.accounts.bexioAccount")}
          description={t("admin.accounts.bexioAccountHint")}
          value={bexioAccountNo}
          error={accountNoInvalid ? t("admin.common.accountNoInvalid") : null}
          onChange={(e) => setBexioAccountNo(e.currentTarget.value)}
        />
        <Select
          label={t("admin.accounts.bookingMode")}
          description={t(`admin.accounts.bookingModeHint.${bookingMode}`)}
          data={enumOptions(t, "bookingMode", BookingModeDTO)}
          value={bookingMode}
          allowDeselect={false}
          onChange={(v) => v && setBookingMode(v as BookingModeDTO)}
        />
      </SimpleGrid>
      {kind === PaymentAccountKindDTO.REVOLUT && (
        <TextInput
          label={t("admin.accounts.revolutAccountId")}
          description={t("admin.accounts.revolutAccountIdHint")}
          value={revolutAccountId}
          onChange={(e) => setRevolutAccountId(e.currentTarget.value)}
        />
      )}
      <Stack gap={4}>
        <Text fw={600} size="sm">
          {t("admin.accounts.cards")}
        </Text>
        <Text size="xs" c="dimmed">
          {t("admin.accounts.cardsHint")}
        </Text>
      </Stack>
      {cards.map((c) => (
        <Group key={c.key} align="flex-start" gap="xs" wrap="nowrap">
          <TextInput
            label={t("admin.accounts.last4")}
            leftSection={<Text size="xs">••••</Text>}
            maxLength={4}
            w={130}
            value={c.last4}
            error={cardError(c)}
            onChange={(e) =>
              patchCard(c.key, {
                last4: e.currentTarget.value.replace(/\D/g, ""),
              })
            }
          />
          <TextInput
            label={t("admin.accounts.cardLabel")}
            value={c.label ?? ""}
            onChange={(e) => patchCard(c.key, { label: e.currentTarget.value })}
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
            aria-label={t("common.delete")}
            onClick={() =>
              setCards((all) => all.filter((x) => x.key !== c.key))
            }
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ))}
      <Group>
        <Button
          variant="default"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() =>
            setCards((all) => [
              ...all,
              {
                key: Date.now(),
                last4: "",
                label: "",
                holder: "",
                active: true,
              },
            ])
          }
        >
          {t("admin.accounts.addCard")}
        </Button>
      </Group>
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
