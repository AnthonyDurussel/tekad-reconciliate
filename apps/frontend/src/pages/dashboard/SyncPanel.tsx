import {
  Badge,
  Button,
  Group,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconInbox,
  IconLink,
  IconRefresh,
  IconRefreshDot,
  IconScan,
  IconCreditCard,
  IconX,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  PermissionDTO,
  SyncSourceDTO,
  type SyncRunDTO,
  type SyncStatusDTO,
} from "@repo/models";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import usePermissions from "@/hooks/usePermissions";
import {
  useGetSyncRunsQuery,
  useGetSyncStatusQuery,
  useRunSyncAllMutation,
  useRunSyncMutation,
  type SyncTarget,
} from "@/store/slices/api";
import { getErrorMessage } from "@/utils/apiError";
import { formatDate, formatDateTime } from "@/utils/format";
import RevolutImportButton from "@/components/revolut/RevolutImportButton";

type SourceRow = {
  source: SyncSourceDTO;
  /** Absent : l'étape ne se lance pas d'ici (relevé Revolut : un fichier). */
  target?: SyncTarget;
  icon: typeof IconInbox;
  configured: (status: SyncStatusDTO) => boolean;
};

/** Les étapes : celles de `sync/all`, et l'import du relevé Revolut. */
const SOURCES: SourceRow[] = [
  {
    source: SyncSourceDTO.BEXIO_INBOX,
    target: "bexio-inbox",
    icon: IconInbox,
    configured: (s) => s.bexioConfigured,
  },
  {
    source: SyncSourceDTO.EXTRACTION,
    target: "extract",
    icon: IconScan,
    configured: (s) => s.extractionConfigured,
  },
  {
    source: SyncSourceDTO.REVOLUT,
    icon: IconCreditCard,
    configured: () => true,
  },
  {
    source: SyncSourceDTO.MATCHING,
    target: "match",
    icon: IconLink,
    configured: () => true,
  },
];

function RunState({ run }: { run: SyncRunDTO | undefined }) {
  const { t } = useTranslation();
  if (!run) {
    return (
      <Text size="sm" c="dimmed">
        {t("sync.never")}
      </Text>
    );
  }
  const running = run.success === null && !run.finishedAt;
  return (
    <Group gap={6} wrap="nowrap">
      <ThemeIcon
        size="sm"
        radius="xl"
        variant="light"
        color={running ? "blue" : run.success ? "teal" : "red"}
      >
        {running ? (
          <IconRefreshDot size={12} />
        ) : run.success ? (
          <IconCheck size={12} />
        ) : (
          <IconX size={12} />
        )}
      </ThemeIcon>
      <Stack gap={0} style={{ minWidth: 0 }}>
        <Text size="sm">
          {formatDateTime(run.startedAt)}
          {run.success && (
            <Text span size="sm" c="dimmed">
              {" · "}
              {t("sync.count", { count: run.count })}
            </Text>
          )}
        </Text>
        {run.message && (
          <Text size="xs" c={run.success === false ? "red" : "dimmed"}>
            {run.message}
          </Text>
        )}
      </Stack>
    </Group>
  );
}

/**
 * Les synchronisations : ce qui est configuré, le dernier passage de chaque
 * source et — avec SYNC_RUN — les boutons pour relancer une étape ou tout.
 */
export default function SyncPanel() {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const canRun = can(PermissionDTO.SYNC_RUN);
  const { data: status, isLoading } = useGetSyncStatusQuery();
  const { data: runs = [] } = useGetSyncRunsQuery();
  const [runSync, { isLoading: running, originalArgs }] = useRunSyncMutation();
  const [runAll, { isLoading: runningAll }] = useRunSyncAllMutation();

  const report = (run: SyncRunDTO) =>
    notifications.show({
      color: run.success === false ? "red" : "teal",
      title: t(`enum.syncSource.${run.source}`),
      message:
        run.success === false
          ? (run.message ?? t("sync.failed"))
          : t("sync.count", { count: run.count }),
    });

  const start = async (target: SyncTarget) => {
    try {
      report(await runSync({ target }).unwrap());
    } catch (error) {
      notifications.show({ color: "red", message: getErrorMessage(error) });
    }
  };

  const startAll = async () => {
    try {
      const done = await runAll().unwrap();
      done.forEach(report);
    } catch (error) {
      notifications.show({ color: "red", message: getErrorMessage(error) });
    }
  };

  const anyConfigured =
    !!status && (status.bexioConfigured || status.extractionConfigured);

  return (
    <DashboardCard
      icon={IconRefresh}
      title={t("sync.title")}
      description={t("sync.subtitle")}
      loading={isLoading}
      action={
        canRun && (
          <Button
            leftSection={<IconRefresh size={16} />}
            loading={runningAll}
            disabled={!anyConfigured || running}
            onClick={startAll}
          >
            {t("sync.all")}
          </Button>
        )
      }
    >
      {status && (
        <Stack gap="md">
          <Group gap="xs">
            {(
              [
                ["bexio", status.bexioConfigured],
                ["extraction", status.extractionConfigured],
              ] as const
            ).map(([key, ok]) => (
              <Tooltip
                key={key}
                label={ok ? t("sync.configured") : t("sync.notConfiguredHint")}
              >
                <Badge
                  variant="light"
                  color={ok ? "teal" : "gray"}
                  leftSection={
                    ok ? <IconCheck size={12} /> : <IconX size={12} />
                  }
                >
                  {t(`sync.service.${key}`)}
                </Badge>
              </Tooltip>
            ))}
            <Badge
              variant="light"
              color={status.revolutLatestTransaction ? "teal" : "orange"}
              leftSection={<IconCreditCard size={12} />}
            >
              {status.revolutLatestTransaction
                ? t("sync.revolutLatest", {
                    date: formatDate(status.revolutLatestTransaction),
                  })
                : t("sync.revolutNone")}
            </Badge>
          </Group>
          <Table.ScrollContainer minWidth={620}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("sync.source")}</Table.Th>
                  <Table.Th>{t("sync.lastRun")}</Table.Th>
                  {canRun && <Table.Th w={230} />}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {SOURCES.map(({ source, target, icon: Icon, configured }) => {
                  const ok = configured(status);
                  return (
                    <Table.Tr key={source}>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Icon size={18} stroke={1.6} />
                          <Text size="sm" fw={600}>
                            {t(`enum.syncSource.${source}`)}
                          </Text>
                          {!ok && (
                            <Badge size="xs" variant="outline" color="gray">
                              {t("sync.notConfigured")}
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <RunState run={status.last[source]} />
                      </Table.Td>
                      {canRun && (
                        <Table.Td>
                          {target ? (
                            <Button
                              size="xs"
                              variant="default"
                              disabled={!ok || runningAll}
                              loading={
                                running && originalArgs?.target === target
                              }
                              onClick={() => start(target)}
                            >
                              {t(`sync.run.${target}`)}
                            </Button>
                          ) : (
                            <RevolutImportButton size="xs" variant="default" />
                          )}
                        </Table.Td>
                      )}
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          {runs.length > 0 && (
            <Stack gap={4}>
              <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                {t("sync.history")}
              </Text>
              {runs.slice(0, 8).map((run) => (
                <Group key={run.id} gap="xs" wrap="nowrap">
                  <Text size="xs" c="dimmed" w={120}>
                    {formatDateTime(run.startedAt)}
                  </Text>
                  <Text size="xs" w={150} truncate>
                    {t(`enum.syncSource.${run.source}`)}
                  </Text>
                  <Text
                    size="xs"
                    c={run.success === false ? "red" : "dimmed"}
                    truncate
                    style={{ flex: 1 }}
                  >
                    {run.success === false
                      ? (run.message ?? t("sync.failed"))
                      : t("sync.count", { count: run.count })}
                    {run.triggeredBy ? ` · ${run.triggeredBy}` : ""}
                  </Text>
                </Group>
              ))}
            </Stack>
          )}
        </Stack>
      )}
    </DashboardCard>
  );
}
