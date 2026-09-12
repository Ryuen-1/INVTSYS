create table if not exists public.inventory_items (
  id bigint generated always as identity primary key,
  name text not null,
  sku text,
  quantity integer not null default 0,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_sku_unique unique (sku),
  constraint inventory_items_quantity_nonnegative check (quantity >= 0)
);

grant usage on schema public to anon;
grant select on public.inventory_items to anon;

alter table public.inventory_items enable row level security;

drop policy if exists "public can read inventory items" on public.inventory_items;

create policy "public can read inventory items"
on public.inventory_items
for select
to anon
using (true);

insert into public.inventory_items (name, sku, quantity, location)
values
  ('Barcode Scanner', 'EQP-SCAN-001', 4, 'Stockroom A'),
  ('Receipt Paper Roll', 'SUP-PAPER-080', 42, 'Shelf 2'),
  ('Thermal Label Pack', 'SUP-LABEL-100', 18, 'Shelf 3')
on conflict (sku) do nothing;
