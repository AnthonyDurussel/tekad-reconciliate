import type { INotifier } from "@/notification/application/INotifier.js";
import type { RenderedEmail } from "@/notification/domain/NotificationMessage.js";
import { AcsEmailNotifier } from "@/notification/infrastructure/AcsEmailNotifier.js";
import { log } from "@/shared/infrastructure/logging/logger.js";

/** Sans messagerie configurée : l'e-mail est écrit au journal, rien n'échoue. */
export class LoggingNotifier implements INotifier {
  isConfigured(): boolean {
    return false;
  }

  async send(email: RenderedEmail): Promise<void> {
    log.info(
      `[notification] (non envoyé, ACS non configuré) → ${email.to
        .map((r) => r.email)
        .join(", ")} : ${email.subject}\n${email.text}`,
    );
  }
}

export function createNotifier(
  env: NodeJS.ProcessEnv = process.env,
): INotifier {
  const endpoint = env.ACS_ENDPOINT?.trim();
  const accessKey = env.ACS_ACCESS_KEY?.trim();
  const sender = env.ACS_SENDER_ADDRESS?.trim();
  if (endpoint && accessKey && sender) {
    return new AcsEmailNotifier(endpoint, accessKey, sender);
  }
  return new LoggingNotifier();
}

let notifier: INotifier | null = null;

/** L'adaptateur du processus, créé à la première demande. */
export function sharedNotifier(): INotifier {
  notifier ??= createNotifier();
  return notifier;
}
