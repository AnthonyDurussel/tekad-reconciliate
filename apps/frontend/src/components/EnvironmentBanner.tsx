import { Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useGetBackendInfoQuery } from "@/store/slices/api";
import useAuth from "@/hooks/useAuth";

/**
 * Bandeau « environnement non productif » : l'environnement vient du serveur
 * (`config/backend`) ; rien ne s'affiche tant que la réponse n'est pas là.
 */
export default function EnvironmentBanner() {
  const { t } = useTranslation();
  const { authenticated } = useAuth();
  const { data } = useGetBackendInfoQuery(undefined, { skip: !authenticated });
  if (!data || data.environment === "production") return null;
  return (
    <Text
      size="xs"
      fw={600}
      ta="center"
      py={4}
      bg="orange.6"
      c="white"
      tt="uppercase"
    >
      {t("app.environment", { environment: data.environment })}
    </Text>
  );
}
