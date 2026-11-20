export enum SyncSourceDTO {
  BEXIO_INBOX = "BEXIO_INBOX",
  EXTRACTION = "EXTRACTION",
  /** Import d'un relevé Revolut Business (CSV). */
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
  extractionConfigured: boolean;
  /** Date de la transaction Revolut la plus récente importée (`null` : aucun relevé). */
  revolutLatestTransaction: string | null;
  last: Partial<Record<SyncSourceDTO, SyncRunDTO>>;
}
