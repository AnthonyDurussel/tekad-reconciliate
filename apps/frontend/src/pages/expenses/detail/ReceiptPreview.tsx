import { useState } from "react";
import {
  Anchor,
  Button,
  Card,
  Group,
  Image,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconExternalLink,
  IconFile,
  IconLink,
  IconLinkOff,
  IconReceiptOff,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { ExpenseStatusDTO, type ExpenseDTO } from "@repo/models";
import {
  expenseFileUrl,
  useUnlinkExpenseReceiptMutation,
} from "@/store/slices/api";
import { getErrorMessage } from "@/utils/apiError";
import LinkReceiptModal from "./LinkReceiptModal";

/** Un fichier : image affichée, PDF (ou inconnu) dans un cadre. */
export function FilePreview({
  url,
  name,
  mimeType,
  height = "78vh",
}: {
  url: string;
  name: string;
  mimeType: string | null;
  height?: string;
}) {
  return mimeType?.toLowerCase().startsWith("image/") ? (
    <Image
      src={url}
      alt={name}
      fit="contain"
      mah={height}
      bg="var(--mantine-color-default-hover)"
    />
  ) : (
    <iframe
      src={url}
      title={name}
      style={{ width: "100%", height, border: 0, display: "block" }}
    />
  );
}

/**
 * La pièce de la dépense : son fichier (« Détacher » : la pièce retrouve sa
 * propre dépense), ou un état vide avec « Rattacher une pièce ».
 */
export default function ReceiptPreview({
  expense,
  canManage,
}: {
  expense: ExpenseDTO;
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const [linking, setLinking] = useState(false);
  const [unlink, { isLoading: unlinking }] = useUnlinkExpenseReceiptMutation();
  const locked = expense.status === ExpenseStatusDTO.IGNORED;
  const fileName = expense.fileName ?? t("expenseDetail.receiptCard.title");

  const confirmUnlink = () =>
    modals.openConfirmModal({
      title: t("expenseDetail.receiptCard.unlinkTitle"),
      children: (
        <Text size="sm">
          {t("expenseDetail.receiptCard.unlinkConfirm", { file: fileName })}
        </Text>
      ),
      labels: {
        confirm: t("expenseDetail.receiptCard.unlink"),
        cancel: t("common.cancel"),
      },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await unlink(expense.id).unwrap();
          notifications.show({
            color: "teal",
            message: t("expenseDetail.receiptCard.unlinkedDone"),
          });
        } catch (e) {
          notifications.show({ color: "red", message: getErrorMessage(e) });
        }
      },
    });

  const modal = (
    <LinkReceiptModal
      expense={linking ? expense : null}
      onClose={() => setLinking(false)}
    />
  );

  if (!expense.receiptId) {
    return (
      <Card withBorder py={60}>
        <Stack align="center" gap="sm">
          <ThemeIcon size={48} radius="xl" variant="light" color="red">
            <IconReceiptOff size={26} />
          </ThemeIcon>
          <Text fw={600}>{t("expenseDetail.receiptCard.none")}</Text>
          <Text size="sm" c="dimmed" ta="center" maw={380}>
            {t("expenseDetail.receiptCard.noneHint")}
          </Text>
          {canManage && !locked && (
            <Button
              leftSection={<IconLink size={16} />}
              onClick={() => setLinking(true)}
            >
              {t("expenseDetail.receiptCard.link")}
            </Button>
          )}
        </Stack>
        {modal}
      </Card>
    );
  }

  const url = expenseFileUrl(expense.id);
  return (
    <Card withBorder p={0} style={{ position: "sticky", top: 16 }}>
      <Group justify="space-between" px="md" py="sm" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <IconFile size={16} />
          <Text size="sm" fw={600} truncate>
            {fileName}
          </Text>
        </Group>
        <Group gap="sm" wrap="nowrap">
          <Anchor
            href={url}
            target="_blank"
            rel="noreferrer"
            size="sm"
            style={{ whiteSpace: "nowrap" }}
          >
            <Group gap={4} wrap="nowrap">
              {t("expenseDetail.openFile")}
              <IconExternalLink size={14} />
            </Group>
          </Anchor>
          {canManage && (
            <Tooltip label={t("expenseDetail.receiptCard.unlinkHint")}>
              <Button
                size="xs"
                variant="default"
                leftSection={<IconLinkOff size={14} />}
                loading={unlinking}
                onClick={confirmUnlink}
              >
                {t("expenseDetail.receiptCard.unlink")}
              </Button>
            </Tooltip>
          )}
        </Group>
      </Group>
      <FilePreview url={url} name={fileName} mimeType={expense.mimeType} />
    </Card>
  );
}
