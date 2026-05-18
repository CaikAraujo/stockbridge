-- Extensão trigram para busca por nome de artigo
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX articles_name_trgm_idx ON articles USING gin (name gin_trgm_ops);

-- FK circular users.default_location_id -> locations
ALTER TABLE users
  ADD CONSTRAINT users_default_location_fk
  FOREIGN KEY (default_location_id) REFERENCES locations(id)
  DEFERRABLE INITIALLY DEFERRED;

-- Constraint: from e to não podem ser iguais em transfers
ALTER TABLE transfers
  ADD CONSTRAINT transfers_diff_locations
  CHECK (from_location_id <> to_location_id);

-- Índice parcial para alertas de reposição
CREATE INDEX stock_levels_low_idx
  ON stock_levels (location_id, article_id)
  WHERE quantity <= 5;

-- Trigger: aplica movimento no stock_levels
CREATE OR REPLACE FUNCTION apply_stock_movement() RETURNS trigger AS $$
BEGIN
  IF NEW.voided_at IS NOT NULL THEN RETURN NEW; END IF;
  INSERT INTO stock_levels (article_id, location_id, quantity, updated_at, version)
  VALUES (NEW.article_id, NEW.location_id, NEW.quantity_delta, NOW(), 1)
  ON CONFLICT (article_id, location_id)
  DO UPDATE SET
    quantity = stock_levels.quantity + NEW.quantity_delta,
    updated_at = NOW(),
    version = stock_levels.version + 1;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_stock_movement
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();

-- Trigger: reverte movimento quando voidado
CREATE OR REPLACE FUNCTION revert_voided_movement() RETURNS trigger AS $$
BEGIN
  IF OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL THEN
    UPDATE stock_levels
      SET quantity = quantity - NEW.quantity_delta,
          updated_at = NOW(),
          version = version + 1
    WHERE article_id = NEW.article_id AND location_id = NEW.location_id;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_revert_voided_movement
  AFTER UPDATE OF voided_at ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION revert_voided_movement();
