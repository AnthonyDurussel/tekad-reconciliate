import { OPENROUTER_BASE_URL, type AiModelDTO } from "@repo/models";
import type { IOpenRouterClient } from "@/ai/application/ports.js";

/** Un message de chat OpenRouter (format OpenAI), contenu texte ou parties. */
export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export interface ChatRequest {
  model: string;
  messages: { role: "system" | "user"; content: string | ChatContentPart[] }[];
  max_tokens?: number;
  temperature?: number;
  response_format?: unknown;
  plugins?: unknown[];
}

interface ChatResponse {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  error?: { message?: string; code?: number };
}

interface ModelsResponse {
  data: {
    id: string;
    name?: string;
    context_length?: number;
    pricing?: { prompt?: string; completion?: string };
    architecture?: { output_modalities?: string[] };
    supported_parameters?: string[];
  }[];
}

const perMillion = (value: string | undefined) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 1_000_000 * 100) / 100 : null;
};

/**
 * Client HTTP d'OpenRouter (API compatible OpenAI). Les en-têtes
 * `HTTP-Referer` / `X-Title` nomment l'application dans le tableau de bord
 * d'OpenRouter.
 */
export class OpenRouterClient implements IOpenRouterClient {
  constructor(
    private baseUrl = OPENROUTER_BASE_URL,
    private fetchImpl: typeof fetch = fetch,
    private appUrl = process.env.APP_PUBLIC_URL?.trim() ||
      "https://www.tekad.ch",
  ) {}

  private headers(apiKey: string) {
    return {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": this.appUrl,
      "X-Title": "Tekad · Réconciliation des frais",
    };
  }

  private async fail(response: Response): Promise<never> {
    let detail = "";
    try {
      const body = (await response.json()) as ChatResponse;
      detail = body.error?.message ?? "";
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new Error(
      `OpenRouter a répondu ${response.status}${detail ? ` : ${detail.slice(0, 300)}` : ""}`,
    );
  }

  /** Le texte de la réponse ; `Error` si OpenRouter ou le modèle échoue. */
  async chat(apiKey: string, request: ChatRequest): Promise<string> {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(apiKey),
      body: JSON.stringify(request),
    });
    if (!response.ok) return this.fail(response);
    const body = (await response.json()) as ChatResponse;
    if (body.error) {
      throw new Error(
        `OpenRouter : ${body.error.message ?? "erreur du modèle"}`,
      );
    }
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("réponse vide du modèle");
    return content;
  }

  async listModels(apiKey: string): Promise<AiModelDTO[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/models`, {
      headers: this.headers(apiKey),
    });
    if (!response.ok) return this.fail(response);
    const body = (await response.json()) as ModelsResponse;
    return body.data
      .filter(
        (m) => m.architecture?.output_modalities?.includes("text") ?? true,
      )
      .map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        promptPricePerM: perMillion(m.pricing?.prompt),
        completionPricePerM: perMillion(m.pricing?.completion),
        contextLength: m.context_length ?? null,
        structuredOutputs:
          m.supported_parameters?.includes("structured_outputs") ?? false,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async ping(apiKey: string, model: string): Promise<void> {
    await this.chat(apiKey, {
      model,
      max_tokens: 16,
      messages: [{ role: "user", content: "Réponds « ok »." }],
    });
  }
}
