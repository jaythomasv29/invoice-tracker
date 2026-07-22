-- Delivery reconciliation is being simplified: instead of a three-way
-- received/missing/pending status feeding a separate "disputes" tracker
-- with dollar amounts, the confirm/save screen now just lets you mark a
-- line item missing and add a free-text note. `delivery_disputes` is left
-- in place (not dropped) since it's just unused going forward, not invalid;
-- the app stops writing to it.
alter table public.invoice_line_items add column note text;
