import "reflect-metadata";
import {
  Container,
  ContainerModule,
  type ContainerModuleLoadOptions,
} from "inversify";
import type { PrismaClient } from "@generated/prisma/client.js";
import { configureUserContainer } from "@/user/infrastructure/ioc/container.user.js";
import { configureNotificationContainer } from "@/notification/infrastructure/ioc/container.notification.js";
import { configureSettingsContainer } from "@/settings/infrastructure/ioc/container.settings.js";
import { configureBexioContainer } from "@/bexio/infrastructure/ioc/container.bexio.js";
import { configureAiContainer } from "@/ai/infrastructure/ioc/container.ai.js";
import { configureExtractionContainer } from "@/extraction/infrastructure/ioc/container.extraction.js";
import { configureRevolutContainer } from "@/revolut/infrastructure/ioc/container.revolut.js";
import { configureExpenseContainer } from "@/expense/infrastructure/ioc/container.expense.js";
import { configureSyncContainer } from "@/sync/infrastructure/ioc/container.sync.js";
import { configureDashboardContainer } from "@/dashboard/infrastructure/ioc/container.dashboard.js";

/**
 * Conteneur d'une requête : tout y est lié au client Prisma `tx` (la
 * transaction de la requête, ou le client partagé). Les liaisons
 * `inSingletonScope` valent donc « une instance par requête » — le compte
 * courant n'est lu qu'une fois. Tous les modules se chargent dans le même
 * conteneur : l'injection croisée fonctionne (les pièces lisent le
 * paramétrage et les transactions Revolut).
 */
export function createRequestContainer(
  parent: Container,
  tx: PrismaClient,
): Container {
  const requestContainer = new Container({ parent });
  requestContainer.load(
    new ContainerModule((options: ContainerModuleLoadOptions) => {
      options.bind<PrismaClient>("PrismaClient").toConstantValue(tx);
      configureUserContainer(options);
      configureNotificationContainer(options);
      configureSettingsContainer(options);
      configureBexioContainer(options);
      configureAiContainer(options);
      configureExtractionContainer(options);
      configureRevolutContainer(options);
      configureExpenseContainer(options);
      configureSyncContainer(options);
      configureDashboardContainer(options);
    }),
  );
  return requestContainer;
}
