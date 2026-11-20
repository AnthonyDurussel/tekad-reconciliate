import { inject, injectable } from "inversify";
import { ROLE_LABELS, type UserInvitationDTO } from "@repo/models";
import type { INotifier } from "@/notification/application/INotifier.js";
import { renderEmail } from "@/notification/application/renderEmail.js";
import type { NotificationMessage } from "@/notification/domain/NotificationMessage.js";
import { NOTIFICATION_TYPES } from "@/notification/infrastructure/ioc/types.notification.js";
import { log } from "@/shared/infrastructure/logging/logger.js";
import type { User } from "@/user/domain/User.js";

/** Le message d'invitation d'un compte (texte brut, mis en forme par `renderEmail`). */
export function invitationMessage(user: User): NotificationMessage {
  return {
    category: "INVITATION",
    to: [{ email: user.email, name: user.name }],
    subject: "Votre accès à la plateforme Tekad",
    heading: `Bienvenue ${user.name}`,
    paragraphs: [
      "Un accès vous a été ouvert à la plateforme Tekad : réconciliation des frais Revolut, UBS et compte courant avec bexio.",
      user.entraGuest
        ? "Cliquez « Se connecter avec Microsoft » et saisissez cette adresse : si elle n'est pas un compte Microsoft, un code vous est envoyé par e-mail. À la première connexion, acceptez l'invitation de Tekad. Aucun mot de passe à créer."
        : "Connectez-vous avec votre compte Microsoft professionnel : aucun mot de passe à créer.",
    ],
    facts: [
      { label: "Identifiant", value: user.email },
      { label: "Rôle", value: ROLE_LABELS[user.role] },
    ],
    link: { label: "Ouvrir l'application", path: "/" },
  };
}

/**
 * Envoie l'e-mail d'invitation d'un compte. Ni lien à usage unique ni mot de
 * passe : l'identité vient d'Entra ID, le lien mène à la racine de
 * l'application, qui conduit à la connexion.
 *
 * Envoyé tout de suite, hors de la file des notifications : c'est le geste
 * d'un administrateur, qui veut savoir s'il est parti, et il ne dépend pas du
 * réglage « E-mails » du compte. Un échec ne lève pas : le compte existe et
 * se connecte sans ce message ; le résultat est rendu, l'envoi se refait.
 */
@injectable()
export class UserInvitationSender {
  constructor(
    @inject(NOTIFICATION_TYPES.INotifier) private notifier: INotifier,
  ) {}

  async send(
    user: User,
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<UserInvitationDTO> {
    const publicUrl = env.APP_PUBLIC_URL?.trim();
    if (!this.notifier.isConfigured() || !publicUrl) {
      log.warn(
        `[invitation] messagerie non configurée (ACS_*, APP_PUBLIC_URL) : aucune invitation envoyée à ${user.email}`,
      );
      return { outcome: "NOT_CONFIGURED" };
    }
    try {
      await this.notifier.send(renderEmail(invitationMessage(user), publicUrl));
      log.info(`[invitation] invitation envoyée à ${user.email}`);
      return { outcome: "SENT" };
    } catch (error) {
      log.error(`[invitation] échec de l'envoi à ${user.email}`, error);
      return { outcome: "FAILED" };
    }
  }
}
