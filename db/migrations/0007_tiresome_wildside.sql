CREATE TABLE "gas_bottles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"reference" text NOT NULL,
	"gas_type_code" text NOT NULL,
	"initial_weight_kg" numeric(8, 3) NOT NULL,
	"current_weight_kg" numeric(8, 3) NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"location_id" uuid,
	"article_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gas_bottles_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'unread' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid
);
--> statement-breakpoint
CREATE TABLE "rapport_import_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rapport_id" uuid NOT NULL,
	"description" text NOT NULL,
	"interfast_article_id" text,
	"supplier_code" text,
	"quantity" numeric(14, 3) NOT NULL,
	"unit" text NOT NULL,
	"price_cents" integer,
	"article_id" uuid,
	"movement_id" uuid,
	"status" text DEFAULT 'unmatched' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rapport_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interfast_intervention_id" text NOT NULL,
	"interfast_reference" text,
	"technicien_name" text,
	"client_name" text,
	"location_id" uuid,
	"intervention_date" date,
	"status" text DEFAULT 'pending' NOT NULL,
	"raw_articles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rapport_imports_interfast_intervention_id_unique" UNIQUE("interfast_intervention_id")
);
--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "totp_verified" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "gas_bottles" ADD CONSTRAINT "gas_bottles_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gas_bottles" ADD CONSTRAINT "gas_bottles_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gas_bottles" ADD CONSTRAINT "gas_bottles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rapport_import_items" ADD CONSTRAINT "rapport_import_items_rapport_id_rapport_imports_id_fk" FOREIGN KEY ("rapport_id") REFERENCES "public"."rapport_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rapport_import_items" ADD CONSTRAINT "rapport_import_items_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rapport_import_items" ADD CONSTRAINT "rapport_import_items_movement_id_stock_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rapport_imports" ADD CONSTRAINT "rapport_imports_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rapport_imports" ADD CONSTRAINT "rapport_imports_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gas_bottles_status_idx" ON "gas_bottles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gas_bottles_location_idx" ON "gas_bottles" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "notifications_status_idx" ON "notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rapport_import_items_rapport_idx" ON "rapport_import_items" USING btree ("rapport_id");--> statement-breakpoint
CREATE INDEX "rapport_imports_status_idx" ON "rapport_imports" USING btree ("status");--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_non_negative" CHECK ("stock_levels"."quantity" >= 0);