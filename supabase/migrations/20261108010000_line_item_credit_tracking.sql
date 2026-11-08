-- Credit tracking for shorted deliveries.
--
-- A line marked missing used to stop at a pill on the invoice and a total on
-- Home. Competitors charge for the follow-up (dispute email + "was the credit
-- ever applied?"), so each missing line now carries where its credit stands:
--   null       → not followed up yet
--   requested  → a credit request was sent to the vendor
--   credited   → the vendor issued the credit; drops off the worklist
-- RLS on invoice_line_items (tenant isolation) already scopes updates.
alter table public.invoice_line_items
  add column if not exists credit_status text
    check (credit_status in ('requested', 'credited')),
  add column if not exists credit_status_at timestamptz;
