import { EmailClient } from "@azure/communication-email";
import { AzureKeyCredential } from "@azure/core-auth";
import type { INotifier } from "@/notification/application/INotifier.js";
import type { RenderedEmail } from "@/notification/domain/NotificationMessage.js";

/**
 * Azure Communication Email. Un message par destinataire : personne ne voit
 * l'adresse des autres, et une adresse refusée n'empêche pas les suivantes.
 */
export class AcsEmailNotifier implements INotifier {
  private client: EmailClient;

  /**
   * `endpoint` : `https://<ressource>.communication.azure.com` (réglage en
   * clair) ; `accessKey` : clé d'accès de la ressource (secret).
   */
  constructor(
    endpoint: string,
    accessKey: string,
    private senderAddress: string,
  ) {
    this.client = new EmailClient(endpoint, new AzureKeyCredential(accessKey));
  }

  isConfigured(): boolean {
    return true;
  }

  async send(email: RenderedEmail): Promise<void> {
    const failures: string[] = [];
    for (const recipient of email.to) {
      try {
        const poller = await this.client.beginSend({
          senderAddress: this.senderAddress,
          content: {
            subject: email.subject,
            html: email.html,
            plainText: email.text,
          },
          attachments: email.inlineImages?.map((image) => ({
            name: image.name,
            contentType: image.contentType,
            contentInBase64: image.contentInBase64,
            contentId: image.contentId,
          })),
          recipients: {
            to: [{ address: recipient.email, displayName: recipient.name }],
          },
        });
        await poller.pollUntilDone();
      } catch (error) {
        failures.push(`${recipient.email}: ${(error as Error).message}`);
      }
    }
    if (failures.length > 0) {
      throw new Error(`envoi ACS en échec — ${failures.join("; ")}`);
    }
  }
}
