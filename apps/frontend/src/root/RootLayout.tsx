import { Suspense } from "react";
import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Burger,
  Group,
  Image,
  Text,
} from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { matchPath, useLocation } from "react-router-dom";
import Views from "./Views";
import NavBar from "./NavBar";
import LoadingScreen from "@/components/loading/LoadingScreen";
import EnvironmentBanner from "@/components/EnvironmentBanner";
import { blankLayoutPaths } from "@/configs/routes.config";
import classes from "./RootLayout.module.css";
import { MobileHeaderProvider, useMobileHeader } from "./MobileHeaderContext";
import { APP_NAME } from "@/constants/app.constant";
import mobileHeaderClasses from "./MobileHeaderBar.module.css";

/**
 * Barre du haut, sur mobile seulement : burger, puis le titre de la page
 * (déclaré par `PageHeader`), ou la marque tant qu'aucune page n'en déclare ;
 * à droite, le menu « ⋯ » des actions de la page (portal de `PageHeader`).
 */
function MobileHeaderBar({
  opened,
  toggle,
}: {
  opened: boolean;
  toggle: () => void;
}) {
  const { header, triggerBack, setActionsTarget } = useMobileHeader();
  return (
    <Group
      h="100%"
      px="sm"
      gap="xs"
      wrap="nowrap"
      className={mobileHeaderClasses.bar}
    >
      <Burger opened={opened} onClick={toggle} size="sm" color="white" />
      {header?.hasBack && (
        <ActionIcon
          variant="subtle"
          color="gray.0"
          onClick={triggerBack}
          aria-label={header.backLabel ?? "Retour"}
        >
          <IconChevronLeft size={18} />
        </ActionIcon>
      )}
      <Image src="/logo-mark.svg" h={20} w="auto" alt="" />
      <Group gap={6} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
        <Text fw={600} size="sm" truncate className={mobileHeaderClasses.title}>
          {header?.title ?? APP_NAME}
        </Text>
        {header?.count !== undefined && <Badge size="sm">{header.count}</Badge>}
      </Group>
      <Box ref={setActionsTarget} ml="auto" style={{ flexShrink: 0 }} />
    </Group>
  );
}

export default function RootLayout() {
  const location = useLocation();
  const isBlank = blankLayoutPaths.some((path) =>
    matchPath(path, location.pathname),
  );
  if (isBlank) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Views />
      </Suspense>
    );
  }
  return <ShellLayout />;
}

function ShellLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  return (
    <MobileHeaderProvider>
      <AppShell
        header={{ height: 52, collapsed: false }}
        navbar={{
          width: 264,
          breakpoint: "md",
          collapsed: { mobile: !opened },
        }}
        padding={0}
        layout="alt"
      >
        <AppShell.Header hiddenFrom="md" className={classes.mobileHeader}>
          <MobileHeaderBar opened={opened} toggle={toggle} />
        </AppShell.Header>
        <AppShell.Navbar className={classes.navbar}>
          <EnvironmentBanner />
          <NavBar onNavigate={close} />
        </AppShell.Navbar>
        <AppShell.Main className={classes.main}>
          <Suspense fallback={<LoadingScreen />}>
            <Views />
          </Suspense>
        </AppShell.Main>
      </AppShell>
    </MobileHeaderProvider>
  );
}
