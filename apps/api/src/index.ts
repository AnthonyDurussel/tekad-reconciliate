/**
 * Point d'entrée Azure Functions — Tekad, réconciliation des frais.
 */
import "reflect-metadata"; // doit rester le premier import (Inversify)
import { app } from "@azure/functions";
import { registerAllRoutes } from "./routes.js";
import { registerSyncTimer } from "./sync/index.functions.js";

registerAllRoutes(app);
registerSyncTimer(app);
