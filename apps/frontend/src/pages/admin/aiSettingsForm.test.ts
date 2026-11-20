import { describe, expect, it } from "vitest";
import {
  OcrEngineDTO,
  type AiModelDTO,
  type AiSettingsDTO,
} from "@repo/models";
import {
  initialValues,
  priceLabel,
  sortModels,
  toUpdateBody,
} from "./aiSettingsForm";

const model = (
  id: string,
  structuredOutputs: boolean,
  price = 0.1,
): AiModelDTO => ({
  id,
  name: id,
  promptPricePerM: price,
  completionPricePerM: price,
  contextLength: 1000,
  structuredOutputs,
});

describe("aiSettingsForm", () => {
  it("valeurs : enregistrées, sinon environnement, sinon défaut", () => {
    expect(initialValues(undefined)).toMatchObject({
      extractionModel: "mistralai/mistral-small-3.2-24b-instruct",
      ocrEngine: OcrEngineDTO.MISTRAL_OCR,
      apiKey: "",
    });
    expect(
      initialValues({
        stored: null,
        environment: { model: "openai/gpt-4.1-mini" },
      } as AiSettingsDTO).extractionModel,
    ).toBe("openai/gpt-4.1-mini");
  });

  it("clé vide : non envoyée (la clé enregistrée reste)", () => {
    const v = {
      enabled: true,
      apiKey: "  ",
      extractionModel: " m/x ",
      ocrEngine: OcrEngineDTO.PDF_TEXT,
    };
    expect(toUpdateBody(v)).toEqual({
      enabled: true,
      extractionModel: "m/x",
      ocrEngine: OcrEngineDTO.PDF_TEXT,
    });
  });

  it("tri et prix", () => {
    expect(
      sortModels([
        model("openai/a", false),
        model("openai/b", true),
        model("mistralai/c", true),
      ]).map((m) => m.id),
    ).toEqual(["mistralai/c", "openai/b", "openai/a"]);
    expect(priceLabel(model("x/y", true, 0))).toBe("gratuit");
    expect(priceLabel(model("x/y", true, 0.1))).toBe("0.1 $ / 0.1 $");
  });
});
