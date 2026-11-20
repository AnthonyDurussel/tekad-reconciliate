-- Les dépenses deviennent l'élément central ; la pièce (fichier de l'inbox
-- bexio + lecture) passe dans sa propre table. Les dépenses bexio ne sont
-- plus copiées : elles se lisent en direct.

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "bexio_file_id" TEXT NOT NULL,
    "bexio_file_uuid" TEXT,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extraction" JSONB,
    "extracted_at" TIMESTAMP(3),

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "receipts_bexio_file_id_key" ON "receipts"("bexio_file_id");

-- Reprise : une pièce par dépense existante (même id, plus simple à suivre).
INSERT INTO "receipts" ("id", "bexio_file_id", "bexio_file_uuid", "file_name", "mime_type", "imported_at", "extraction", "extracted_at")
SELECT "id", "bexio_file_id", "bexio_file_uuid", "file_name", "mime_type", "imported_at", "extraction", "extracted_at"
FROM "expenses";

-- AlterTable
ALTER TABLE "expenses"
ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "receipt_id" TEXT,
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'RECEIPT';

UPDATE "expenses" SET "receipt_id" = "id", "created_at" = "imported_at";

DROP INDEX "expenses_bexio_file_id_key";
ALTER TABLE "expenses" DROP COLUMN "bexio_file_id",
DROP COLUMN "bexio_file_uuid",
DROP COLUMN "extraction",
DROP COLUMN "file_name",
DROP COLUMN "imported_at",
DROP COLUMN "mime_type";

CREATE UNIQUE INDEX "expenses_receipt_id_key" ON "expenses"("receipt_id");
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropTable
DROP TABLE "bexio_expenses";
