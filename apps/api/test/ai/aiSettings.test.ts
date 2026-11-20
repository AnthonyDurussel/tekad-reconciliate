import { describe, expect, it } from "vitest";
import { OcrEngineDTO } from "@repo/models";
import { ValidationError } from "@/shared/domain/errors.js";
import { AesGcmSecretBox } from "@/shared/infrastructure/crypto/AesGcmSecretBox.js";
import { envAiSettings } from "@/ai/domain/aiSettings.js";
import { AiRuntime } from "@/ai/infrastructure/aiRuntime.js";
import { OpenRouterClient } from "@/ai/infrastructure/OpenRouterClient.js";
import { AiSettingsUseCases } from "@/ai/application/AiSettingsUseCases.js";
import type {
  AiSettingsRecord,
  IAiSettingsRepository,
  IOpenRouterClient,
} from "@/ai/application/ports.js";
import { User } from "@/user/domain/User.js";
import { RoleDTO } from "@repo/models";

describe("envAiSettings", () => {
  it("sans clé : rien ; avec : modèle et OCR par défaut", () => {
    expect(envAiSettings({})).toBeNull();
    expect(envAiSettings({ OPENROUTER_API_KEY: "k" })).toEqual({
      apiKey: "k",
      model: "mistralai/mistral-small-3.2-24b-instruct",
      ocrEngine: OcrEngineDTO.MISTRAL_OCR,
    });
  });
});

describe("AiRuntime", () => {
  it("ligne enregistrée › variables ; cache 30 s ; invalidation", async () => {
    let stored: Awaited<ReturnType<ConstructorParameters<typeof AiRuntime>[0]>> = undefined;
    let reads = 0;
    let now = 0;
    const runtime = new AiRuntime(
      async () => {
        reads++;
        return stored;
      },
      { OPENROUTER_API_KEY: "env-key" },
      () => now,
    );
    expect((await runtime.current())?.apiKey).toBe("env-key");
    stored = { apiKey: "db-key", model: "m/x", ocrEngine: OcrEngineDTO.PDF_TEXT };
    expect((await runtime.current())?.apiKey).toBe("env-key");
    now = 31_000;
    expect((await runtime.current())?.apiKey).toBe("db-key");
    stored = null; // désactivée
    runtime.invalidate();
    expect(await runtime.current()).toBeNull();
    expect(reads).toBe(3);
  });
});

describe("OpenRouterClient.listModels", () => {
  it("prix par million, sortie structurée, modèles texte seulement", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: "mistralai/mistral-small",
              name: "Mistral Small",
              context_length: 128000,
              pricing: { prompt: "0.0000001", completion: "0.0000003" },
              architecture: { output_modalities: ["text"] },
              supported_parameters: ["response_format", "structured_outputs"],
            },
            { id: "x/image-gen", architecture: { output_modalities: ["image"] } },
          ],
        }),
      )) as typeof fetch;
    const models = await new OpenRouterClient("https://or", fetchImpl).listModels("k");
    expect(models).toEqual([
      {
        id: "mistralai/mistral-small",
        name: "Mistral Small",
        promptPricePerM: 0.1,
        completionPricePerM: 0.3,
        contextLength: 128000,
        structuredOutputs: true,
      },
    ]);
  });

  it("une erreur d'OpenRouter devient un message lisible", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: { message: "Invalid API key" } }), {
        status: 401,
      })) as typeof fetch;
    await expect(new OpenRouterClient("https://or", fetchImpl).ping("k", "m/x")).rejects.toThrow(
      "OpenRouter a répondu 401 : Invalid API key",
    );
  });
});

describe("AiSettingsUseCases", () => {
  const box = new AesGcmSecretBox("x".repeat(40));
  const admin = User.create({ id: "u", email: "a@tekad.ch", name: "Anthony", role: RoleDTO.ADMIN });

  function setup(withBox = true) {
    let record: AiSettingsRecord | null = null;
    let invalidated = 0;
    const repository: IAiSettingsRepository = {
      find: async () => record,
      save: async (r) => {
        record = { ...r, updatedAt: new Date() };
      },
      delete: async () => {
        record = null;
      },
    };
    const pinged: string[] = [];
    const client: IOpenRouterClient = {
      listModels: async () => [],
      ping: async (apiKey, model) => {
        pinged.push(`${apiKey}|${model}`);
        if (model === "bad/model") throw new Error("No endpoints found");
      },
    };
    const useCases = new AiSettingsUseCases(
      repository,
      client,
      { current: async () => null, invalidate: () => invalidated++ },
      { settings: null, box: withBox ? box : null },
    );
    return { useCases, get: () => record, pinged, invalidated: () => invalidated };
  }

  it("scelle la clé, la garde sans nouvelle saisie, ne la rend jamais", async () => {
    const s = setup();
    const dto = await s.useCases.update(admin, {
      enabled: true,
      apiKey: "sk-or-v1-abcdef123456",
      extractionModel: "mistralai/mistral-small",
      ocrEngine: OcrEngineDTO.MISTRAL_OCR,
    });
    expect(s.get()?.apiKeySealed).not.toContain("abcdef");
    expect(box.open(s.get()!.apiKeySealed!)).toBe("sk-or-v1-abcdef123456");
    expect(dto.stored).toMatchObject({ hasApiKey: true, apiKeyHint: "…3456", apiKeyUnreadable: false });
    expect(JSON.stringify(dto)).not.toContain("abcdef123456");
    await s.useCases.update(admin, {
      enabled: true,
      extractionModel: "openai/gpt-4.1-mini",
      ocrEngine: OcrEngineDTO.PDF_TEXT,
    });
    expect(box.open(s.get()!.apiKeySealed!)).toBe("sk-or-v1-abcdef123456");
    expect(s.invalidated()).toBe(2);
    const test = await s.useCases.test({});
    expect(test).toMatchObject({ ok: true, model: "openai/gpt-4.1-mini" });
    expect(s.pinged[0]).toBe("sk-or-v1-abcdef123456|openai/gpt-4.1-mini");
    expect((await s.useCases.test({ model: "bad/model" })).message).toBe("No endpoints found");
  });

  it("sans clé ni secret du serveur : 400", async () => {
    await expect(
      setup().useCases.update(admin, { enabled: true, extractionModel: "m/x", ocrEngine: OcrEngineDTO.MISTRAL_OCR }),
    ).rejects.toThrow(ValidationError);
    await expect(
      setup(false).useCases.update(admin, {
        enabled: true,
        apiKey: "sk-or-v1-abcdef123456",
        extractionModel: "m/x",
        ocrEngine: OcrEngineDTO.MISTRAL_OCR,
      }),
    ).rejects.toThrow(/SETTINGS_ENCRYPTION_KEY/);
  });
});
