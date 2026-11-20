export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string) {
    super(`${entity} not found`);
    this.name = "NotFoundError";
  }

  /**
   * Même erreur (404) avec un message déjà rédigé, pour les cas où le suffixe
   * « not found » ne convient pas (« Licences introuvables : a, b »,
   * « Time entry not found in timesheet »).
   */
  static withMessage(message: string): NotFoundError {
    const error = new NotFoundError("");
    error.message = message;
    return error;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(`Validation Error: ${message}`);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string) {
    super(`Unauthorized: ${message}`);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string) {
    super(`Forbidden: ${message}`);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(`Conflict: ${message}`);
    this.name = "ConflictError";
  }
}

/**
 * Garde de machine à états : l'opération est légitime mais l'agrégat n'est pas
 * dans l'état qui la permet (valider un décompte déjà facturé, arrêter un
 * minuteur qui ne tourne pas…). Répond 409 comme `ConflictError`, sans en être
 * un doublon : le message est celui du domaine, sans préfixe.
 */
export class InvalidStateError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStateError";
  }
}

export class InternalServerError extends DomainError {
  constructor(message: string) {
    super(`Internal Server Error: ${message}`);
    this.name = "InternalServerError";
  }
}
