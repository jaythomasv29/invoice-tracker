-- Invoice Intelligence — initial schema
--
-- Tenancy note: organizations, users, membership, and roles (Owner/Manager/Staff
-- per PRD section 6.1) are owned by Clerk (Clerk Organizations), not duplicated
-- here. Every table below is scoped by `organization_id`, which stores Clerk's
-- organization id (e.g. "org_2abc...") directly as text — no local
-- `organizations`/`users` tables. This is a deliberate deviation from the PRD's
-- literal section 9 table list, since Clerk already owns that data as the
-- source of truth; duplicating it in Postgres would just be a sync problem.
--
-- RLS: every policy below checks `private.current_org_id()`, which reads the
-- `org_id` claim off the Clerk-issued JWT. This requires a JWT template in the
-- Clerk dashboard (used for the Supabase third-party auth integration) that
-- includes `"org_id": "{{org.id}}"` as a claim. See README/setup notes for the
-- exact dashboard steps.

create schema if not exists private;

create or replace function private.current_org_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt()->>'org_id', '')
$$;

-- vendors ---------------------------------------------------------------

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  name text not null,
  aliases text[] not null default '{}',
  color text,
  contact_name text,
  contact_phone text,
  account_number text,
  created_at timestamptz not null default now()
);

create index vendors_org_idx on public.vendors (organization_id);

alter table public.vendors enable row level security;

create policy "vendors_tenant_isolation" on public.vendors
  for all
  using (organization_id = private.current_org_id())
  with check (organization_id = private.current_org_id());

-- items (canonical, cross-vendor catalog) --------------------------------

create table public.items (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  canonical_name text not null,
  category text,
  created_at timestamptz not null default now()
);

create index items_org_idx on public.items (organization_id);

alter table public.items enable row level security;

create policy "items_tenant_isolation" on public.items
  for all
  using (organization_id = private.current_org_id())
  with check (organization_id = private.current_org_id());

-- invoices ----------------------------------------------------------------

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  vendor_id uuid references public.vendors (id),
  image_urls text[] not null default '{}',
  invoice_number text,
  invoice_date date,
  subtotal numeric(10, 2),
  tax numeric(10, 2),
  total numeric(10, 2),
  raw_ai_response jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'scanned', 'saved')),
  source text not null default 'camera'
    check (source in ('camera', 'email_pdf')),
  extraction_model text
    check (extraction_model in ('sonnet_5', 'opus_4_8')),
  escalated boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);

create index invoices_org_idx on public.invoices (organization_id);
create index invoices_vendor_idx on public.invoices (vendor_id);

alter table public.invoices enable row level security;

create policy "invoices_tenant_isolation" on public.invoices
  for all
  using (organization_id = private.current_org_id())
  with check (organization_id = private.current_org_id());

-- invoice_line_items --------------------------------------------------------

create table public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  item_id uuid references public.items (id),
  raw_description text not null,
  qty numeric,
  unit_of_measure text,
  unit_price numeric(10, 2),
  extended_price numeric(10, 2),
  parsed_weight numeric,
  weight_source text not null default 'none'
    check (weight_source in ('structured_field', 'parsed_description', 'manual_entry', 'product_photo', 'none')),
  weight_basis text
    check (weight_basis in ('standard_pack', 'catch_weight')),
  normalized_price_per_lb numeric(10, 4),
  line_item_type text not null default 'charge'
    check (line_item_type in ('charge', 'credit')),
  category text,
  confidence numeric,
  low_confidence_fields text[] not null default '{}',
  reconciliation_status text not null default 'pending'
    check (reconciliation_status in ('pending', 'received', 'short', 'missing')),
  created_at timestamptz not null default now()
);

create index invoice_line_items_org_idx on public.invoice_line_items (organization_id);
create index invoice_line_items_invoice_idx on public.invoice_line_items (invoice_id);
create index invoice_line_items_item_idx on public.invoice_line_items (item_id);

alter table public.invoice_line_items enable row level security;

create policy "invoice_line_items_tenant_isolation" on public.invoice_line_items
  for all
  using (organization_id = private.current_org_id())
  with check (organization_id = private.current_org_id());

-- price_alerts --------------------------------------------------------------

create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  item_id uuid references public.items (id),
  vendor_id uuid references public.vendors (id),
  previous_price numeric(10, 2),
  new_price numeric(10, 2),
  unit text,
  pct_change numeric,
  read boolean not null default false,
  detected_at timestamptz not null default now()
);

create index price_alerts_org_idx on public.price_alerts (organization_id);

alter table public.price_alerts enable row level security;

create policy "price_alerts_tenant_isolation" on public.price_alerts
  for all
  using (organization_id = private.current_org_id())
  with check (organization_id = private.current_org_id());

-- delivery_disputes -----------------------------------------------------

create table public.delivery_disputes (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  line_item_id uuid not null references public.invoice_line_items (id) on delete cascade,
  status text not null default 'open'
    check (status in ('open', 'drafted', 'sent', 'resolved')),
  amount numeric(10, 2),
  draft_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index delivery_disputes_org_idx on public.delivery_disputes (organization_id);

alter table public.delivery_disputes enable row level security;

create policy "delivery_disputes_tenant_isolation" on public.delivery_disputes
  for all
  using (organization_id = private.current_org_id())
  with check (organization_id = private.current_org_id());

-- insight_briefings -------------------------------------------------------

create table public.insight_briefings (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  period_start date not null,
  period_end date not null,
  structured_data_snapshot jsonb,
  generated_text text,
  channel text check (channel in ('push', 'email')),
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index insight_briefings_org_idx on public.insight_briefings (organization_id);

alter table public.insight_briefings enable row level security;

create policy "insight_briefings_tenant_isolation" on public.insight_briefings
  for all
  using (organization_id = private.current_org_id())
  with check (organization_id = private.current_org_id());
