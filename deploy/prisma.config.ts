import { defineConfig } from "prisma/config";

/**
 * Migrations au déploiement (scripts/deploy.sh) : le schéma et les migrations
 * viennent du zip de la release (`--schema`), l'URL de DATABASE_URL (Key Vault).
 * Prisma 7 ne lit plus l'URL dans le schéma.
 */
export default defineConfig({
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
