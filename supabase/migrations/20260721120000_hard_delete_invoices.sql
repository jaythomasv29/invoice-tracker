-- Invoice removal is now a real (hard) delete rather than reversible
-- voiding — line items keep the reversible voided_at behavior, but a
-- deleted invoice is gone, cascading to its invoice_line_items and
-- delivery_disputes rows via the existing "on delete cascade" FKs. The
-- invoices.voided_at column from the previous migration is unused now.
alter table public.invoices drop column voided_at;
