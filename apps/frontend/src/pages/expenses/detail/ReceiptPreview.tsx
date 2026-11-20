import { Anchor, Card, Group, Image, Text } from "@mantine/core";
import { IconExternalLink, IconFile } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { ExpenseDTO } from "@repo/models";
import { expenseFileUrl } from "@/store/slices/api";

/** Le fichier de la pièce : image affichée, PDF dans un cadre. */
export default function ReceiptPreview({ expense }: { expense: ExpenseDTO }) {
  const { t } = useTranslation();
  const url = expenseFileUrl(expense.id);
  const isImage = expense.mimeType?.startsWith("image/") ?? false;
  return (
    <Card withBorder p={0} style={{ position: "sticky", top: 16 }}>
      <Group justify="space-between" px="md" py="sm" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <IconFile size={16} />
          <Text size="sm" fw={600} truncate>
            {expense.fileName}
          </Text>
        </Group>
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
      </Group>
      {isImage ? (
        <Image
          src={url}
          alt={expense.fileName}
          fit="contain"
          mah="78vh"
          bg="var(--mantine-color-default-hover)"
        />
      ) : (
        <iframe
          src={url}
          title={expense.fileName}
          style={{ width: "100%", height: "78vh", border: 0, display: "block" }}
        />
      )}
    </Card>
  );
}
