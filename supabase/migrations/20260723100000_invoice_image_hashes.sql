-- Duplicate-scan dedup — persist a SHA-256 hash of each invoice image's bytes
-- so a later re-upload of the same file can be caught for free (array overlap)
-- inside the extract-invoice edge function, before any Claude spend. Hashing
-- happens server-side in the edge function (Deno Web Crypto); this column is
-- just where the computed hashes land once a full extraction succeeds. The
-- fingerprint (re-photographed paper) layer needs no schema — it's a cheap
-- Haiku call compared against existing invoices at request time.
alter table public.invoices
  add column image_hashes text[] not null default '{}';
