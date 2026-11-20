import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import {
  ActionIcon,
  Badge,
  Group,
  Menu,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconChevronLeft, IconDotsVertical } from "@tabler/icons-react";
import { useOptionalMobileHeader } from "@/root/MobileHeaderContext";
import classes from "./PageHeader.module.css";

export interface PageHeaderProps {
  /** L'icône de la page, dans sa pastille verte. */
  icon: ReactNode;
  title: string;
  /** Une phrase sous le titre : ce qu'on fait sur cette page. */
  subtitle?: ReactNode;
  /** Juste après le titre (un statut, un compteur). */
  badge?: ReactNode;
  /** Un compteur en pastille à côté du titre (nombre de lignes). */
  count?: number;
  /** Boutons à droite du bandeau. */
  actions?: ReactNode;
  /** Sous la ligne du titre (onglets, filtres). */
  children?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}

/**
 * L'en-tête de toutes les pages, repris de stoll-stock-management : un
 * bandeau bleu nuit, l'icône et le titre à gauche, les actions à droite.
 *
 * Sur mobile (< md), le bandeau s'efface : le titre remonte dans la barre du
 * haut, à côté du burger (`MobileHeaderContext`), et les actions passent dans
 * un menu « ⋯ » à droite de cette barre — la page commence tout de suite.
 */
export default function PageHeader({
  icon,
  title,
  subtitle,
  badge,
  count,
  actions,
  children,
  onBack,
  backLabel,
}: PageHeaderProps) {
  // `md` (62em) : le même seuil que la navigation de RootLayout. Rendu
  // conditionnel en JS : les `children` ne sont montés qu'une fois.
  const isDesktop = useMediaQuery("(min-width: 62em)", true, {
    getInitialValueInEffect: false,
  });
  const mobileHeader = useOptionalMobileHeader();
  const setHeader = mobileHeader?.setHeader;
  // Idempotent côté contexte : déclaré à chaque rendu pour garder le dernier `onBack`.
  useEffect(() => {
    setHeader?.({ title, count, onBack, backLabel });
  });
  useEffect(() => () => setHeader?.(null), [setHeader]);

  if (!isDesktop && mobileHeader) {
    const actionsMenu =
      actions && mobileHeader.actionsTarget
        ? createPortal(
            <Menu position="bottom-end" withinPortal shadow="md">
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray.0"
                  aria-label="Actions"
                >
                  <IconDotsVertical size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Stack gap="xs" p="xs">
                  {actions}
                </Stack>
              </Menu.Dropdown>
            </Menu>,
            mobileHeader.actionsTarget,
          )
        : null;
    return (
      <>
        {actionsMenu}
        {(badge || children) && (
          <Stack gap="xs" mb="md">
            {badge && <Group gap="xs">{badge}</Group>}
            {children}
          </Stack>
        )}
      </>
    );
  }

  return (
    <Paper shadow="md" p="lg" mb="xl" radius="lg" className={classes.dark}>
      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <Group align="center" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
          {onBack && (
            <ActionIcon
              variant="subtle"
              color="gray.0"
              size="lg"
              onClick={onBack}
              aria-label={backLabel ?? "Retour"}
              className={classes.back}
            >
              <IconChevronLeft size={20} />
            </ActionIcon>
          )}
          <span className={classes.icon}>{icon}</span>
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Group gap="xs">
              <Title
                order={2}
                fz={{ base: 22, md: 26 }}
                className={classes.title}
              >
                {title}
              </Title>
              {badge}
              {count !== undefined && (
                <Badge size="lg" variant="filled" color="tekad">
                  {count}
                </Badge>
              )}
            </Group>
            {subtitle && (
              <Text size="sm" className={classes.description}>
                {subtitle}
              </Text>
            )}
          </Stack>
        </Group>
        {actions && (
          <Group gap="sm" align="center" className="no-print">
            {actions}
          </Group>
        )}
      </Group>
      {children}
    </Paper>
  );
}
