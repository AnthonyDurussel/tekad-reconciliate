import { inject, injectable } from "inversify";
import type { Prisma, PrismaClient } from "@generated/prisma/client.js";
import { SyncSourceDTO, type SyncRunDTO } from "@repo/models";
import type { ISyncRunRepository } from "@/sync/application/repositories/ISyncRunRepository.js";

const include = { triggered_by: { select: { name: true } } } as const;
type Row = Prisma.SyncRunDBGetPayload<{ include: typeof include }>;

const toDTO = (r: Row): SyncRunDTO => ({
  id: r.id,
  source: r.source as SyncSourceDTO,
  startedAt: r.started_at.toISOString(),
  finishedAt: r.finished_at?.toISOString() ?? null,
  success: r.success,
  count: r.count,
  message: r.message,
  triggeredBy: r.triggered_by?.name ?? null,
});

@injectable()
export class PrismaSyncRunRepository implements ISyncRunRepository {
  constructor(@inject("PrismaClient") private prisma: PrismaClient) {}

  async start(source: SyncSourceDTO, userId: string | null): Promise<string> {
    const row = await this.prisma.syncRunDB.create({
      data: { source, triggered_by_id: userId },
    });
    return row.id;
  }

  async finish(
    id: string,
    success: boolean,
    count: number,
    message: string | null,
  ) {
    const row = await this.prisma.syncRunDB.update({
      where: { id },
      data: { finished_at: new Date(), success, count, message },
      include,
    });
    return toDTO(row);
  }

  async lastBySource() {
    const result: Partial<Record<SyncSourceDTO, SyncRunDTO>> = {};
    for (const source of Object.values(SyncSourceDTO)) {
      const row = await this.prisma.syncRunDB.findFirst({
        where: { source },
        orderBy: { started_at: "desc" },
        include,
      });
      if (row) result[source] = toDTO(row);
    }
    return result;
  }

  async list(limit: number) {
    const rows = await this.prisma.syncRunDB.findMany({
      orderBy: { started_at: "desc" },
      take: limit,
      include,
    });
    return rows.map(toDTO);
  }
}
