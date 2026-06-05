-- ─── Performance indexes ──────────────────────────────────────────────────────
-- org_id indexes already exist from baseline. These cover query-pattern columns.

-- surgeries: ordered by date, filtered by surgeon & status
CREATE INDEX IF NOT EXISTS idx_surgeries_surgery_date  ON public.surgeries(surgery_date);
CREATE INDEX IF NOT EXISTS idx_surgeries_surgeon_id    ON public.surgeries(surgeon_id);
CREATE INDEX IF NOT EXISTS idx_surgeries_status        ON public.surgeries(status);

-- composite: most common access pattern (org + date range)
CREATE INDEX IF NOT EXISTS idx_surgeries_org_date
  ON public.surgeries(org_id, surgery_date);

-- surgery_trays / surgery_consumption: joined on every surgery fetch
CREATE INDEX IF NOT EXISTS idx_surgery_trays_surgery_id
  ON public.surgery_trays(surgery_id);
CREATE INDEX IF NOT EXISTS idx_surgery_consumption_surgery_id
  ON public.surgery_consumption(surgery_id);

-- implant_lots: expiry alert scans
CREATE INDEX IF NOT EXISTS idx_implant_lots_expiration_date
  ON public.implant_lots(expiration_date);

-- audit_logs: queried by date range (grows unbounded)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs(created_at);

-- notifications: queried by read status + org
CREATE INDEX IF NOT EXISTS idx_notifications_is_read
  ON public.notifications(is_read);
