import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  PasswordInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCheck,
  IconInfoCircle,
  IconPlugConnected,
  IconRefresh,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  OcrEngineDTO,
  type AiConnectionDTO,
  type AiConnectionTestDTO,
  type AiModelDTO,
} from "@repo/models";
import Page from "@/components/Page";
import PageHeader from "@/components/PageHeader/PageHeader";
import {
  useGetAiSettingsQuery,
  useListAiModelsMutation,
  useResetAiSettingsMutation,
  useTestAiConnectionMutation,
  useUpdateAiSettingsMutation,
} from "@/store/slices/api";
import { getErrorMessage } from "@/utils/apiError";
import { formatDateTime } from "@/utils/format";
import {
  initialValues,
  priceLabel,
  sortModels,
  toUpdateBody,
  type AiSettingsFormValues,
} from "./aiSettingsForm";

const fail = (error: unknown) =>
  notifications.show({ color: "red", message: getErrorMessage(error) });

const connection = (
  v: AiSettingsFormValues,
  model?: string,
): AiConnectionDTO => ({
  ...(v.apiKey.trim() ? { apiKey: v.apiKey.trim() } : {}),
  model: model ?? (v.extractionModel.trim() || null),
});

/**
 * Intelligence artificielle : la clé OpenRouter, le moteur de lecture des
 * pièces (Mistral OCR) et le modèle qui en tire les champs. Réservé à
 * l'administrateur (`SETTINGS_MANAGE`). La clé n'est jamais relue : elle se
 * remplace.
 */
export default function AiSettingsPage() {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useGetAiSettingsQuery();
  const [update, { isLoading: saving }] = useUpdateAiSettingsMutation();
  const [reset] = useResetAiSettingsMutation();
  const [listModels, { isLoading: listing }] = useListAiModelsMutation();
  const [testConnection, { isLoading: testing }] =
    useTestAiConnectionMutation();
  const [models, setModels] = useState<AiModelDTO[] | null>(null);
  const [onlyJson, setOnlyJson] = useState(true);
  const [testResult, setTestResult] = useState<AiConnectionTestDTO | null>(
    null,
  );

  const storedKeyUsable =
    !!settings?.stored?.hasApiKey && !settings.stored.apiKeyUnreadable;

  const form = useForm<AiSettingsFormValues>({
    initialValues: initialValues(undefined),
    validate: {
      extractionModel: (v) => (v.trim() ? null : t("common.required")),
      apiKey: (v) =>
        !v.trim() && !storedKeyUsable ? t("aiSettings.apiKeyRequired") : null,
    },
  });

  useEffect(() => {
    if (!settings) return;
    const values = initialValues(settings);
    form.setValues(values);
    form.resetDirty(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const canUseKey = () =>
    !!form.getValues().apiKey.trim() ||
    storedKeyUsable ||
    settings?.source === "ENVIRONMENT";

  const loadModels = async () => {
    if (!canUseKey()) {
      form.validateField("apiKey");
      return;
    }
    try {
      setModels(
        sortModels(await listModels(connection(form.getValues())).unwrap()),
      );
    } catch (error) {
      setModels(null);
      fail(error);
    }
  };

  const runTest = async () => {
    if (!canUseKey()) {
      form.validateField("apiKey");
      return;
    }
    setTestResult(null);
    try {
      setTestResult(
        await testConnection(connection(form.getValues())).unwrap(),
      );
    } catch (error) {
      fail(error);
    }
  };

  const submit = form.onSubmit(async (v) => {
    try {
      await update(toUpdateBody(v)).unwrap();
      notifications.show({ color: "teal", message: t("common.saved") });
    } catch (error) {
      fail(error);
    }
  });

  const confirmReset = () =>
    modals.openConfirmModal({
      title: t("aiSettings.reset"),
      children: <Text size="sm">{t("aiSettings.resetConfirm")}</Text>,
      labels: { confirm: t("aiSettings.reset"), cancel: t("common.cancel") },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await reset().unwrap();
          notifications.show({ color: "teal", message: t("common.saved") });
        } catch (error) {
          fail(error);
        }
      },
    });

  const modelOptions = useMemo(() => {
    const current = form.values.extractionModel.trim();
    const list = (models ?? []).filter((m) => !onlyJson || m.structuredOutputs);
    const options = list.map((m) => ({
      value: m.id,
      label: `${m.id}${m.structuredOutputs ? "" : " · sans JSON"}${
        priceLabel(m) ? ` · ${priceLabel(m)}` : ""
      }`,
    }));
    if (current && !options.some((o) => o.value === current)) {
      options.unshift({ value: current, label: current });
    }
    return options;
  }, [models, onlyJson, form.values.extractionModel]);

  const selected = models?.find((m) => m.id === form.values.extractionModel);

  return (
    <Page maxWidth={960}>
      <PageHeader
        icon={<IconSparkles size={22} stroke={1.7} />}
        title={t("aiSettings.title")}
        subtitle={t("aiSettings.subtitle")}
        badge={
          settings && (
            <Badge color={settings.active ? "teal" : "gray"} variant="light">
              {settings.active
                ? t("aiSettings.active")
                : t("aiSettings.inactive")}
            </Badge>
          )
        }
      />
      {!isLoading && settings && (
        <form onSubmit={submit}>
          <Stack gap="lg">
            <Alert
              variant="light"
              color={settings.source === "NONE" ? "orange" : "blue"}
              icon={<IconInfoCircle size={18} />}
            >
              {t(`aiSettings.source.${settings.source}`, {
                model: settings.environment?.model ?? "",
              })}
              {settings.stored && (
                <Text size="xs" c="dimmed" mt={4}>
                  {t("aiSettings.updated", {
                    date: formatDateTime(settings.stored.updatedAt),
                    name: settings.stored.updatedByName ?? "—",
                  })}
                </Text>
              )}
            </Alert>
            {!settings.encryptionAvailable && (
              <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
                {t("aiSettings.noEncryption")}
              </Alert>
            )}
            {settings.stored?.apiKeyUnreadable && (
              <Alert color="red" icon={<IconAlertTriangle size={18} />}>
                {t("aiSettings.keyUnreadable")}
              </Alert>
            )}

            <Card withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Title order={4}>{t("aiSettings.provider")}</Title>
                  <Switch
                    label={t("aiSettings.enabled")}
                    {...form.getInputProps("enabled", { type: "checkbox" })}
                  />
                </Group>
                <PasswordInput
                  label={t("aiSettings.apiKey")}
                  description={
                    settings.stored?.hasApiKey
                      ? t("aiSettings.apiKeyKeep", {
                          hint: settings.stored.apiKeyHint ?? "",
                        })
                      : t("aiSettings.apiKeyHelp")
                  }
                  placeholder="sk-or-v1-…"
                  autoComplete="off"
                  {...form.getInputProps("apiKey")}
                />
              </Stack>
            </Card>

            <Card withBorder>
              <Stack gap="md">
                <Title order={4}>{t("aiSettings.ocr")}</Title>
                <SegmentedControl
                  data={Object.values(OcrEngineDTO).map((value) => ({
                    value,
                    label: t(`aiSettings.engine.${value}`),
                  }))}
                  {...form.getInputProps("ocrEngine")}
                />
                <Text size="sm" c="dimmed">
                  {t(`aiSettings.engineHelp.${form.values.ocrEngine}`)}
                </Text>
              </Stack>
            </Card>

            <Card withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Title order={4}>{t("aiSettings.model")}</Title>
                  <Button
                    variant="default"
                    size="xs"
                    leftSection={<IconRefresh size={14} />}
                    loading={listing}
                    onClick={loadModels}
                  >
                    {models
                      ? t("aiSettings.reloadModels")
                      : t("aiSettings.loadModels")}
                  </Button>
                </Group>
                <Select
                  label={t("aiSettings.extractionModel")}
                  description={t("aiSettings.extractionModelHelp")}
                  searchable
                  data={modelOptions}
                  nothingFoundMessage={t("aiSettings.noModel")}
                  {...form.getInputProps("extractionModel")}
                />
                {models && (
                  <Switch
                    size="xs"
                    label={t("aiSettings.onlyJson", {
                      count: models.filter((m) => m.structuredOutputs).length,
                    })}
                    checked={onlyJson}
                    onChange={(e) => setOnlyJson(e.currentTarget.checked)}
                  />
                )}
                {selected && !selected.structuredOutputs && (
                  <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
                    {t("aiSettings.noJsonWarning")}
                  </Alert>
                )}
                <Group gap="sm">
                  <Button
                    variant="light"
                    leftSection={<IconPlugConnected size={16} />}
                    loading={testing}
                    onClick={runTest}
                  >
                    {t("aiSettings.test")}
                  </Button>
                  {testResult && (
                    <Badge
                      size="lg"
                      variant="light"
                      color={testResult.ok ? "teal" : "red"}
                      leftSection={
                        testResult.ok ? (
                          <IconCheck size={14} />
                        ) : (
                          <IconX size={14} />
                        )
                      }
                    >
                      {testResult.ok
                        ? t("aiSettings.testOk", {
                            model: testResult.model,
                            ms: testResult.durationMs,
                          })
                        : t("aiSettings.testFailed")}
                    </Badge>
                  )}
                </Group>
                {testResult && !testResult.ok && testResult.message && (
                  <Text size="sm" c="red">
                    {testResult.message}
                  </Text>
                )}
              </Stack>
            </Card>

            <Group justify="space-between">
              {settings.stored ? (
                <Button variant="subtle" color="red" onClick={confirmReset}>
                  {t("aiSettings.reset")}
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" loading={saving}>
                {t("common.save")}
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Page>
  );
}
