import type { RevolutApiTransaction } from "@/revolut/domain/RevolutTransaction.js";

/** Port vers Revolut Business. */
export interface IRevolutGateway {
  readonly configured: boolean;
  /** Transactions créées entre `from` et `to` (inclus), toutes pages lues. */
  listTransactions(from: Date, to: Date): Promise<RevolutApiTransaction[]>;
}
