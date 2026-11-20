// Variables d'environnement hors Azure Functions (Prisma CLI, seed, ensure-admin), dans cet ordre,
// sans jamais écraser une variable déjà définie :
//   1. l'environnement du processus (CI, deploy.sh, Azure) ;
//   2. les `Values` de local.settings.json (le fichier de `func start`, poste du dev) ;
//   3. .env (dotenv).
// Chargé par prisma.config.ts, scripts/seed.ts et scripts/ensure-admin.ts (aussi dans les bundles
// dist/*.cjs). Les fichiers sont cherchés dans le répertoire courant : apps/api pour `pnpm migrate`,
// `pnpm seed`…, le dossier de la release pour deploy.sh (où ils n'existent pas).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";

const root = process.cwd();

const localSettings = join(root, "local.settings.json");
if (existsSync(localSettings)) {
  const { Values = {} } = JSON.parse(readFileSync(localSettings, "utf8"));
  for (const [key, value] of Object.entries(Values))
    process.env[key] ??= String(value);
}

config({ path: join(root, ".env"), quiet: true });
