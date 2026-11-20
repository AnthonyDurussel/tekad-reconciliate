import {
  BexioAccountTypeDTO,
  type BexioAccountDTO,
  type BexioTaxDTO,
} from "@repo/models";
import type { StoredFile } from "@/shared/application/ports/StoredFile.js";
import { ConflictError, InternalServerError } from "@/shared/domain/errors.js";
import { log } from "@/shared/infrastructure/logging/logger.js";
import type {
  BexioInboxFile,
  BexioManualEntryInput,
  IBexioGateway,
} from "@/bexio/application/ports/IBexioGateway.js";

interface BexioFileRow {
  id: number;
  name: string;
  extension?: string | null;
  mime_type?: string | null;
  is_archived?: boolean;
  created_at?: string | null;
}

interface BexioAccountRow {
  id: number;
  account_no: string | number;
  name: string;
  account_type?: number | null;
  tax_id?: number | null;
  is_active?: boolean | null;
}

interface BexioTaxRow {
  id: number;
  name?: string | null;
  code?: string | null;
  display_name?: string | null;
  value?: number | string | null;
  type?: string | null;
  is_active?: boolean | null;
}

/** `account_type` de bexio : 1 produits, 2 charges, 3 actifs, 4 passifs, 5 clôture. */
const ACCOUNT_TYPES: Record<number, BexioAccountTypeDTO> = {
  1: BexioAccountTypeDTO.EARNING,
  2: BexioAccountTypeDTO.EXPENSE,
  3: BexioAccountTypeDTO.ASSET,
  4: BexioAccountTypeDTO.LIABILITY,
  5: BexioAccountTypeDTO.CLOSING,
};

export const toBexioAccount = (r: BexioAccountRow): BexioAccountDTO => ({
  id: r.id,
  accountNo: String(r.account_no),
  name: r.name,
  type: ACCOUNT_TYPES[r.account_type ?? 0] ?? BexioAccountTypeDTO.OTHER,
  taxId: r.tax_id ?? null,
  active: r.is_active !== false,
});

export const toBexioTax = (r: BexioTaxRow): BexioTaxDTO => {
  const rate =
    r.value === null || r.value === undefined ? null : Number(r.value);
  return {
    id: r.id,
    code: r.name ?? r.code ?? String(r.id),
    label: r.display_name ?? r.name ?? String(r.id),
    rate: rate !== null && Number.isFinite(rate) ? rate : null,
    type: r.type ?? "unknown",
    active: r.is_active !== false,
  };
};

interface BexioCurrencyRow {
  id: number;
  name: string;
}

const PAGE = 100;

/**
 * Adaptateur bexio (API REST, jeton personnel `BEXIO_API_TOKEN`).
 *
 * - inbox : `GET 3.0/files?archived_state=not_archived` ;
 * - fichier : `GET 3.0/files/{id}/download` ;
 * - plan comptable : `GET 2.0/accounts` (numéro → id) ; devises `GET 3.0/currencies` ;
 * - écriture : `POST 3.0/accounting/manual_entries` (`manual_single_entry`),
 *   puis la pièce : `POST 3.0/accounting/manual_entries/{id}/entries/{entryId}/files`.
 */
export class BexioHttpGateway implements IBexioGateway {
  readonly configured = true;
  private accounts: Map<string, number> | null = null;
  private chfId: number | null = null;

  constructor(
    private token: string,
    private baseUrl = "https://api.bexio.com",
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async call(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await this.fetchImpl(`${this.baseUrl}/${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.token}`,
        ...(init.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...init.headers,
      },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      log.error(
        `[bexio] ${init.method ?? "GET"} ${path} → ${response.status} ${text}`,
      );
      throw new InternalServerError(`bexio a répondu ${response.status}`);
    }
    return response;
  }

  private async json<T>(path: string, init?: RequestInit): Promise<T> {
    return (await (await this.call(path, init)).json()) as T;
  }

  async listInboxFiles(): Promise<BexioInboxFile[]> {
    const files: BexioInboxFile[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const rows = await this.json<BexioFileRow[]>(
        `3.0/files?archived_state=not_archived&limit=${PAGE}&offset=${offset}`,
      );
      for (const row of rows) {
        if (row.is_archived) continue;
        files.push({
          id: String(row.id),
          name:
            row.extension && !row.name.endsWith(`.${row.extension}`)
              ? `${row.name}.${row.extension}`
              : row.name,
          mimeType: row.mime_type ?? null,
          createdAt: row.created_at ?? null,
        });
      }
      if (rows.length < PAGE) return files;
    }
  }

  async downloadFile(id: string): Promise<StoredFile> {
    const response = await this.call(
      `3.0/files/${encodeURIComponent(id)}/download`,
      {
        headers: { Accept: "*/*" },
      },
    );
    const disposition = response.headers.get("content-disposition") ?? "";
    const name =
      /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? `bexio-${id}`;
    return {
      fileName: name,
      mimeType:
        response.headers.get("content-type")?.split(";")[0] ??
        "application/octet-stream",
      data: Buffer.from(await response.arrayBuffer()),
    };
  }

  async listAccounts(): Promise<BexioAccountDTO[]> {
    const rows = await this.json<BexioAccountRow[]>("2.0/accounts?limit=2000");
    const accounts = rows.map(toBexioAccount);
    this.accounts = new Map(accounts.map((a) => [a.accountNo, a.id]));
    return accounts.sort((a, b) => a.accountNo.localeCompare(b.accountNo));
  }

  async listTaxes(): Promise<BexioTaxDTO[]> {
    const rows = await this.json<BexioTaxRow[]>("3.0/taxes?limit=500");
    return rows.map(toBexioTax);
  }

  private async accountId(accountNo: string): Promise<number> {
    if (!this.accounts) await this.listAccounts();
    const id = this.accounts!.get(accountNo);
    if (id === undefined) {
      throw new ConflictError(`le compte ${accountNo} n'existe pas dans bexio`);
    }
    return id;
  }

  private async chfCurrencyId(): Promise<number> {
    if (this.chfId === null) {
      const rows = await this.json<BexioCurrencyRow[]>("3.0/currencies");
      const chf = rows.find((r) => r.name === "CHF");
      if (!chf)
        throw new InternalServerError("devise CHF introuvable dans bexio");
      this.chfId = chf.id;
    }
    return this.chfId;
  }

  async createManualEntry(input: BexioManualEntryInput): Promise<string> {
    const [debit, credit, currency] = await Promise.all([
      this.accountId(input.debitAccountNo),
      this.accountId(input.creditAccountNo),
      this.chfCurrencyId(),
    ]);
    const entry = await this.json<{ id: number; entries: { id: number }[] }>(
      "3.0/accounting/manual_entries",
      {
        method: "POST",
        body: JSON.stringify({
          type: "manual_single_entry",
          date: input.date,
          reference_nr: input.reference.slice(0, 50),
          entries: [
            {
              debit_account_id: debit,
              credit_account_id: credit,
              tax_id: input.taxId ?? undefined,
              // TVA préalable : portée par le compte de charge.
              tax_account_id: input.taxId ? debit : undefined,
              description: input.description.slice(0, 255),
              amount: input.amountChf,
              currency_id: currency,
              currency_factor: 1,
            },
          ],
        }),
      },
    );
    const line = entry.entries?.[0]?.id;
    if (input.attachment && line !== undefined) {
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array(input.attachment.data)], {
          type: input.attachment.mimeType,
        }),
        input.attachment.fileName,
      );
      try {
        await this.call(
          `3.0/accounting/manual_entries/${entry.id}/entries/${line}/files`,
          { method: "POST", body: form },
        );
      } catch (error) {
        // L'écriture est passée : la pièce manquante se joint à la main.
        log.warn(`[bexio] pièce non jointe à l'écriture ${entry.id}`, error);
      }
    }
    return String(entry.id);
  }
}

/** Sans jeton : tout appel est refusé (409), rien ne part. */
export class UnconfiguredBexioGateway implements IBexioGateway {
  readonly configured = false;
  private fail(): never {
    throw new ConflictError("bexio n'est pas configuré (BEXIO_API_TOKEN)");
  }
  listInboxFiles(): Promise<BexioInboxFile[]> {
    this.fail();
  }
  downloadFile(): Promise<StoredFile> {
    this.fail();
  }
  listAccounts(): Promise<BexioAccountDTO[]> {
    this.fail();
  }
  listTaxes(): Promise<BexioTaxDTO[]> {
    this.fail();
  }
  createManualEntry(): Promise<string> {
    this.fail();
  }
}

export function createBexioGateway(
  env: NodeJS.ProcessEnv = process.env,
): IBexioGateway {
  const token = env.BEXIO_API_TOKEN?.trim();
  return token
    ? new BexioHttpGateway(token, env.BEXIO_API_URL?.trim() || undefined)
    : new UnconfiguredBexioGateway();
}
