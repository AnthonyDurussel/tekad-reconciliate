import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconUsers,
  IconEdit,
  IconMailForward,
  IconTrash,
  IconPlus,
} from "@tabler/icons-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  RoleDTO,
  type UserDTO,
  type UserInvitationOutcomeDTO,
} from "@repo/models";
import Page from "@/components/Page";
import PageHeader from "@/components/PageHeader/PageHeader";
import {
  useCreateUserMutation,
  useGetUsersQuery,
  useSendUserInvitationMutation,
  useDeleteUserMutation,
  useGetMeQuery,
  useUpdateUserMutation,
} from "@/store/slices/api";
import EntraAccessPanel from "@/pages/admin/users/EntraAccessPanel";
import { enumOptions } from "@/utils/enumOptions";
import { getErrorMessage } from "@/utils/apiError";
import { formatDateTime } from "@/utils/format";

/**
 * Une adresse externe a été invitée dans Entra ID (sans e-mail Microsoft) :
 * on le dit, et on signale une affectation à l'application restée à faire.
 */
function notifyEntraAccess(t: TFunction, user: UserDTO) {
  const access = user.entraAccess;
  if (access?.outcome !== "GUEST_INVITED") return;
  notifications.show({
    color: "grape",
    title: t("admin.users.guestInvitedTitle"),
    message: t("admin.users.guestInvited", { email: user.email }),
    autoClose: 10_000,
  });
  if (access.assignmentError) {
    notifications.show({
      color: "orange",
      title: t("admin.users.guestAssignmentTitle"),
      message: access.assignmentError,
      autoClose: false,
    });
  }
}

/** Ce qu'est devenu l'e-mail d'invitation, dit à l'administrateur. */
function notifyInvitation(
  t: TFunction,
  outcome: UserInvitationOutcomeDTO,
  email: string,
) {
  notifications.show({
    color:
      outcome === "SENT" ? "teal" : outcome === "FAILED" ? "red" : "yellow",
    message: t(`admin.users.invitation.${outcome}`, { email }),
  });
}

/** Comptes et rôles (permissions par rôle : `ROLE_PERMISSIONS` de @repo/models). */
export default function UsersPage() {
  const { t } = useTranslation();
  const { data: users = [] } = useGetUsersQuery();
  const [updateUser] = useUpdateUserMutation();
  const [sendInvitation] = useSendUserInvitationMutation();
  const [removeUser] = useDeleteUserMutation();
  const { data: me } = useGetMeQuery();
  const confirmDelete = (user: UserDTO) =>
    modals.openConfirmModal({
      title: t("admin.users.deleteTitle"),
      children: (
        <Text size="sm">
          {t("admin.users.deleteConfirm", {
            name: user.name,
            email: user.email,
          })}
        </Text>
      ),
      labels: { confirm: t("common.delete"), cancel: t("common.cancel") },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await removeUser(user.id).unwrap();
          notifications.show({
            color: "teal",
            message: t("admin.users.deleted", { name: user.name }),
          });
        } catch (error) {
          notifications.show({ color: "red", message: getErrorMessage(error) });
        }
      },
    });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserDTO | null>(null);
  const [inviting, setInviting] = useState<string | null>(null);

  const invite = async (user: UserDTO) => {
    setInviting(user.id);
    try {
      const { outcome } = await sendInvitation(user.id).unwrap();
      notifyInvitation(t, outcome, user.email);
    } catch (error) {
      notifications.show({ color: "red", message: getErrorMessage(error) });
    } finally {
      setInviting(null);
    }
  };

  const change = async (
    user: UserDTO,
    body: {
      role?: RoleDTO;
      active?: boolean;
      notificationsEnabled?: boolean;
    },
  ) => {
    try {
      await updateUser({ id: user.id, body }).unwrap();
    } catch (error) {
      notifications.show({ color: "red", message: getErrorMessage(error) });
    }
  };

  return (
    <Page maxWidth={1200}>
      <PageHeader
        icon={<IconUsers size={22} stroke={1.7} />}
        title={t("admin.users.title")}
        subtitle={t("admin.users.subtitle")}
        count={users.length}
        actions={
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setCreating(true)}
          >
            {t("admin.users.create")}
          </Button>
        }
      />
      <EntraAccessPanel />
      <Card withBorder radius="md" p={0}>
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("admin.users.name")}</Table.Th>
              <Table.Th>{t("admin.users.email")}</Table.Th>
              <Table.Th>{t("admin.users.role")}</Table.Th>
              <Table.Th>{t("admin.users.lastSeen")}</Table.Th>
              <Table.Th>{t("admin.users.active")}</Table.Th>
              <Table.Th>{t("admin.users.notifications")}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {users.map((u) => (
              <Table.Tr key={u.id}>
                <Table.Td fw={500}>{u.name}</Table.Td>
                <Table.Td>
                  <Stack gap={2} align="flex-start">
                    <Text size="sm">{u.email}</Text>
                    {u.entraGuest && (
                      <Tooltip
                        label={t("admin.users.guestHint")}
                        multiline
                        w={260}
                      >
                        <Badge size="xs" variant="light" color="grape">
                          {t("admin.users.guest")}
                        </Badge>
                      </Tooltip>
                    )}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    w={240}
                    data={enumOptions(t, "role", RoleDTO)}
                    value={u.role}
                    allowDeselect={false}
                    onChange={(v) =>
                      v && v !== u.role && change(u, { role: v as RoleDTO })
                    }
                  />
                </Table.Td>
                <Table.Td>{formatDateTime(u.lastSeenAt)}</Table.Td>
                <Table.Td>
                  <Switch
                    checked={u.active}
                    onChange={(e) =>
                      change(u, { active: e.currentTarget.checked })
                    }
                  />
                </Table.Td>
                <Table.Td>
                  <Switch
                    checked={u.notificationsEnabled}
                    onChange={(e) =>
                      change(u, {
                        notificationsEnabled: e.currentTarget.checked,
                      })
                    }
                  />
                </Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <Tooltip label={t("common.edit")}>
                      <ActionIcon
                        variant="subtle"
                        onClick={() => setEditing(u)}
                        aria-label={t("common.edit")}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={t("admin.users.invite")}>
                      <ActionIcon
                        variant="subtle"
                        disabled={!u.active}
                        loading={inviting === u.id}
                        onClick={() => invite(u)}
                        aria-label={t("admin.users.invite")}
                      >
                        <IconMailForward size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={t("common.delete")}>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        disabled={u.id === me?.id}
                        onClick={() => confirmDelete(u)}
                        aria-label={t("common.delete")}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
      <Modal
        opened={creating}
        onClose={() => setCreating(false)}
        title={t("admin.users.create")}
      >
        {creating && <UserForm onClose={() => setCreating(false)} />}
      </Modal>
      <Modal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title={t("admin.users.edit")}
      >
        {editing && (
          <UserForm
            key={editing.id}
            user={editing}
            onClose={() => setEditing(null)}
          />
        )}
      </Modal>
    </Page>
  );
}

/** Création (avec invitation) ou modification d'un compte : e-mail, nom, rôle. */
function UserForm({ user, onClose }: { user?: UserDTO; onClose: () => void }) {
  const { t } = useTranslation();
  const [create, { isLoading: creating }] = useCreateUserMutation();
  const [update, { isLoading: updating }] = useUpdateUserMutation();
  const [sendInvitation, { isLoading: inviting }] =
    useSendUserInvitationMutation();
  const form = useForm({
    initialValues: {
      email: user?.email ?? "",
      name: user?.name ?? "",
      role: (user?.role ?? RoleDTO.VIEWER) as string,
      invite: true,
    },
    validate: {
      email: (v) =>
        /^\S+@\S+\.\S+$/.test(v.trim()) ? null : t("admin.users.emailInvalid"),
      name: (v) => (v.trim() ? null : t("common.required")),
    },
  });
  const submit = form.onSubmit(async (v) => {
    const body = {
      email: v.email.trim().toLowerCase(),
      name: v.name.trim(),
      role: v.role as RoleDTO,
    };
    try {
      if (user) {
        const updated = await update({ id: user.id, body }).unwrap();
        notifications.show({ color: "teal", message: t("common.saved") });
        notifyEntraAccess(t, updated);
        onClose();
        return;
      }
      const created = await create(body).unwrap();
      notifyEntraAccess(t, created);
      onClose();
      if (v.invite) {
        try {
          const { outcome } = await sendInvitation(created.id).unwrap();
          notifyInvitation(t, outcome, created.email);
        } catch {
          notifyInvitation(t, "FAILED", created.email);
        }
      }
    } catch (error) {
      notifications.show({ color: "red", message: getErrorMessage(error) });
    }
  });
  return (
    <form onSubmit={submit}>
      <Stack>
        <TextInput
          label={t("admin.users.email")}
          description={
            user ? t("admin.users.emailChangeHint") : t("admin.users.emailHint")
          }
          {...form.getInputProps("email")}
        />
        <TextInput
          label={t("admin.users.name")}
          {...form.getInputProps("name")}
        />
        <Select
          label={t("admin.users.role")}
          data={enumOptions(t, "role", RoleDTO)}
          allowDeselect={false}
          {...form.getInputProps("role")}
        />
        {!user && (
          <Checkbox
            label={t("admin.users.sendInvitation")}
            description={t("admin.users.sendInvitationHint")}
            {...form.getInputProps("invite", { type: "checkbox" })}
          />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={creating || updating || inviting}>
            {t("common.save")}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
