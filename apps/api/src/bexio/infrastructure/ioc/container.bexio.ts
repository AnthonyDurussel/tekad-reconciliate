import type { ContainerModuleLoadOptions } from "inversify";
import { BEXIO_TYPES } from "./types.bexio.js";
import type { IBexioGateway } from "@/bexio/application/ports/IBexioGateway.js";
import { createBexioGateway } from "@/bexio/infrastructure/BexioHttpGateway.js";

let shared: IBexioGateway | null = null;

export function configureBexioContainer(c: ContainerModuleLoadOptions): void {
  // Une instance par processus : le plan comptable se lit une fois.
  c.bind(BEXIO_TYPES.IBexioGateway).toDynamicValue(() => {
    shared ??= createBexioGateway();
    return shared;
  });
}
