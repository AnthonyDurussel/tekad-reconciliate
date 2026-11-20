import { describe, expect, it } from "vitest";
import {
  BookingModeDTO,
  PaymentAccountKindDTO,
  ReconciliationModeDTO,
  StatementFormatDTO,
  type PaymentAccountDTO,
} from "@repo/models";
import { importableAccounts } from "./statementAccounts";

const account = (
  id: string,
  reconciliation: ReconciliationModeDTO,
  position: number,
  active = true,
): PaymentAccountDTO => ({
  id,
  kind: PaymentAccountKindDTO.OTHER,
  name: id,
  bexioAccountNo: null,
  bookingMode: BookingModeDTO.MANUAL_ENTRY,
  reconciliation,
  statementFormat:
    reconciliation === ReconciliationModeDTO.STATEMENT_IMPORT
      ? StatementFormatDTO.REVOLUT_BUSINESS
      : null,
  revolutAccountId: null,
  position,
  active,
  cards: [],
});

describe("importableAccounts", () => {
  it("keeps the active accounts reconciled by statement import, in order", () => {
    expect(
      importableAccounts([
        account("perso", ReconciliationModeDTO.STATEMENT_IMPORT, 2),
        account("ubs", ReconciliationModeDTO.BEXIO, 0),
        account("business", ReconciliationModeDTO.STATEMENT_IMPORT, 1),
        account("old", ReconciliationModeDTO.STATEMENT_IMPORT, 3, false),
        account("cc", ReconciliationModeDTO.NONE, 4),
      ]).map((a) => a.id),
    ).toEqual(["business", "perso"]);
  });
});
