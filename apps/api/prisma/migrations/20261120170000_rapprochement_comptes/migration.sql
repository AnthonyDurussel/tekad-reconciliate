-- AlterTable
ALTER TABLE "payment_accounts" ADD COLUMN     "reconciliation" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN     "statement_format" TEXT;


-- Reprise : UBS (rapproché dans bexio) → BEXIO ; Revolut → import du relevé
-- Revolut Business ; les autres (compte courant…) → sans relevé.
UPDATE "payment_accounts" SET "reconciliation" = 'BEXIO' WHERE "booking_mode" = 'BEXIO_RECONCILIATION';
UPDATE "payment_accounts" SET "reconciliation" = 'STATEMENT_IMPORT', "statement_format" = 'REVOLUT_BUSINESS'
  WHERE "kind" = 'REVOLUT' AND "booking_mode" <> 'BEXIO_RECONCILIATION';
