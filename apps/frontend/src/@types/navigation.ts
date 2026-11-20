import type { PermissionDTO } from "@repo/models";

export interface NavigationItem {
  key: string;
  path: string;
  translateKey: string;
  icon: React.FC<any>;
  /** Permissions requises — au moins une suffit ; vide = aucune exigence. */
  permissions?: PermissionDTO[];
}
