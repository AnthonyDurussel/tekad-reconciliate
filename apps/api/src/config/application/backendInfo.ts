/**
 * Ce que le backend sait de lui-même. C'est **le serveur** qui dit
 * l'environnement (paramètre d'application `ENVIRONMENT`), pas le bundle
 * frontend, construit une fois et déployé partout. Sans paramètre :
 * `development` — jamais `production`, pour qu'un oubli fasse apparaître la
 * bannière plutôt que la cacher.
 *
 * La version est celle de la release (`APP_VERSION`, posé par
 * `deploy/scripts/deploy.sh`), à défaut celle du paquet au moment du build.
 */
export function backendInfo(env: NodeJS.ProcessEnv = process.env): {
  environment: string;
  version: string;
  commit: string | null;
} {
  const built =
    typeof __BACKEND_VERSION__ !== "undefined" && __BACKEND_VERSION__
      ? __BACKEND_VERSION__
      : "dev";
  return {
    environment: env.ENVIRONMENT?.trim() || "development",
    version: env.APP_VERSION?.trim() || built,
    commit: env.GIT_SHA?.trim() || null,
  };
}
