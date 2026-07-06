CREATE TABLE "company_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"segment" text NOT NULL,
	"country" text DEFAULT 'CH' NOT NULL,
	"city" text,
	"phone" text,
	"tax_id" text,
	"employee_count" integer,
	"vehicle_count" integer,
	"contact_email" text,
	"logo_url" text,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
