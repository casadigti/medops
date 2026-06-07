-- Add ars_id and nss to surgery_requests so surgeons can declare
-- the patient's insurance and social security number when requesting.

ALTER TABLE surgery_requests
  ADD COLUMN IF NOT EXISTS ars_id uuid REFERENCES ars(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nss    text;
