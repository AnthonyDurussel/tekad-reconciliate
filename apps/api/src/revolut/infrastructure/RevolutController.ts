import { inject, injectable } from "inversify";
import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import { ignoreSchema } from "@repo/models";
import { parseBody } from "@/shared/infrastructure/http/parseBody.js";
import { pathId, queryString } from "@/shared/infrastructure/http/query.js";
import { queryDay } from "@/shared/infrastructure/http/period.js";
import { ok } from "@/shared/infrastructure/http/responses.js";
import { ValidationError } from "@/shared/domain/errors.js";
import { dayToDate } from "@/shared/domain/dates.js";
import { RevolutUseCases } from "@/revolut/application/usecases/RevolutUseCases.js";
import { RevolutMapper } from "@/revolut/infrastructure/RevolutMapper.js";
import { REVOLUT_TYPES } from "@/revolut/infrastructure/ioc/types.revolut.js";

const FILTERS = ["all", "missing", "matched", "ignored"] as const;

/** Lendemain d'un jour : la borne `to` est incluse. */
export const dayAfter = (day: string | undefined): Date | undefined =>
  day ? new Date(dayToDate(day)!.getTime() + 86_400_000) : undefined;

@injectable()
export class RevolutController {
  constructor(
    @inject(REVOLUT_TYPES.RevolutUseCases) private useCases: RevolutUseCases,
  ) {}

  async list(request: HttpRequest): Promise<HttpResponseInit> {
    const filter = queryString(request, "filter") ?? "all";
    if (!(FILTERS as readonly string[]).includes(filter)) {
      throw new ValidationError("query: filter invalide");
    }
    const rows = await this.useCases.list({
      from: dayToDate(queryDay(request, "from")) ?? undefined,
      to: dayAfter(queryDay(request, "to")),
      filter: filter as (typeof FILTERS)[number],
      search: queryString(request, "search"),
    });
    return ok(rows.map(RevolutMapper.toDTO));
  }

  async ignore(request: HttpRequest): Promise<HttpResponseInit> {
    const body = await parseBody(request, ignoreSchema);
    return ok(
      RevolutMapper.toDTO(
        await this.useCases.ignore(pathId(request), body.reason ?? null),
      ),
    );
  }

  async restore(request: HttpRequest): Promise<HttpResponseInit> {
    return ok(
      RevolutMapper.toDTO(await this.useCases.restore(pathId(request))),
    );
  }
}
