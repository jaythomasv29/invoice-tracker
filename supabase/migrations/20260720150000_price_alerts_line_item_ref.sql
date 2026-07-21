-- price_alerts already existed (initial schema) shaped around the
-- not-yet-built canonical items catalog (item_id -> items, unpopulated —
-- see extract-invoice's own comments on cross-vendor matching being a
-- follow-up). Wiring real alerts now needs a display name and a way back to
-- the specific line item without that catalog, so add both directly.

alter table public.price_alerts
  add column line_item_id uuid references public.invoice_line_items (id) on delete cascade,
  add column item_name text not null default '';
