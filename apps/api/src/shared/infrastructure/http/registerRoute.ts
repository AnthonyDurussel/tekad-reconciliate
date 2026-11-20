import type {
  HttpFunctionOptions,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import type { Container } from "inversify";
import type { PermissionDTO } from "@repo/models";
import { withContext } from "@/shared/infrastructure/withContext.js";
import { withErrorHandler } from "@/shared/infrastructure/middleware/errorHandler.js";
import {
  withPrisma,
  withPrismaTransaction,
} from "@/shared/infrastructure/middleware/withTransaction.js";
import type { IAuthorizationService } from "@/user/application/services/IAuthorizationService.js";
import { USER_TYPES } from "@/user/infrastructure/ioc/types.user.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Qui peut appeler une route : une permission, une liste (« l'une de »), ou
 * `AUTHENTICATED` (tout compte actif). Il n'y a pas de valeur par défaut :
 * une route sans accès déclaré ne compile pas.
 */
export type RouteAccess = PermissionDTO | PermissionDTO[] | "AUTHENTICATED";

/** Le sous-ensemble de `app` (Azure Functions) dont l'enregistrement a besoin. */
export interface HttpRouteRegistrar {
  http(name: string, options: HttpFunctionOptions): void;
}

export interface RouteSpec {
  /** Nom de la fonction Azure (unique dans l'application). */
  name: string;
  methods: HttpMethod[];
  /** Chemin sous `/api/`, ex. `work-days/{id}/submit`. */
  path: string;
  access: RouteAccess;
  /** `true` : handler dans une transaction Prisma ; `false` : hors transaction. */
  tx: boolean;
  timeout?: number;
  handler: (
    container: Container,
    request: HttpRequest,
    context: InvocationContext,
  ) => Promise<HttpResponseInit>;
}

/** Table des routes protégées enregistrées : nom → accès (vérifiée par un test). */
export const ROUTE_ACCESS = new Map<string, RouteAccess>();

/** La spécification de chaque route protégée (test de la table des routes). */
export const ROUTE_SPECS = new Map<string, RouteSpec>();

/** Routes servies hors `withContext` (aucun principal à ce stade). */
export const PUBLIC_ROUTES = new Set<string>();

/**
 * Enregistre une route HTTP avec la pile standard : `withContext` (principal
 * Azure obligatoire, 401 sinon) → `withErrorHandler` (erreurs typées → codes
 * HTTP) → conteneur de requête → **contrôle de l'accès déclaré** (compte relu
 * en base, 403 sinon) → handler.
 */
export function route(app: HttpRouteRegistrar, spec: RouteSpec): void {
  ROUTE_ACCESS.set(spec.name, spec.access);
  ROUTE_SPECS.set(spec.name, spec);
  app.http(spec.name, {
    methods: spec.methods,
    authLevel: "anonymous",
    route: spec.path,
    handler: withContext(
      withErrorHandler(async (request, context) => {
        const run = async (container: Container) => {
          const authorization = container.get<IAuthorizationService>(
            USER_TYPES.IAuthorizationService,
          );
          await authorization.authorize(spec.access);
          return spec.handler(container, request, context);
        };
        return spec.tx
          ? withPrismaTransaction(run, spec.timeout)
          : withPrisma(run);
      }),
    ),
  });
}

/**
 * Route publique : ni principal ni contrôle de permission. Réservée à ce que
 * l'hébergeur appelle avant toute session (extracteur de rôles).
 */
export function publicRoute(
  app: HttpRouteRegistrar,
  spec: Omit<RouteSpec, "access">,
): void {
  PUBLIC_ROUTES.add(spec.name);
  app.http(spec.name, {
    methods: spec.methods,
    authLevel: "anonymous",
    route: spec.path,
    handler: withErrorHandler(async (request, context) => {
      const run = (container: Container) =>
        spec.handler(container, request, context);
      return spec.tx
        ? withPrismaTransaction(run, spec.timeout)
        : withPrisma(run);
    }),
  });
}
