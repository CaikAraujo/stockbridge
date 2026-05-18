ALTER TABLE "sessions" RENAME COLUMN "id" TO "session_token";--> statement-breakpoint
ALTER TABLE "sessions" RENAME COLUMN "expires_at" TO "expires";--> statement-breakpoint
DROP INDEX "sessions_expires_idx";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image" text;--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires");