-- CreateTable
CREATE TABLE "ai_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "provider" TEXT NOT NULL DEFAULT 'OPENROUTER',
    "api_key_sealed" TEXT,
    "api_key_hint" TEXT,
    "extraction_model" TEXT NOT NULL,
    "ocr_engine" TEXT NOT NULL DEFAULT 'mistral-ocr',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" TEXT,
    "updated_by_name" TEXT,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);
