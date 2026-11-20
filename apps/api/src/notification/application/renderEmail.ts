import type {
  NotificationCategory,
  NotificationItem,
  NotificationMessage,
  RenderedEmail,
} from "@/notification/domain/NotificationMessage.js";

/** Charte Tekad. */
const ACCENT = "#0f6e78";
const ACCENT_DARK = "#0a5058";
const ACCENT_TINT = "#e3f2f3";
const DARK = "#1d2a33";
const MUTED = "#6b7780";
const BORDER = "#e1e7eb";
const PAGE = "#f3f6f8";
const DANGER = "#c92a2a";
const DANGER_TINT = "#fdecec";
const FONT = "'Segoe UI',Rubik,Roboto,Helvetica,Arial,sans-serif";

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  INVITATION: "Accès à la plateforme",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Adresse absolue d'un écran ; sans `APP_PUBLIC_URL`, le chemin seul. */
export function absoluteLink(
  path: string,
  publicUrl: string | undefined,
): string {
  const base = (publicUrl ?? "").trim().replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

const itemOf = (item: NotificationItem) =>
  typeof item === "string" ? { text: item } : item;

function itemsHtml(items: NotificationItem[]): string {
  const rows = items
    .map(itemOf)
    .map((item, index) => {
      const danger = item.tone === "danger";
      const badge = item.badge
        ? `<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;white-space:nowrap;background:${danger ? DANGER_TINT : ACCENT_TINT};color:${danger ? DANGER : ACCENT_DARK}">${escapeHtml(item.badge)}</span>`
        : "";
      return `<tr><td style="padding:10px 14px;border-left:3px solid ${danger ? DANGER : ACCENT};${index > 0 ? `border-top:1px solid ${BORDER};` : ""}font-size:14px;line-height:1.5;color:${DARK}">${escapeHtml(item.text)}${badge}</td></tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;border:1px solid ${BORDER};border-radius:6px;border-collapse:separate;overflow:hidden">${rows}</table>`;
}

function factsHtml(facts: NonNullable<NotificationMessage["facts"]>): string {
  const rows = facts
    .map(
      (f, index) =>
        `<tr><td style="padding:8px 14px;${index > 0 ? `border-top:1px solid ${BORDER};` : ""}font-size:13px;color:${MUTED};width:34%;vertical-align:top">${escapeHtml(f.label)}</td><td style="padding:8px 14px;${index > 0 ? `border-top:1px solid ${BORDER};` : ""}font-size:14px;color:${DARK};font-weight:600;vertical-align:top">${escapeHtml(f.value)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;background:#f8fafa;border:1px solid ${BORDER};border-radius:6px;border-collapse:separate">${rows}</table>`;
}

/** Bouton « à l'épreuve des balles » : VML pour Outlook bureau, lien stylé ailleurs. */
function buttonHtml(label: string, url: string): string {
  const href = escapeHtml(url);
  const text = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px"><tr><td>
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:44px;v-text-anchor:middle;width:240px" arcsize="14%" stroke="f" fillcolor="${ACCENT}"><w:anchorlock/><center style="color:#ffffff;font-family:Segoe UI,Arial,sans-serif;font-size:15px;font-weight:bold">${text}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${href}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px">${text}&nbsp;&rarr;</a><!--<![endif]-->
</td></tr></table>`;
}

function footerReason(category: NotificationCategory): string {
  return category === "INVITATION"
    ? "Vous recevez ce message car un administrateur vous a ouvert un accès à la plateforme Tekad."
    : "Pour ne plus recevoir ces e-mails, choisissez « Ne plus recevoir les e-mails » dans le menu de votre compte.";
}

/**
 * Met un message en forme : gabarit HTML Tekad (sans image jointe :
 * `cid:`, catégorie, titre, repères, liste, bouton compatible Outlook) et sa
 * version texte. Tout contenu est échappé : remarques et noms
 * viennent des utilisateurs.
 */
export function renderEmail(
  message: NotificationMessage,
  publicUrl: string | undefined,
): RenderedEmail {
  const link = message.link
    ? {
        label: message.link.label,
        url: absoluteLink(message.link.path, publicUrl),
      }
    : null;
  const appUrl = (publicUrl ?? "").trim().replace(/\/+$/, "");
  const preheader = message.paragraphs[0] ?? message.heading;

  const paragraphs = message.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${DARK}">${escapeHtml(p)}</p>`,
    )
    .join("");
  const facts = message.facts?.length ? factsHtml(message.facts) : "";
  const items = message.items?.length ? itemsHtml(message.items) : "";
  const button = link ? buttonHtml(link.label, link.url) : "";
  const fallback = link
    ? `<p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:${MUTED}">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="${escapeHtml(link.url)}" style="color:${ACCENT_DARK};word-break:break-all">${escapeHtml(link.url)}</a></p>`
    : "";
  const appLink = appUrl
    ? ` · <a href="${escapeHtml(appUrl)}" style="color:${MUTED};text-decoration:underline">${escapeHtml(appUrl.replace(/^https?:\/\//, ""))}</a>`
    : "";

  const html = `<!doctype html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(message.subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
@media (max-width:620px){.container{width:100%!important}.px{padding-left:20px!important;padding-right:20px!important}}
a{color:${ACCENT_DARK}}
</style>
</head>
<body style="margin:0;padding:0;background:${PAGE};font-family:${FONT};color:${DARK};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE}"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px">
<tr><td style="background:#ffffff;border-radius:10px 10px 0 0;border-top:4px solid ${ACCENT};padding:24px 32px 20px" class="px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;font-size:22px;font-weight:700;color:${ACCENT};letter-spacing:.5px">Tekad</td>
<td align="right" style="vertical-align:middle;font-size:12px;line-height:1.4;color:${MUTED};text-transform:uppercase;letter-spacing:1px">Gravière<br>trajets &amp; rentabilité</td>
</tr></table>
</td></tr>
<tr><td style="background:#ffffff;padding:0 32px" class="px"><div style="height:1px;line-height:1px;font-size:1px;background:${BORDER}">&nbsp;</div></td></tr>
<tr><td style="background:#ffffff;padding:28px 32px 32px;border-radius:0 0 10px 10px" class="px">
<p style="margin:0 0 10px"><span style="display:inline-block;padding:4px 10px;border-radius:12px;background:${ACCENT_TINT};color:${ACCENT_DARK};font-size:12px;font-weight:600;letter-spacing:.3px">${escapeHtml(CATEGORY_LABEL[message.category])}</span></p>
<h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;font-weight:600;color:${DARK}">${escapeHtml(message.heading)}</h1>
${paragraphs}${facts}${items}${button}${fallback}
</td></tr>
<tr><td style="padding:24px 32px 8px;font-size:12px;line-height:1.6;color:${MUTED};text-align:center" class="px">
<p style="margin:0 0 8px"><strong style="color:${DARK}">Tekad</strong> · Réconciliation des frais${appLink}</p>
<p style="margin:0 0 8px">${escapeHtml(footerReason(message.category))}</p>
<p style="margin:0;color:#9aa4a3">Message automatique, merci de ne pas y répondre.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`;

  const text = [
    `Tekad · Réconciliation des frais — ${CATEGORY_LABEL[message.category]}`,
    "",
    message.heading,
    "",
    ...message.paragraphs.flatMap((p) => [p, ""]),
    ...(message.facts?.map((f) => `${f.label} : ${f.value}`) ?? []),
    ...(message.facts?.length ? [""] : []),
    ...(message.items
      ?.map(itemOf)
      .map((i) => `- ${i.text}${i.badge ? ` [${i.badge}]` : ""}`) ?? []),
    ...(message.items?.length ? [""] : []),
    ...(link ? [`${link.label} : ${link.url}`, ""] : []),
    "—",
    "Tekad · Réconciliation des frais",
    footerReason(message.category),
    "Message automatique, merci de ne pas y répondre.",
  ].join("\n");

  return {
    to: message.to,
    subject: message.subject,
    html,
    text,
  };
}
