CREATE TYPE "public"."job_status" AS ENUM('open', 'in_progress', 'closed', 'cancelled');
CREATE TYPE "public"."location_type" AS ENUM('warehouse', 'truck');
CREATE TYPE "public"."movement_type" AS ENUM('consumption', 'restock', 'transfer_out', 'transfer_in', 'adjustment', 'initial', 'return');
CREATE TYPE "public"."stock_count_status" AS ENUM('draft', 'finalized', 'cancelled');
CREATE TYPE "public"."transfer_status" AS ENUM('pending', 'in_transit', 'received', 'cancelled');
CREATE TYPE "public"."unit" AS ENUM('un', 'pc', 'cx', 'kg', 'g', 'l', 'ml', 'm', 'cm', 'rl', 'par');
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'driver');
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"barcode" text,
	"name" text NOT NULL,
	"description" text,
	"unit" "unit" DEFAULT 'un' NOT NULL,
	"category_id" uuid,
	"supplier_id" uuid,
	"photo_url" text,
	"cost_price_cents" integer,
	"sale_price_cents" integer,
	"min_stock" numeric(14, 3) DEFAULT '0' NOT NULL,
	"reorder_point" numeric(14, 3) DEFAULT '0' NOT NULL,
	"refrigerant_type" text,
	"active" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_sku_unique" UNIQUE("sku"),
	CONSTRAINT "articles_barcode_unique" UNIQUE("barcode")
);

CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_uuid" uuid,
	"entity_key" text,
	"payload" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);

CREATE TABLE "idempotency_keys" (
	"key" text NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"response" jsonb,
	"status_code" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_user_id_endpoint_key_pk" PRIMARY KEY("user_id","endpoint","key")
);

CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"client_name" text NOT NULL,
	"client_address" text,
	"client_phone" text,
	"description" text,
	"status" "job_status" DEFAULT 'open' NOT NULL,
	"created_by" uuid NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_code_unique" UNIQUE("code")
);

CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" "location_type" NOT NULL,
	"assigned_user_id" uuid,
	"plate" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_code_unique" UNIQUE("code")
);

CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "stock_count_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"count_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"expected_qty" numeric(14, 3) NOT NULL,
	"counted_qty" numeric(14, 3) NOT NULL,
	"adjustment_movement_id" uuid,
	"notes" text
);

CREATE TABLE "stock_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"location_id" uuid NOT NULL,
	"performed_by" uuid NOT NULL,
	"status" "stock_count_status" DEFAULT 'draft' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finalized_at" timestamp with time zone,
	"notes" text,
	CONSTRAINT "stock_counts_code_unique" UNIQUE("code")
);

CREATE TABLE "stock_levels" (
	"article_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"reserved_quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_levels_article_id_location_id_pk" PRIMARY KEY("article_id","location_id")
);

CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"quantity_delta" numeric(14, 3) NOT NULL,
	"movement_type" "movement_type" NOT NULL,
	"transfer_id" uuid,
	"job_id" uuid,
	"unit_cost_cents" integer,
	"reason" text,
	"notes" text,
	"photo_url" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device_created_at" timestamp with time zone,
	"client_id" text,
	"app_version" text,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"void_reason" text,
	"idempotency_key" text NOT NULL
);

CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact" text,
	"phone" text,
	"email" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "transfer_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"quantity_shipped" numeric(14, 3) NOT NULL,
	"quantity_received" numeric(14, 3),
	"discrepancy_reason" text
);

CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"from_location_id" uuid NOT NULL,
	"to_location_id" uuid NOT NULL,
	"status" "transfer_status" DEFAULT 'pending' NOT NULL,
	"created_by" uuid NOT NULL,
	"shipped_by" uuid,
	"shipped_at" timestamp with time zone,
	"received_by" uuid,
	"received_at" timestamp with time zone,
	"cancelled_by" uuid,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transfers_code_unique" UNIQUE("code")
);

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"phone" text,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'driver' NOT NULL,
	"pin_hash" text,
	"totp_secret" text,
	"default_location_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

ALTER TABLE "articles" ADD CONSTRAINT "articles_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "articles" ADD CONSTRAINT "articles_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "locations" ADD CONSTRAINT "locations_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_count_id_stock_counts_id_fk" FOREIGN KEY ("count_id") REFERENCES "public"."stock_counts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_adjustment_movement_id_stock_movements_id_fk" FOREIGN KEY ("adjustment_movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_transfer_id_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_transfer_id_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_location_id_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_location_id_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_shipped_by_users_id_fk" FOREIGN KEY ("shipped_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "articles_barcode_idx" ON "articles" USING btree ("barcode");
CREATE INDEX "articles_active_name_idx" ON "articles" USING btree ("active","name");
CREATE INDEX "articles_category_idx" ON "articles" USING btree ("category_id");
CREATE INDEX "articles_supplier_idx" ON "articles" USING btree ("supplier_id");
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_uuid");
CREATE INDEX "audit_user_created_at_idx" ON "audit_log" USING btree ("user_id","created_at" DESC NULLS LAST);
CREATE INDEX "audit_created_at_idx" ON "audit_log" USING btree ("created_at" DESC NULLS LAST);
CREATE INDEX "idempotency_expires_idx" ON "idempotency_keys" USING btree ("expires_at");
CREATE INDEX "jobs_status_created_at_idx" ON "jobs" USING btree ("status","created_at" DESC NULLS LAST);
CREATE INDEX "jobs_client_name_idx" ON "jobs" USING btree ("client_name");
CREATE INDEX "jobs_created_by_idx" ON "jobs" USING btree ("created_by");
CREATE INDEX "locations_type_active_idx" ON "locations" USING btree ("type","active");
CREATE INDEX "locations_assigned_user_idx" ON "locations" USING btree ("assigned_user_id");
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");
CREATE INDEX "stock_count_items_count_idx" ON "stock_count_items" USING btree ("count_id");
CREATE INDEX "stock_count_items_article_idx" ON "stock_count_items" USING btree ("article_id");
CREATE INDEX "stock_counts_location_status_idx" ON "stock_counts" USING btree ("location_id","status");
CREATE INDEX "stock_counts_performed_by_idx" ON "stock_counts" USING btree ("performed_by");
CREATE INDEX "stock_levels_location_idx" ON "stock_levels" USING btree ("location_id");
CREATE INDEX "movements_article_location_idx" ON "stock_movements" USING btree ("article_id","location_id");
CREATE INDEX "movements_created_at_idx" ON "stock_movements" USING btree ("created_at" DESC NULLS LAST);
CREATE INDEX "movements_location_created_at_idx" ON "stock_movements" USING btree ("location_id","created_at" DESC NULLS LAST);
CREATE INDEX "movements_created_by_created_at_idx" ON "stock_movements" USING btree ("created_by","created_at" DESC NULLS LAST);
CREATE INDEX "movements_type_created_at_idx" ON "stock_movements" USING btree ("movement_type","created_at" DESC NULLS LAST);
CREATE INDEX "movements_transfer_idx" ON "stock_movements" USING btree ("transfer_id");
CREATE INDEX "movements_job_idx" ON "stock_movements" USING btree ("job_id");
CREATE UNIQUE INDEX "movements_idempotency_uniq" ON "stock_movements" USING btree ("created_by","idempotency_key");
CREATE INDEX "transfer_items_transfer_idx" ON "transfer_items" USING btree ("transfer_id");
CREATE INDEX "transfer_items_article_idx" ON "transfer_items" USING btree ("article_id");
CREATE INDEX "transfers_status_created_at_idx" ON "transfers" USING btree ("status","created_at" DESC NULLS LAST);
CREATE INDEX "transfers_from_status_idx" ON "transfers" USING btree ("from_location_id","status");
CREATE INDEX "transfers_to_status_idx" ON "transfers" USING btree ("to_location_id","status");
CREATE INDEX "users_role_active_idx" ON "users" USING btree ("role","active");
