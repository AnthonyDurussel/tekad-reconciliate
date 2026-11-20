import { useTranslation } from "react-i18next";
import {
  Badge,
  Group,
  Loader,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconBrandAzure } from "@tabler/icons-react";
import type { EntraTenantDTO } from "@repo/models";
import { useGetEntraAccessQuery } from "@/store/slices/api";

/**
 * Qui peut se connecter, lu dans l'App Registration : son audience, le
 * tenant d'origine (toujours autorisé) et les autres tenants autorisés.
 * Lecture seule : cela se règle dans Entra ID.
 */
export default function EntraAccessPanel() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useGetEntraAccessQuery();

  return (
    <Paper withBorder radius="md" p="md" mb="md">
      <Group gap="xs" mb="sm">
        <IconBrandAzure size={18} />
        <Title order={5}>{t("admin.users.entra.title")}</Title>
        {isLoading && <Loader size="xs" />}
      </Group>

      {isError ? (
        <Text size="sm" c="red">
          {t("admin.users.entra.loadError")}
        </Text>
      ) : !data ? null : !data.configured ? (
        <Text size="sm" c="dimmed">
          {t("admin.users.entra.notConfigured")}
        </Text>
      ) : (
        <Stack gap="sm">
          {data.application && (
            <Group gap="xs">
              <Text size="sm" fw={500}>
                {data.application.displayName}
              </Text>
              <Badge variant="light">
                {audienceLabel(data.application.signInAudience, t)}
              </Badge>
              {data.application.assignmentRequired && (
                <Badge variant="light" color="orange">
                  {t("admin.users.entra.assignmentRequired")}
                </Badge>
              )}
            </Group>
          )}

          <Table.ScrollContainer minWidth={500}>
            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("admin.users.entra.columns.tenant")}</Table.Th>
                  <Table.Th>{t("admin.users.entra.columns.domain")}</Table.Th>
                  <Table.Th>{t("admin.users.entra.columns.tenantId")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.homeTenant && (
                  <TenantRow
                    tenant={data.homeTenant}
                    badge={t("admin.users.entra.homeTenant")}
                  />
                )}
                {data.allowedTenants?.map((tenant) => (
                  <TenantRow key={tenant.tenantId} tenant={tenant} />
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          <Text size="xs" c="dimmed">
            {data.allowedTenants === null
              ? t("admin.users.entra.allTenants")
              : data.allowedTenants?.length
                ? t("admin.users.entra.allowedTenantsHint")
                : t("admin.users.entra.homeTenantOnly")}
          </Text>
        </Stack>
      )}
    </Paper>
  );
}

function TenantRow({
  tenant,
  badge,
}: {
  tenant: EntraTenantDTO;
  badge?: string;
}) {
  return (
    <Table.Tr>
      <Table.Td>
        <Group gap="xs">
          <Text size="sm">{tenant.displayName || "—"}</Text>
          {badge && (
            <Badge size="xs" variant="outline">
              {badge}
            </Badge>
          )}
        </Group>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{tenant.defaultDomainName || "—"}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="xs" ff="monospace">
          {tenant.tenantId}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}

function audienceLabel(audience: string, t: (key: string) => string) {
  switch (audience) {
    case "AzureADMyOrg":
      return t("admin.users.entra.audience.myOrg");
    case "AzureADMultipleOrgs":
      return t("admin.users.entra.audience.multipleOrgs");
    case "AzureADandPersonalMicrosoftAccount":
      return t("admin.users.entra.audience.withPersonal");
    case "PersonalMicrosoftAccount":
      return t("admin.users.entra.audience.personalOnly");
    default:
      return audience;
  }
}
