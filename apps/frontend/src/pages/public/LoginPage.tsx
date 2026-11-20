import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Divider,
  Image,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconBrandWindows } from "@tabler/icons-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import appConfig from "@/configs/app.config";
import { REDIRECT_URL_KEY } from "@/constants/app.constant";
import useAuth from "@/hooks/useAuth";
import classes from "./LoginPage.module.css";

type DevAccount = { email: string; name: string; role: string };

/** Connexion Microsoft (Azure Static Web Apps) ; en dev, choix d'un compte simulé. */
export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { retrieveSSO } = useAuth();
  const redirect = params.get(REDIRECT_URL_KEY) || "/";
  const [accounts, setAccounts] = useState<DevAccount[]>([]);
  const [account, setAccount] = useState<string | null>("0");

  // Seule une session Static Web Apps réelle (`/.auth/me`) ramène dans
  // l'application : l'utilisateur mémorisé dans le navigateur peut dater
  // d'avant la déconnexion.
  useEffect(() => {
    let active = true;
    retrieveSSO().then((found) => {
      if (active && found) navigate(redirect, { replace: true });
    });
    if (import.meta.env.DEV) {
      fetch("/.auth/accounts")
        .then((r) => (r.ok ? r.json() : []))
        .then(setAccounts)
        .catch(() => setAccounts([]));
    }
    return () => {
      active = false;
    };
  }, [retrieveSSO, navigate, redirect]);

  const login = async () => {
    if (import.meta.env.DEV && accounts.length && account !== null) {
      await fetch(`/.auth/switch/${account}`);
    }
    window.location.href = `${appConfig.loginUrl}?post_login_redirect_uri=${encodeURIComponent(redirect)}`;
  };

  return (
    <div className={classes.page}>
      <aside className={classes.hero}>
        <img
          src="/logo-tekad-white.svg"
          alt="Tekad"
          className={classes.heroLogo}
        />
        <div>
          <div className={classes.heroTitle}>{t("login.heroTitle")}</div>
          <div className={classes.heroText}>{t("login.heroText")}</div>
        </div>
        <div className={classes.standards}>{t("login.standards")}</div>
      </aside>

      <main className={classes.panel}>
        <Box className={classes.form}>
          <Stack gap={6}>
            <Image
              src="/logo-tekad.svg"
              w={190}
              alt="Tekad"
              hiddenFrom="md"
              darkHidden
              mb="xl"
            />
            <Image
              src="/logo-tekad-white.svg"
              w={190}
              alt="Tekad"
              hiddenFrom="md"
              lightHidden
              mb="xl"
            />
            <Text className={classes.eyebrow}>{t("login.welcome")}</Text>
            <Title order={2} fw={600}>
              {t("login.title")}
            </Title>
            <Text size="sm" c="dimmed">
              {t("login.subtitle")}
            </Text>
          </Stack>
          {import.meta.env.DEV && accounts.length > 0 && (
            <>
              <Divider
                my="lg"
                label={t("login.devAccounts")}
                labelPosition="left"
              />
              <Select
                data={accounts.map((a, i) => ({
                  value: String(i),
                  label: `${a.name} — ${a.email}`,
                }))}
                value={account}
                onChange={setAccount}
                allowDeselect={false}
              />
            </>
          )}
          <Button
            mt="xl"
            size="md"
            fullWidth
            leftSection={<IconBrandWindows size={18} />}
            onClick={login}
          >
            {t("login.button")}
          </Button>
          <Text size="xs" c="dimmed" mt="lg">
            {t("login.footer")}
          </Text>
        </Box>
      </main>
    </div>
  );
}
