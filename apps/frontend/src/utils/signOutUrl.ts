import type { Claim } from "@repo/models";

const TENANT_CLAIMS = [
  "tid",
  "http://schemas.microsoft.com/identity/claims/tenantid",
];
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const claim = (claims: Claim[], types: string[]) =>
  claims.find((c) => types.includes(c.typ))?.val?.trim() || undefined;

/** Le tenant du compte : claim `tid`, à défaut l'émetteur du jeton. */
function tenantOf(claims: Claim[]): string {
  const tid = claim(claims, TENANT_CLAIMS);
  if (tid && GUID.test(tid)) return tid;
  const fromIssuer = claim(claims, ["iss"])?.match(
    /login\.microsoftonline\.com\/([0-9a-f-]{36})\//i,
  )?.[1];
  return fromIssuer && GUID.test(fromIssuer) ? fromIssuer : "organizations";
}

/**
 * Déconnexion complète : Static Web Apps efface sa session (`/.auth/logout`)
 * puis renvoie vers la déconnexion Entra ID, qui ferme la session Microsoft
 * du compte — sans quoi `/` (protégé) reconnecte aussitôt la même personne.
 * `logout_hint` (claim facultatif `login_hint` de l'App Registration) évite
 * le choix du compte à déconnecter ; `client_id` (claim `aud`) fait accepter
 * le retour vers `loginPath`, déclaré comme URI de redirection
 * (`infra/scripts/entra-app.sh`).
 */
export function signOutUrl(
  claims: Claim[] | undefined,
  origin: string,
  loginPath: string,
): string {
  const list = claims ?? [];
  const entra = new URL(
    `https://login.microsoftonline.com/${tenantOf(list)}/oauth2/v2.0/logout`,
  );
  entra.searchParams.set("post_logout_redirect_uri", `${origin}${loginPath}`);
  const clientId = claim(list, ["aud"]);
  if (clientId && GUID.test(clientId))
    entra.searchParams.set("client_id", clientId);
  const hint = claim(list, ["login_hint"]);
  if (hint) entra.searchParams.set("logout_hint", hint);
  return `/.auth/logout?post_logout_redirect_uri=${encodeURIComponent(entra.toString())}`;
}
