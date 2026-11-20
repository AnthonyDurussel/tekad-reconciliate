import type { Container } from "inversify";
import { PermissionDTO } from "@repo/models";
import {
  route,
  type HttpRouteRegistrar,
} from "@/shared/infrastructure/http/registerRoute.js";
import { AiSettingsController } from "@/ai/infrastructure/AiSettingsController.js";
import { AI_TYPES } from "@/ai/infrastructure/ioc/types.ai.js";

const controller = (c: Container) =>
  c.get<AiSettingsController>(AI_TYPES.AiSettingsController);

/**
 * Réglages de l'IA (OpenRouter, Mistral OCR), réservés à l'administrateur
 * (`SETTINGS_MANAGE`). Hors transaction : un seul `upsert`, puis le runtime
 * de l'instance est invalidé.
 */
export function registerAiRoutes(app: HttpRouteRegistrar) {
  const access = PermissionDTO.SETTINGS_MANAGE;
  route(app, {
    name: "getAiSettings",
    methods: ["GET"],
    path: "ai/settings",
    access,
    tx: false,
    handler: (c) => controller(c).get(),
  });
  route(app, {
    name: "updateAiSettings",
    methods: ["PUT"],
    path: "ai/settings",
    access,
    tx: false,
    handler: (c, r) => controller(c).update(r),
  });
  route(app, {
    name: "resetAiSettings",
    methods: ["DELETE"],
    path: "ai/settings",
    access,
    tx: false,
    handler: (c) => controller(c).reset(),
  });
  route(app, {
    name: "listAiModels",
    methods: ["POST"],
    path: "ai/settings/models",
    access,
    tx: false,
    handler: (c, r) => controller(c).models(r),
  });
  route(app, {
    name: "testAiConnection",
    methods: ["POST"],
    path: "ai/settings/test",
    access,
    tx: false,
    handler: (c, r) => controller(c).test(r),
  });
}
