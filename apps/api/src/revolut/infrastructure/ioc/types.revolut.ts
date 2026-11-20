export const REVOLUT_TYPES = {
  IRevolutGateway: Symbol.for("Revolut.IRevolutGateway"),
  IRevolutTransactionRepository: Symbol.for(
    "Revolut.IRevolutTransactionRepository",
  ),
  RevolutUseCases: Symbol.for("Revolut.RevolutUseCases"),
  RevolutController: Symbol.for("Revolut.RevolutController"),
} as const;
