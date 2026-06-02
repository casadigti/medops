-- 4-state shelf facing: top | right | bottom | left
-- "facing" = the direction the FRONT of the shelf looks at (where items are accessed from)
-- back/wall side = opposite of facing

ALTER TABLE storage_shelves
  ADD COLUMN IF NOT EXISTS facing TEXT NOT NULL DEFAULT 'bottom';

-- Migrate existing orientation values
UPDATE storage_shelves SET facing = CASE
  WHEN orientation = 'vertical' THEN 'right'
  ELSE 'bottom'
END;

ALTER TABLE storage_shelves
  DROP CONSTRAINT IF EXISTS storage_shelves_facing_check;

ALTER TABLE storage_shelves
  ADD CONSTRAINT storage_shelves_facing_check
  CHECK (facing IN ('top', 'right', 'bottom', 'left'));
