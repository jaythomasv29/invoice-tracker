-- Vendor-printed line item descriptions are frequently cluttered with item
-- codes, mark codes, bracketed return-policy notes, and bilingual duplicate
-- text (e.g. "Breast Mt.Sanderson·#40·鸡胸肉·<14088 or 14080><Wayne Sanderson>").
-- raw_description keeps that verbatim for provenance/audit, but the UI and
-- any future cross-vendor price matching need a short, human-readable name.
-- The extraction model now produces both in one pass.

alter table public.invoice_line_items
  add column clean_name text;
