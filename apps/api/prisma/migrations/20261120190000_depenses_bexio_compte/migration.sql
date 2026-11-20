-- AlterTable
ALTER TABLE "bexio_expenses" ADD COLUMN     "payment_account_id" TEXT;

-- AlterTable
ALTER TABLE "payment_accounts" ADD COLUMN     "bexio_bank_account_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "payment_accounts_bexio_bank_account_id_key" ON "payment_accounts"("bexio_bank_account_id");

