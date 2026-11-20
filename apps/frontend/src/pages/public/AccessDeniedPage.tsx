import { Button, Center, Image, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function AccessDeniedPage() {
  const { t } = useTranslation();
  return (
    <Center mih="100dvh" p="md">
      <Stack align="center" maw={440}>
        <Image src="/logo-mark-dark.svg" w={84} h="auto" alt="" darkHidden />
        <Image src="/logo-mark.svg" w={84} h="auto" alt="" lightHidden />
        <Title order={2} fw={500}>
          {t("accessDenied.title")}
        </Title>
        <Text c="dimmed" ta="center">
          {t("accessDenied.text")}
        </Text>
        <Button component={Link} to="/" variant="light">
          {t("accessDenied.back")}
        </Button>
      </Stack>
    </Center>
  );
}
