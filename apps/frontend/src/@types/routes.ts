import type { LazyExoticComponent, ComponentType } from "react";
import type { PermissionDTO } from "@repo/models";

export type Route = {
  key: string;
  path: string;
  component: LazyExoticComponent<ComponentType<any>>;
  /** Permissions requises — au moins une suffit ; vide = authentifié suffit. */
  permissions?: PermissionDTO[];
};
