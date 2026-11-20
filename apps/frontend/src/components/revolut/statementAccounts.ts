import { ReconciliationModeDTO, type PaymentAccountDTO } from "@repo/models";

/** Les comptes dont on importe le relevé : actifs, rapprochés par import CSV. */
export function importableAccounts(
  accounts: readonly PaymentAccountDTO[],
): PaymentAccountDTO[] {
  return accounts
    .filter(
      (a) =>
        a.active && a.reconciliation === ReconciliationModeDTO.STATEMENT_IMPORT,
    )
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}
