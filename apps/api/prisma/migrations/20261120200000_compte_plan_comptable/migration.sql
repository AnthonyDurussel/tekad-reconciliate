-- DropIndex
DROP INDEX "payment_accounts_bexio_bank_account_id_key";

-- AlterTable
ALTER TABLE "bexio_expenses" ADD COLUMN     "bank_account_name" TEXT;

-- AlterTable
ALTER TABLE "payment_accounts" DROP COLUMN "bexio_bank_account_id";

