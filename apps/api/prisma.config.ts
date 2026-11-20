// Prisma 7 ne lit plus .env : variables de local.settings.json, sinon de .env (scripts/load-env.mjs).
import "./scripts/load-env.mjs";
import { defineConfig } from "prisma/config";

/**
 * Configuration des commandes Prisma (Prisma 7 : l'URL n'est plus dans le
 * schéma). `DATABASE_URL` n'est lue que par les commandes qui se connectent
 * (`migrate`…) ; `prisma generate` n'en a pas besoin.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
