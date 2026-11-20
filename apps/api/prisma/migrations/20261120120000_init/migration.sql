-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3),
    "entra_tenant_id" TEXT,
    "entra_guest" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_accounts" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bexio_account_no" TEXT,
    "booking_mode" TEXT NOT NULL DEFAULT 'MANUAL_ENTRY',
    "revolut_account_id" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_cards" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "label" TEXT,
    "holder" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "payment_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "bexio_account_no" TEXT NOT NULL,
    "bexio_tax_id" INTEGER,
    "vat_rate" DECIMAL(5,2),
    "keywords" TEXT[],
    "mcc_codes" TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "bexio_file_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" DATE,
    "merchant" TEXT,
    "description" TEXT,
    "total_amount" DECIMAL(12,2),
    "currency" TEXT,
    "vat_amount" DECIMAL(12,2),
    "vat_rate" DECIMAL(5,2),
    "card_last4" TEXT,
    "payment_method" TEXT,
    "extraction" JSONB,
    "extracted_at" TIMESTAMP(3),
    "manual_fields" TEXT[],
    "payment_account_id" TEXT,
    "payment_account_source" TEXT,
    "category_id" TEXT,
    "category_source" TEXT,
    "debit_account_no" TEXT,
    "credit_account_no" TEXT,
    "bexio_tax_id" INTEGER,
    "bexio_entry_id" TEXT,
    "booked_at" TIMESTAMP(3),
    "booked_by_id" TEXT,
    "note" TEXT,
    "ignore_reason" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revolut_transactions" (
    "id" TEXT NOT NULL,
    "revolut_id" TEXT NOT NULL,
    "leg_id" TEXT NOT NULL,
    "revolut_account_id" TEXT NOT NULL,
    "payment_account_id" TEXT,
    "type" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "merchant_name" TEXT,
    "merchant_city" TEXT,
    "merchant_country" TEXT,
    "mcc" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "bill_amount" DECIMAL(12,2),
    "bill_currency" TEXT,
    "card_last4" TEXT,
    "requires_receipt" BOOLEAN NOT NULL,
    "expense_id" TEXT,
    "ignored" BOOLEAN NOT NULL DEFAULT false,
    "ignore_reason" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revolut_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "success" BOOLEAN,
    "count" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "triggered_by_id" TEXT,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "payment_accounts_name_key" ON "payment_accounts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "payment_accounts_revolut_account_id_key" ON "payment_accounts"("revolut_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_cards_last4_key" ON "payment_cards"("last4");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_code_key" ON "expense_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_bexio_file_id_key" ON "expenses"("bexio_file_id");

-- CreateIndex
CREATE INDEX "expenses_status_idx" ON "expenses"("status");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE UNIQUE INDEX "revolut_transactions_expense_id_key" ON "revolut_transactions"("expense_id");

-- CreateIndex
CREATE INDEX "revolut_transactions_occurred_at_idx" ON "revolut_transactions"("occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "revolut_transactions_revolut_id_leg_id_key" ON "revolut_transactions"("revolut_id", "leg_id");

-- CreateIndex
CREATE INDEX "sync_runs_source_started_at_idx" ON "sync_runs"("source", "started_at");

-- AddForeignKey
ALTER TABLE "payment_cards" ADD CONSTRAINT "payment_cards_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "payment_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "payment_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revolut_transactions" ADD CONSTRAINT "revolut_transactions_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "payment_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revolut_transactions" ADD CONSTRAINT "revolut_transactions_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

