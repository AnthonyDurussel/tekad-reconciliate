import { Container } from "inversify";
import { prisma } from "../prismaClient.js";
import { PrismaClient } from "@generated/prisma/client.js";
import { createRequestContainer } from "../ioc/requestContainer.js";
import { container } from "../ioc/container.js";

/**
 * Ouvre une transaction Prisma et construit le conteneur de requête lié à
 * elle : tout ce que le handler écrit est validé ou annulé d'un bloc.
 */
export async function withPrismaTransaction<T>(
  handler: (c: Container) => Promise<T>,
  timeout: number = 30000,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      const requestContainer = createRequestContainer(
        container,
        tx as unknown as PrismaClient,
      );
      return handler(requestContainer);
    },
    { timeout, maxWait: Math.min(timeout, 30000) },
  );
}

/** Variante sans transaction : lectures, exports. */
export async function withPrisma<T>(
  handler: (c: Container) => Promise<T>,
): Promise<T> {
  return handler(createRequestContainer(container, prisma));
}
