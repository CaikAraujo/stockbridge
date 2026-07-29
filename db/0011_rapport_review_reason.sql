-- Migration 0011: adiciona coluna review_reason a rapport_import_items
-- Aplicar manualmente no Neon antes de fazer deploy.
--
-- Contexto: itens marcados como needs_review passam a guardar o motivo
-- legível (em francês) que impediu o matching ou a dedução automática.

ALTER TABLE rapport_import_items
  ADD COLUMN IF NOT EXISTS review_reason text;
