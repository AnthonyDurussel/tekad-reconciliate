import { LocalContext } from "@/@types/model.js";
import {
  FunctionHandler,
  HttpRequest,
  InvocationContext,
} from "@azure/functions";
import { ClientPrincipal } from "@repo/models";
import { AsyncLocalStorage } from "node:async_hooks";

export const asyncLocalStorage = new AsyncLocalStorage<LocalContext>();

/**
 * Lit le principal posé par l'authentification Azure dans
 * `x-ms-client-principal` (JSON encodé en base64). Rend `null` si l'en-tête
 * est absent **ou** illisible : un en-tête forgé doit conduire à un 401,
 * jamais à une exception qui remonterait en 500.
 */
export const readUserPrincipal = (
  request: HttpRequest,
): ClientPrincipal | null => {
  const header = request.headers.get("x-ms-client-principal");
  if (!header) {
    return null;
  }
  try {
    const decoded = Buffer.from(header, "base64").toString("utf8");
    const parsed: unknown = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const principal = parsed as ClientPrincipal;
    if (typeof principal.userDetails !== "string" || !principal.userDetails) {
      return null;
    }
    return principal;
  } catch {
    return null;
  }
};

/** Principal de la requête en cours, posé par `withContext`. */
export function currentPrincipal(): ClientPrincipal | undefined {
  return asyncLocalStorage.getStore()?.userPrincipal;
}

/**
 * Exige un principal Azure (401 sinon) et l'expose au reste de la chaîne par
 * `AsyncLocalStorage`.
 */
export function withContext(handler: FunctionHandler): FunctionHandler {
  return async function (request: HttpRequest, context: InvocationContext) {
    const userPrincipal = readUserPrincipal(request);
    if (!userPrincipal) {
      context.warn("No valid user principal found in request headers");
      return { status: 401, jsonBody: { error: "Unauthorized" } };
    }
    return asyncLocalStorage.run({ context, userPrincipal }, async () => {
      try {
        return await handler(request, context);
      } catch (error) {
        context.error(`Error in ${context.functionName}:`, error);
        return {
          status: 500,
          jsonBody: {
            error: "Internal server error",
            correlationId: context.invocationId,
          },
        };
      }
    });
  };
}
