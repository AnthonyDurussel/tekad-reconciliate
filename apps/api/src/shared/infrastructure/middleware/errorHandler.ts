import {
  FunctionHandler,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import {
  DomainError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ConflictError,
  InvalidStateError,
  InternalServerError,
  ForbiddenError,
} from "@/shared/domain/errors.js";

/**
 * Error handling middleware for Azure Functions.
 * Intercepts errors and returns appropriate HTTP status codes.
 */
export function withErrorHandler(handler: FunctionHandler): FunctionHandler {
  return async function (
    request: any,
    context: InvocationContext,
  ): Promise<HttpResponseInit> {
    try {
      const result = await handler(request, context);
      return result;
    } catch (error: any) {
      context.error(`Error in ${context.functionName}:`, error);

      // Map domain errors to HTTP status codes
      if (error instanceof ValidationError) {
        return {
          status: 400,
          jsonBody: {
            error: "Validation Error",
            message: error.message,
            details: error.cause || undefined,
          },
        };
      }

      if (error instanceof UnauthorizedError) {
        return {
          status: 401,
          jsonBody: {
            error: "Unauthorized",
            message: error.message,
          },
        };
      }

      if (error instanceof ForbiddenError) {
        return {
          status: 403,
          jsonBody: {
            error: "Forbidden",
            message: error.message,
          },
        };
      }

      if (error instanceof NotFoundError) {
        return {
          status: 404,
          jsonBody: {
            error: "Not Found",
            message: error.message,
          },
        };
      }

      if (error instanceof ConflictError) {
        return {
          status: 409,
          jsonBody: {
            error: "Conflict",
            message: error.message,
          },
        };
      }

      if (error instanceof InvalidStateError) {
        return {
          status: 409,
          jsonBody: {
            error: "Invalid State",
            message: error.message,
          },
        };
      }

      if (error instanceof InternalServerError) {
        return {
          status: 500,
          jsonBody: {
            error: "Internal Server Error",
            message: error.message,
          },
        };
      }

      // Handle generic domain errors
      if (error instanceof DomainError) {
        return {
          status: 400,
          jsonBody: {
            error: "Domain Error",
            message: error.message,
          },
        };
      }

      // Toute autre exception est un 500 générique : les cas d'usage lèvent
      // des erreurs de domaine typées, une `Error` nue est un défaut
      // d'infrastructure ou de programmation, jamais une réponse métier.
      // Default to 500 for unknown errors. Le message réel est déjà dans les
      // journaux (`context.error` ci-dessus) : le client ne reçoit qu'un corps
      // générique et l'identifiant d'invocation pour retrouver la trace — un
      // message d'exception ou un nom de fonction n'a rien à faire dans une
      // réponse HTTP (chemins, requêtes SQL, secrets d'un fournisseur…).
      return {
        status: 500,
        headers: { "x-correlation-id": context.invocationId },
        jsonBody: {
          error: "Internal server error",
          correlationId: context.invocationId,
        },
      };
    }
  };
}
