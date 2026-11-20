-- AlterTable
ALTER TABLE "expense_categories" ADD COLUMN     "bexio_account_id" INTEGER;

-- AlterTable
ALTER TABLE "payment_cards" ADD COLUMN     "masked_number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_bexio_account_id_key" ON "expense_categories"("bexio_account_id");

