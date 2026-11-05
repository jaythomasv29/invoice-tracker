-- Carry verified issuer through new deletion jobs; legacy Business-only jobs remain retryable.
alter table public.account_deletions add column owner_issuer text;
