import { useState } from "react";
import {
  Anchor,
  Card,
  Group,
  Image,
  SegmentedControl,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import {
  IconExternalLink,
  IconFile,
  IconReceiptOff,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { PreviewFile } from "./bexioExpenseDetail";

/**
 * Les fichiers de la dépense bexio : ses fichiers joints (un onglet par
 * fichier quand il y en a plusieurs), sinon la pièce de la dépense
 * rattachée, sinon un état vide.
 */
export default function BexioExpensePreview({
  files,
}: {
  files: PreviewFile[];
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const label = (file: PreviewFile, index: number) =>
    file.name ?? t("bexioExpenseDetail.preview.file", { n: index + 1 });

  if (files.length === 0) {
    return (
      <Card withBorder py={60}>
        <Stack align="center" gap="sm">
          <ThemeIcon size={48} radius="xl" variant="light" color="red">
            <IconReceiptOff size={26} />
          </ThemeIcon>
          <Text fw={600}>{t("bexioExpenseDetail.preview.emptyTitle")}</Text>
          <Text size="sm" c="dimmed" ta="center" maw={360}>
            {t("bexioExpenseDetail.preview.emptyText")}
          </Text>
        </Stack>
      </Card>
    );
  }

  const index = Math.max(
    0,
    files.findIndex((f) => f.key === selected),
  );
  const file = files[index];
  const name = label(file, index);

  return (
    <Card withBorder p={0} style={{ position: "sticky", top: 16 }}>
      {files.length > 1 && (
        <SegmentedControl
          m="sm"
          mb={0}
          data={files.map((f, i) => ({ value: f.key, label: label(f, i) }))}
          value={file.key}
          onChange={setSelected}
          styles={{ root: { overflowX: "auto" } }}
        />
      )}
      <Group justify="space-between" px="md" py="sm" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <IconFile size={16} />
          <Text size="sm" fw={600} truncate>
            {name}
          </Text>
        </Group>
        <Anchor
          href={file.url}
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
      {file.kind === "image" ? (
        <Image
          key={file.key}
          src={file.url}
          alt={name}
          fit="contain"
          mah="78vh"
          bg="var(--mantine-color-default-hover)"
        />
      ) : (
        <iframe
          key={file.key}
          src={file.url}
          title={name}
          style={{ width: "100%", height: "78vh", border: 0, display: "block" }}
        />
      )}
    </Card>
  );
}
