/**
 * Conteneur racine : parent des conteneurs de requête. Les modules métier se
 * lient dans le conteneur de requête (`requestContainer.ts`), au client
 * Prisma de la requête (transactionnel ou non).
 */
import "reflect-metadata";
import { Container } from "inversify";

export const container = new Container();
