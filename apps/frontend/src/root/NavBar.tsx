import {
  AppShell,
  Divider,
  Group,
  NavLink,
  ScrollArea,
  Text,
} from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  adminNavigationConfig,
  navigationConfig,
} from "@/configs/navbar.config";
import type { NavigationItem } from "@/@types/navigation";
import usePermissions from "@/hooks/usePermissions";
import UserPanel from "@/components/UserPanel/UserPanel";
import styles from "./NavBar.module.css";

export default function NavBar({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { canAny } = usePermissions();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const renderLink = (item: NavigationItem) =>
    canAny(item.permissions) ? (
      <NavLink
        key={item.key}
        component={Link}
        to={item.path}
        className={styles.link}
        data-active={isActive(item.path) ? "true" : undefined}
        label={t(item.translateKey)}
        leftSection={<item.icon size={19} stroke={1.6} />}
        onClick={onNavigate}
      />
    ) : null;

  const adminLinks = adminNavigationConfig.filter((item) =>
    canAny(item.permissions),
  );

  return (
    <>
      <AppShell.Section className={styles.brand}>
        <Link to="/" onClick={onNavigate}>
          <img
            src="/logo-tekad-white.svg"
            alt="Tekad"
            className={styles.logo}
          />
        </Link>
        <div>
          <Text component="span" className={styles.appName}>
            {t("app.subtitle")}
          </Text>
        </div>
      </AppShell.Section>

      <AppShell.Section grow component={ScrollArea} px="sm">
        {navigationConfig.map(renderLink)}
        {adminLinks.length > 0 && (
          <>
            <Divider my="md" color="rgba(255,255,255,0.08)" />
            <Group gap={8} px="sm" mb={6} className={styles.sectionTitle}>
              <IconSettings size={13} />
              <Text fz={11} tt="uppercase" fw={600}>
                {t("nav.admin.main")}
              </Text>
            </Group>
            {adminLinks.map(renderLink)}
          </>
        )}
      </AppShell.Section>

      <Text fz={10.5} c="rgba(255,255,255,0.32)" ta="center" mb={6}>
        {t("app.siteLine")}
      </Text>
      <AppShell.Section px="xs" pb="xs">
        <UserPanel />
      </AppShell.Section>
    </>
  );
}
