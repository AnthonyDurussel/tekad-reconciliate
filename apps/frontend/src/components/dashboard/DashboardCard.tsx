import type { ComponentType, ReactNode } from "react";
import classes from "./dashboard.module.css";
import { useTranslation } from "react-i18next";
import {
  Center,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";

/**
 * Une carte de tableau de bord : un titre, une ligne qui dit ce qu'on lit, le
 * contenu. Pendant le premier chargement, un squelette de la taille de la
 * carte ; sans donnée, une phrase — jamais un graphique vide qu'on prendrait
 * pour des zéros.
 */
export function DashboardCard({
  title,
  description,
  loading,
  empty,
  emptyLabel,
  action,
  children,
  minHeight = 120,
  icon: Icon,
  accent = "var(--mantine-primary-color-filled)",
}: {
  icon?: ComponentType<{ size?: number; stroke?: number }>;
  /** Teinte de la pastille d'icône. */
  accent?: string;
  title: string;
  description?: string;
  loading?: boolean;
  empty?: boolean;
  emptyLabel?: string;
  action?: ReactNode;
  children?: ReactNode;
  minHeight?: number;
}) {
  const { t } = useTranslation();
  return (
    <Paper
      radius="lg"
      p="lg"
      h="100%"
      miw={0}
      className={classes.card}
      style={{ ["--kpi-accent" as string]: accent }}
    >
      <Stack gap="md" h="100%">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" align="flex-start" miw={0}>
            {Icon && (
              <span className={classes.kpiIcon}>
                <Icon size={18} stroke={1.8} />
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              <Title order={5} className={classes.cardTitle}>
                {title}
              </Title>
              {description && (
                <Text size="xs" c="dimmed">
                  {description}
                </Text>
              )}
            </div>
          </Group>
          {action}
        </Group>
        {loading ? (
          <Skeleton h={minHeight} radius="sm" />
        ) : empty ? (
          <Center mih={minHeight / 2}>
            <Text size="sm" c="dimmed" ta="center">
              {emptyLabel ?? t("dashboard.empty")}
            </Text>
          </Center>
        ) : (
          children
        )}
      </Stack>
    </Paper>
  );
}
