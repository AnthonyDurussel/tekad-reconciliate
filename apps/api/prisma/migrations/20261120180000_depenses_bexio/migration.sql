-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "bexio_expense_id" TEXT,
ADD COLUMN     "bexio_file_uuid" TEXT;

-- CreateTable
CREATE TABLE "bexio_expenses" (
    "id" TEXT NOT NULL,
    "document_no" TEXT NOT NULL,
    "title" TEXT,
    "vendor" TEXT,
    "status" TEXT NOT NULL,
    "paid_on" DATE,
    "gross" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "booking_account_id" INTEGER,
    "booking_account_no" TEXT,
    "booking_account_name" TEXT,
    "bank_account_id" INTEGER,
    "bank_account_no" TEXT,
    "transaction_id" TEXT,
    "attachment_ids" TEXT[],
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bexio_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bexio_expenses_paid_on_idx" ON "bexio_expenses"("paid_on");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_bexio_expense_id_key" ON "expenses"("bexio_expense_id");

