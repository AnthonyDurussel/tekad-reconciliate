export const REVOLUT_TYPES = {
  IRevolutTransactionRepository: Symbol.for(
    "Revolut.IRevolutTransactionRepository",
  ),
  RevolutUseCases: Symbol.for("Revolut.RevolutUseCases"),
  RevolutController: Symbol.for("Revolut.RevolutController"),
} as const;
