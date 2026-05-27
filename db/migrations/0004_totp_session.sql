ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "totp_verified" boolean NOT NULL DEFAULT false;
