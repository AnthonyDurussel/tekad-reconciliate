import {
  Avatar,
  Box,
  Group,
  Menu,
  Text,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import {
  IconBell,
  IconBellOff,
  IconLogout,
  IconMoon,
  IconSelector,
  IconSun,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/store";
import useAuth from "@/hooks/useAuth";
import LanguageSwitch from "@/components/LanguageSwitch/LanguageSwitch";
import { notifications } from "@mantine/notifications";
import {
  useGetMeQuery,
  useUpdateMyPreferencesMutation,
} from "@/store/slices/api";
import { getErrorMessage } from "@/utils/apiError";
import classes from "./UserPanel.module.css";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Pied du menu : le compte connecté ; thème, langue et déconnexion dans son sous-menu. */
export default function UserPanel() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { name, email, role } = useAppSelector((s) => s.auth.user);
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme("light");
  // Suivi : chacun active ou coupe ses e-mails (annonces, actions, rappels).
  const { data: me } = useGetMeQuery();
  const [updatePreferences] = useUpdateMyPreferencesMutation();
  const toggleNotifications = async () => {
    if (!me) return;
    const enabled = me.notificationsEnabled;
    try {
      await updatePreferences({ notificationsEnabled: !enabled }).unwrap();
      notifications.show({
        color: "teal",
        message: enabled ? t("notifications.off") : t("notifications.on"),
      });
    } catch (error) {
      notifications.show({ color: "red", message: getErrorMessage(error) });
    }
  };
  return (
    <Menu position="top-start" width={248} withinPortal>
      <Menu.Target>
        <UnstyledButton
          className={classes.target}
          aria-label={t("userMenu.label")}
        >
          <Group gap="sm" wrap="nowrap">
            <Avatar color="tekad" variant="filled" radius="xl" size={36}>
              {initials(name || email)}
            </Avatar>
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" c="white" fw={500} truncate>
                {name || email}
              </Text>
              <Text size="xs" c="rgba(255,255,255,0.55)" truncate>
                {role ? t(`enum.role.${role}`) : email}
              </Text>
            </Box>
            <IconSelector size={16} color="rgba(255,255,255,0.5)" />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{email}</Menu.Label>
        <Menu.Item
          leftSection={
            scheme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />
          }
          onClick={() => setColorScheme(scheme === "dark" ? "light" : "dark")}
        >
          {scheme === "dark" ? t("userMenu.lightMode") : t("userMenu.darkMode")}
        </Menu.Item>
        <Menu.Label>{t("userMenu.language")}</Menu.Label>
        <Box px="sm" pb={6}>
          <LanguageSwitch fullWidth />
        </Box>
        {me && (
          <Menu.Item
            leftSection={
              me.notificationsEnabled ? (
                <IconBellOff size={16} />
              ) : (
                <IconBell size={16} />
              )
            }
            onClick={toggleNotifications}
          >
            {me.notificationsEnabled
              ? t("notifications.disable")
              : t("notifications.enable")}
          </Menu.Item>
        )}
        <Menu.Divider />
        <Menu.Item leftSection={<IconLogout size={16} />} onClick={signOut}>
          {t("auth.signOut")}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Label>
          {t("userMenu.version", { version: __APP_VERSION__ })}
        </Menu.Label>
      </Menu.Dropdown>
    </Menu>
  );
}
