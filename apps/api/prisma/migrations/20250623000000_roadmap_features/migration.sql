-- CreateSchema
CREATE TABLE IF NOT EXISTS "filing_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "constitution" "ConstitutionType" NOT NULL,
    "form_data" JSONB NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "filing_templates_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "failure_screenshot_key" TEXT;

CREATE INDEX IF NOT EXISTS "applications_operator_id_idx" ON "applications"("operator_id");
CREATE INDEX IF NOT EXISTS "filing_templates_created_by_id_idx" ON "filing_templates"("created_by_id");

ALTER TABLE "filing_templates" ADD CONSTRAINT "filing_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
