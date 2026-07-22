-- Reversible delete: voiding an invoice or a line item doesn't remove the
-- row, it just stamps voided_at. Voided rows stay visible (greyed out,
-- with a restore action) but are excluded from every spend/analytics
-- query by filtering `voided_at is null` — a nullable timestamp rather
-- than a boolean so we also keep a record of *when* it was voided.
alter table public.invoices add column voided_at timestamptz;
alter table public.invoice_line_items add column voided_at timestamptz;
