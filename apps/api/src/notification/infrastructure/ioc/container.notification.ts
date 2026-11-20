import type { ContainerModuleLoadOptions } from "inversify";
import { NOTIFICATION_TYPES } from "./types.notification.js";
import { sharedNotifier } from "@/notification/infrastructure/notifierFactory.js";

export function configureNotificationContainer(
  c: ContainerModuleLoadOptions,
): void {
  c.bind(NOTIFICATION_TYPES.INotifier).toDynamicValue(() => sharedNotifier());
}
