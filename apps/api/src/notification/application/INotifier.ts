import type { RenderedEmail } from "@/notification/domain/NotificationMessage.js";

/**
 * Port d'envoi des e-mails. Adaptateurs : Azure Communication Email
 * (`ACS_ENDPOINT` + `ACS_ACCESS_KEY` + `ACS_SENDER_ADDRESS`) ou, sans réglage, le
 * journal — un environnement sans messagerie ne casse rien.
 */
export interface INotifier {
  /** Faux pour l'adaptateur « journal » : rien ne part réellement. */
  isConfigured(): boolean;
  send(email: RenderedEmail): Promise<void>;
}
