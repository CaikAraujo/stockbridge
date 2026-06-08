CREATE TABLE IF NOT EXISTS "gas_bottles" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"                text NOT NULL,
  "reference"           text NOT NULL UNIQUE,
  "gas_type_code"       text NOT NULL,
  "initial_weight_kg"   numeric(8,3) NOT NULL,
  "current_weight_kg"   numeric(8,3) NOT NULL,
  "status"              text NOT NULL DEFAULT 'available',
  "location_id"         uuid REFERENCES "locations"("id"),
  "article_id"          uuid REFERENCES "articles"("id"),
  "created_by"          uuid REFERENCES "users"("id"),
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "type"        text NOT NULL,
  "title"       text NOT NULL,
  "message"     text NOT NULL,
  "data"        jsonb NOT NULL DEFAULT '{}',
  "status"      text NOT NULL DEFAULT 'unread',
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "resolved_at" timestamp with time zone,
  "resolved_by" uuid REFERENCES "users"("id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gas_bottles_status_idx"
  ON "gas_bottles"("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gas_bottles_location_idx"
  ON "gas_bottles"("location_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_status_idx"
  ON "notifications"("status");
