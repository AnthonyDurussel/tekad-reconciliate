import { useState } from "react";
import {
  Button,
  Chip,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useTranslation } from "react-i18next";

/**
 * Ignorer une pièce ou une transaction, avec une raison (« Pas de pièce :
 * abonnement bancaire »…) ; quelques raisons courantes se choisissent d'un
 * clic.
 */
export default function IgnoreModal({
  opened,
  title,
  description,
  suggestions = [],
  loading,
  onClose,
  onConfirm,
}: {
  opened: boolean;
  title: string;
  description?: string;
  suggestions?: string[];
  loading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string | null) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const close = () => {
    setReason("");
    onClose();
  };
  return (
    <Modal opened={opened} onClose={close} title={title}>
      <Stack>
        {description && (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        )}
        {suggestions.length > 0 && (
          <Group gap={6}>
            {suggestions.map((s) => (
              <Chip
                key={s}
                size="xs"
                checked={reason === s}
                onChange={() => setReason(s)}
              >
                {s}
              </Chip>
            ))}
          </Group>
        )}
        <TextInput
          label={t("ignore.reason")}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          data-autofocus
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            color="dark"
            loading={loading}
            onClick={() => {
              onConfirm(reason.trim() || null);
              setReason("");
            }}
          >
            {t("ignore.confirm")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
