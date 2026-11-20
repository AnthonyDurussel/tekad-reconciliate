import type { ContainerModuleLoadOptions } from "inversify";
import { EXTRACTION_TYPES } from "./types.extraction.js";
import type { IReceiptReader } from "@/extraction/application/ports/IReceiptReader.js";
import { OpenRouterReceiptReader } from "@/extraction/infrastructure/OpenRouterReceiptReader.js";
import { aiRuntime } from "@/ai/infrastructure/aiRuntime.js";
import { OpenRouterClient } from "@/ai/infrastructure/OpenRouterClient.js";

let shared: IReceiptReader | null = null;

export function configureExtractionContainer(
  c: ContainerModuleLoadOptions,
): void {
  c.bind(EXTRACTION_TYPES.IReceiptReader).toDynamicValue(() => {
    shared ??= new OpenRouterReceiptReader(
      () => aiRuntime().current(),
      new OpenRouterClient(),
    );
    return shared;
  });
}
