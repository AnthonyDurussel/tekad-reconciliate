import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@generated/prisma/client.js";
import { databasePoolConfig } from "./databaseConnection.js";

// Local / scripts / migrations: DATABASE_URL (password). Azure: DATABASE_ENTRA_URL, the Function
// App's managed identity (docs/DEPLOYMENT.md).
const adapter = new PrismaPg(
  databasePoolConfig({
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_ENTRA_URL: process.env.DATABASE_ENTRA_URL,
    DATABASE_POOL_MAX: Number(process.env.DATABASE_POOL_MAX ?? 10),
  }),
  { schema: process.env.DATABASE_SCHEMA || undefined },
);

export const prisma = new PrismaClient({ adapter });
