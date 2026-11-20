/**
 * Garantit un compte administrateur actif : `ADMIN_EMAIL` (note 1Password
 * `…<env>.deploy`, recopiée dans le Key Vault), lancé à chaque déploiement par
 * `deploy/scripts/deploy.sh`. Crée le compte s'il manque, le remet ADMIN et
 * actif sinon. Idempotent.
 *
 *   ADMIN_EMAIL=… DATABASE_URL=… node dist/ensure-admin.cjs
 */
import "./load-env.mjs";
import { randomUUID } from "node:crypto";
import { RoleDTO } from "@repo/models";
import { prisma } from "@/shared/infrastructure/prismaClient.js";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("ADMIN_EMAIL is required");
  const name = email.split("@")[0].replace(/[._-]+/g, " ");

  const existing = await prisma.userDB.findUnique({ where: { email } });
  if (existing) {
    await prisma.userDB.update({
      where: { email },
      data: { role: RoleDTO.ADMIN, active: true },
    });
    console.log(`${email}: administrateur confirmé`);
  } else {
    await prisma.userDB.create({
      data: {
        id: randomUUID(),
        email,
        name,
        role: RoleDTO.ADMIN,
        active: true,
      },
    });
    console.log(`${email}: administrateur créé`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
