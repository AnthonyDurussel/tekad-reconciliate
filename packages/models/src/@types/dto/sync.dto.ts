export enum SyncSourceDTO {
  BEXIO_INBOX = "BEXIO_INBOX",
  EXTRACTION = "EXTRACTION",
  REVOLUT = "REVOLUT",
  MATCHING = "MATCHING",
}

export interface SyncRunDTO {
  id: string;
  source: SyncSourceDTO;
  startedAt: string;
  finishedAt: string | null;
  success: boolean | null;
  /** Éléments créés ou traités. */
  count: number;
  message: string | null;
  triggeredBy: string | null;
}

/** `GET sync/status` : ce qui est configuré, et le dernier passage par source. */
export interface SyncStatusDTO {
  bexioConfigured: boolean;
  revolutConfigured: boolean;
  extractionConfigured: boolean;
  last: Partial<Record<SyncSourceDTO, SyncRunDTO>>;
}

/** `POST sync/revolut` : période à relire (défaut : depuis le dernier passage, 3 jours de marge). */
export interface RevolutSyncRequestDTO {
  from?: string | null;
  to?: string | null;
}
