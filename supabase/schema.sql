-- Inventory Management System - Supabase schema
-- Run this in the Supabase SQL Editor before using the React app.

create type public.user_role as enum ('admin', 'manager', 'staff');
create type public.po_status as enum ('draft', 'pending', 'approved', 'received', 'cancelled');
create type public.movement_type as enum ('in', 'out', 'adjustment');

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'staff',
  branch_id uuid references public.branches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  default_supplier_id uuid references public.suppliers(id) on delete set null,
  unit_price numeric(12, 2) not null default 0,
  reorder_level integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_unit_price_nonnegative check (unit_price >= 0),
  constraint products_reorder_level_nonnegative check (reorder_level >= 0)
);

create table public.inventory_stock (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  quantity integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (product_id, branch_id),
  constraint inventory_stock_quantity_nonnegative check (quantity >= 0)
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  status public.po_status not null default 'draft',
  order_date date not null default current_date,
  expected_date date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null,
  unit_cost numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  constraint purchase_order_items_quantity_positive check (quantity > 0),
  constraint purchase_order_items_unit_cost_nonnegative check (unit_cost >= 0)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  movement_type public.movement_type not null,
  quantity integer not null,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint stock_movements_quantity_positive check (quantity > 0)
);

create index branches_name_idx on public.branches (name);
create index profiles_branch_id_idx on public.profiles (branch_id);
create index categories_name_idx on public.categories (name);
create index suppliers_name_idx on public.suppliers (name);
create index products_category_id_idx on public.products (category_id);
create index products_default_supplier_id_idx on public.products (default_supplier_id);
create index products_name_idx on public.products (name);
create index inventory_stock_product_id_idx on public.inventory_stock (product_id);
create index inventory_stock_branch_id_idx on public.inventory_stock (branch_id);
create index purchase_orders_supplier_id_idx on public.purchase_orders (supplier_id);
create index purchase_orders_branch_id_idx on public.purchase_orders (branch_id);
create index purchase_orders_created_by_idx on public.purchase_orders (created_by);
create index purchase_order_items_purchase_order_id_idx on public.purchase_order_items (purchase_order_id);
create index purchase_order_items_product_id_idx on public.purchase_order_items (product_id);
create index stock_movements_product_id_idx on public.stock_movements (product_id);
create index stock_movements_branch_id_idx on public.stock_movements (branch_id);
create index stock_movements_created_at_idx on public.stock_movements (created_at desc);
create index stock_movements_created_by_idx on public.stock_movements (created_by);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_branches_updated_at
before update on public.branches
for each row execute function public.set_updated_at();

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger set_suppliers_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger set_purchase_orders_updated_at
before update on public.purchase_orders
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'staff');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.get_my_role()
returns public.user_role
language sql
security definer
stable
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function public.get_my_branch()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select branch_id from public.profiles where id = (select auth.uid());
$$;

create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delta integer;
  current_quantity integer;
begin
  delta := case
    when new.movement_type = 'in' then new.quantity
    when new.movement_type = 'out' then -new.quantity
    else new.quantity
  end;

  select quantity
  into current_quantity
  from public.inventory_stock
  where product_id = new.product_id and branch_id = new.branch_id
  for update;

  if delta < 0 and coalesce(current_quantity, 0) + delta < 0 then
    raise exception 'Insufficient stock for product % at branch %', new.product_id, new.branch_id;
  end if;

  insert into public.inventory_stock (product_id, branch_id, quantity)
  values (new.product_id, new.branch_id, greatest(delta, 0))
  on conflict (product_id, branch_id)
  do update set
    quantity = public.inventory_stock.quantity + delta,
    updated_at = now();

  return new;
end;
$$;

create trigger apply_stock_movement_after_insert
after insert on public.stock_movements
for each row execute function public.apply_stock_movement();

alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.inventory_stock enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.stock_movements enable row level security;

grant usage on schema public to authenticated;
grant select on public.branches, public.profiles, public.categories, public.suppliers, public.products, public.inventory_stock, public.purchase_orders, public.purchase_order_items, public.stock_movements to authenticated;
grant insert, update, delete on public.branches, public.categories, public.suppliers, public.products, public.purchase_orders, public.purchase_order_items to authenticated;
grant insert on public.stock_movements to authenticated;
grant update on public.inventory_stock to authenticated;

create policy branches_select_authenticated on public.branches
for select to authenticated
using (true);

create policy branches_admin_manage on public.branches
for all to authenticated
using ((select public.get_my_role()) = 'admin')
with check ((select public.get_my_role()) = 'admin');

create policy profiles_select_own_or_admin on public.profiles
for select to authenticated
using (id = (select auth.uid()) or (select public.get_my_role()) = 'admin');

create policy profiles_admin_update on public.profiles
for update to authenticated
using ((select public.get_my_role()) = 'admin')
with check ((select public.get_my_role()) = 'admin');

create policy profiles_admin_delete on public.profiles
for delete to authenticated
using ((select public.get_my_role()) = 'admin');

create policy categories_select_authenticated on public.categories
for select to authenticated
using (true);

create policy categories_admin_manager_manage on public.categories
for all to authenticated
using ((select public.get_my_role()) in ('admin', 'manager'))
with check ((select public.get_my_role()) in ('admin', 'manager'));

create policy suppliers_select_authenticated on public.suppliers
for select to authenticated
using (true);

create policy suppliers_admin_manager_manage on public.suppliers
for all to authenticated
using ((select public.get_my_role()) in ('admin', 'manager'))
with check ((select public.get_my_role()) in ('admin', 'manager'));

create policy products_select_authenticated on public.products
for select to authenticated
using (true);

create policy products_admin_manager_manage on public.products
for all to authenticated
using ((select public.get_my_role()) in ('admin', 'manager'))
with check ((select public.get_my_role()) in ('admin', 'manager'));

create policy inventory_stock_select_scoped on public.inventory_stock
for select to authenticated
using ((select public.get_my_role()) = 'admin' or branch_id = (select public.get_my_branch()));

create policy inventory_stock_update_admin_manager on public.inventory_stock
for update to authenticated
using (
  (select public.get_my_role()) = 'admin'
  or ((select public.get_my_role()) = 'manager' and branch_id = (select public.get_my_branch()))
)
with check (
  (select public.get_my_role()) = 'admin'
  or ((select public.get_my_role()) = 'manager' and branch_id = (select public.get_my_branch()))
);

create policy purchase_orders_select_scoped on public.purchase_orders
for select to authenticated
using ((select public.get_my_role()) = 'admin' or branch_id = (select public.get_my_branch()));

create policy purchase_orders_insert_admin_manager on public.purchase_orders
for insert to authenticated
with check (
  (select public.get_my_role()) = 'admin'
  or ((select public.get_my_role()) = 'manager' and branch_id = (select public.get_my_branch()))
);

create policy purchase_orders_update_admin_manager on public.purchase_orders
for update to authenticated
using (
  (select public.get_my_role()) = 'admin'
  or ((select public.get_my_role()) = 'manager' and branch_id = (select public.get_my_branch()))
)
with check (
  (select public.get_my_role()) = 'admin'
  or ((select public.get_my_role()) = 'manager' and branch_id = (select public.get_my_branch()))
);

create policy purchase_orders_delete_admin on public.purchase_orders
for delete to authenticated
using ((select public.get_my_role()) = 'admin');

create policy purchase_order_items_select_scoped on public.purchase_order_items
for select to authenticated
using (
  exists (
    select 1
    from public.purchase_orders po
    where po.id = purchase_order_id
      and ((select public.get_my_role()) = 'admin' or po.branch_id = (select public.get_my_branch()))
  )
);

create policy purchase_order_items_manage_admin_manager on public.purchase_order_items
for all to authenticated
using (
  exists (
    select 1
    from public.purchase_orders po
    where po.id = purchase_order_id
      and (
        (select public.get_my_role()) = 'admin'
        or ((select public.get_my_role()) = 'manager' and po.branch_id = (select public.get_my_branch()))
      )
  )
)
with check (
  exists (
    select 1
    from public.purchase_orders po
    where po.id = purchase_order_id
      and (
        (select public.get_my_role()) = 'admin'
        or ((select public.get_my_role()) = 'manager' and po.branch_id = (select public.get_my_branch()))
      )
  )
);

create policy stock_movements_select_scoped on public.stock_movements
for select to authenticated
using ((select public.get_my_role()) = 'admin' or branch_id = (select public.get_my_branch()));

create policy stock_movements_insert_scoped on public.stock_movements
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (select public.get_my_role()) = 'admin'
    or branch_id = (select public.get_my_branch())
  )
);

create policy stock_movements_update_admin on public.stock_movements
for update to authenticated
using ((select public.get_my_role()) = 'admin')
with check ((select public.get_my_role()) = 'admin');

create policy stock_movements_delete_admin on public.stock_movements
for delete to authenticated
using ((select public.get_my_role()) = 'admin');

insert into public.branches (name, address)
values
  ('Main Branch', 'Primary stockroom'),
  ('Branch 2', 'Secondary location')
on conflict do nothing;

insert into public.categories (name)
values ('Equipment'), ('Supplies'), ('Parts')
on conflict (name) do nothing;

insert into public.suppliers (name, contact_person, phone, email, address)
values
  ('Default Supplier', 'Procurement Desk', null, 'supplier@example.com', 'Supplier address')
on conflict do nothing;
