/**
 * Un e-mail de l'application, avant mise en forme : à qui, de quoi il s'agit,
 * et le lien vers l'écran concerné (chemin relatif à `APP_PUBLIC_URL`).
 */
export interface Recipient {
  email: string;
  name: string;
}

export type NotificationCategory =
  // Gestion des comptes : invitation envoyée par un administrateur
  "INVITATION";

export interface NotificationMessage {
  category: NotificationCategory;
  to: Recipient[];
  subject: string;
  heading: string;
  /** Paragraphes en texte brut (échappés à la mise en forme). */
  paragraphs: string[];
  /** Lignes d'une liste (rappels) ; une ligne peut porter un badge. */
  items?: NotificationItem[];
  /** Repères clés présentés en tableau (identifiant, rôle…). */
  facts?: NotificationFact[];
  link?: { label: string; path: string };
}

export type NotificationItem =
  string | { text: string; badge?: string; tone?: "danger" | "neutral" };

export interface NotificationFact {
  label: string;
  value: string;
}

/** Image jointe au message et citée dans le HTML par `cid:<contentId>`. */
export interface InlineImage {
  contentId: string;
  name: string;
  contentType: string;
  contentInBase64: string;
}

/** Un e-mail prêt à partir. */
export interface RenderedEmail {
  to: Recipient[];
  subject: string;
  html: string;
  text: string;
  inlineImages?: InlineImage[];
}
