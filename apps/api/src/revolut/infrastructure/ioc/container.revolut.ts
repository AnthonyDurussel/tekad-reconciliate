import type { ContainerModuleLoadOptions } from "inversify";
import { REVOLUT_TYPES } from "./types.revolut.js";
import { PrismaRevolutTransactionRepository } from "@/revolut/infrastructure/PrismaRevolutTransactionRepository.js";
import { RevolutUseCases } from "@/revolut/application/usecases/RevolutUseCases.js";
import { RevolutController } from "@/revolut/infrastructure/RevolutController.js";

export function configureRevolutContainer(c: ContainerModuleLoadOptions): void {
  c.bind(REVOLUT_TYPES.IRevolutTransactionRepository)
    .to(PrismaRevolutTransactionRepository)
    .inSingletonScope();
  c.bind(REVOLUT_TYPES.RevolutUseCases).to(RevolutUseCases).inSingletonScope();
  c.bind(REVOLUT_TYPES.RevolutController)
    .to(RevolutController)
    .inSingletonScope();
}
