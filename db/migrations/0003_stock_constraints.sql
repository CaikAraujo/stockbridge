CREATE SEQUENCE IF NOT EXISTS transfer_code_seq START 1;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION next_transfer_code() RETURNS text AS $$
  SELECT 'TRF-' || to_char(NOW() AT TIME ZONE 'UTC', 'YYYY') || '-' ||
         lpad(nextval('transfer_code_seq')::text, 4, '0');
$$ LANGUAGE sql VOLATILE;
--> statement-breakpoint
ALTER TABLE stock_levels DROP CONSTRAINT IF EXISTS stock_levels_non_negative;
--> statement-breakpoint
ALTER TABLE stock_levels
  ADD CONSTRAINT stock_levels_non_negative
  CHECK (quantity >= -0.001);
--> statement-breakpoint
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_nonzero_delta;
--> statement-breakpoint
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_nonzero_delta
  CHECK (quantity_delta <> 0);
--> statement-breakpoint
ALTER TABLE transfer_items DROP CONSTRAINT IF EXISTS transfer_items_unique_article;
--> statement-breakpoint
ALTER TABLE transfer_items
  ADD CONSTRAINT transfer_items_unique_article
  UNIQUE (transfer_id, article_id);