CREATE TABLE IF NOT EXISTS "rapport_imports" (
  "id"                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "interfast_intervention_id" text NOT NULL UNIQUE,
  "interfast_reference"       text,
  "technicien_name"           text,
  "client_name"               text,
  "location_id"               uuid REFERENCES "locations"("id"),
  "intervention_date"         date,
  "status"                    text NOT NULL DEFAULT 'pending',
  "raw_articles"              jsonb NOT NULL DEFAULT '[]',
  "confirmed_by"              uuid REFERENCES "users"("id"),
  "confirmed_at"              timestamp with time zone,
  "created_at"                timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rapport_import_items" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "rapport_id"           uuid NOT NULL REFERENCES "rapport_imports"("id") ON DELETE CASCADE,
  "description"          text NOT NULL,
  "interfast_article_id" text,
  "supplier_code"        text,
  "quantity"             numeric(14,3) NOT NULL,
  "unit"                 text NOT NULL,
  "price_cents"          integer,
  "article_id"           uuid REFERENCES "articles"("id"),
  "movement_id"          uuid REFERENCES "stock_movements"("id"),
  "status"               text NOT NULL DEFAULT 'unmatched',
  "created_at"           timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rapport_imports_status_idx"
  ON "rapport_imports"("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rapport_import_items_rapport_idx"
  ON "rapport_import_items"("rapport_id");
