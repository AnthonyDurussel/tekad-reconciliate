import type { ContainerModuleLoadOptions } from "inversify";
import { EXTRACTION_TYPES } from "./types.extraction.js";
import type { IReceiptReader } from "@/extraction/application/ports/IReceiptReader.js";
import { createReceiptReader } from "@/extraction/infrastructure/ClaudeReceiptReader.js";

let shared: IReceiptReader | null = null;

export function configureExtractionContainer(
  c: ContainerModuleLoadOptions,
): void {
  c.bind(EXTRACTION_TYPES.IReceiptReader).toDynamicValue(() => {
    shared ??= createReceiptReader();
    return shared;
  });
}
