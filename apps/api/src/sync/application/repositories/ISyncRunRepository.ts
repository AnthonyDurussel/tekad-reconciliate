import type { SyncRunDTO, SyncSourceDTO } from "@repo/models";

export interface ISyncRunRepository {
  start(source: SyncSourceDTO, userId: string | null): Promise<string>;
  finish(
    id: string,
    success: boolean,
    count: number,
    message: string | null,
  ): Promise<SyncRunDTO>;
  lastBySource(): Promise<Partial<Record<SyncSourceDTO, SyncRunDTO>>>;
  list(limit: number): Promise<SyncRunDTO[]>;
}
