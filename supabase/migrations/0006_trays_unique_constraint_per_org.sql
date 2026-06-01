-- Fix trays.code unique constraint: global → per (org_id, code)
-- Allows different orgs to have trays with the same code.

ALTER TABLE trays DROP CONSTRAINT IF EXISTS trays_code_key;
ALTER TABLE trays ADD CONSTRAINT trays_code_org_key UNIQUE (org_id, code);
