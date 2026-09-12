# Inventory System Build Plan (Supabase + React)
### For beginners — day-by-day, with recheck steps

This is a complete, self-contained guide. You don't need to know Supabase beforehand — every click is explained. Each day ends with a **Recheck** section: don't move to the next day until those checks pass.

**Tools you need before starting:**
- A free Supabase account → https://supabase.com
- Node.js installed on your computer → https://nodejs.org (LTS version)
- VS Code → https://code.visualstudio.com
- An AI assistant open in VS Code (Claude, Copilot, or ChatGPT) to paste the prompts into

---

## DAY 1 — Accounts, Project Setup & React App

### 🎯 Goal
Get your Supabase project running and your React app created and talking to each other.

### 🛠️ Steps
1. Go to https://supabase.com → Sign up (or log in) → click **"New Project"**.
2. Fill in: Project name (e.g. `inventory-system`), a database password (save this somewhere safe), and pick a region close to you.
3. Wait 1-2 minutes while Supabase provisions your project.
4. Once ready, go to **Project Settings → API**. You will see:
   - **Project URL**
   - **anon public key**
   
   Copy both — you'll need them shortly.
5. On your computer, open a terminal and create the React app:
   ```bash
   npm create vite@latest inventory-app -- --template react
   cd inventory-app
   npm install
   npm install @supabase/supabase-js
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```
6. Create a file `.env` in your project root:
   ```
   VITE_SUPABASE_URL=your_project_url_here
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

### 🤖 AI Prompt for today
```
Using Vite + React, set up a Supabase client in a file called supabaseClient.js 
using environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. 
Also configure Tailwind CSS for this project (tailwind.config.js and index.css).
```

### ✅ Recheck before moving on
- [x] `npm run dev` starts the app without errors and opens in the browser.
- [x] `.env` file has your real URL and anon key (not placeholders).
- [x] App styling is configured and included in the Vite build. Note: this project uses `src/styles.css` instead of Tailwind.

---

## DAY 2 — Database Schema & Your First Admin Account

### 🎯 Goal
Create all your database tables, security rules, and your first Admin login.

### 🛠️ Steps
1. In Supabase, go to **SQL Editor** (left sidebar) → **New Query**.
2. Paste the ENTIRE script below → click **Run**.

```sql
-- ============================================================
-- INVENTORY MANAGEMENT SYSTEM - SUPABASE SCHEMA
-- Multi-branch + Suppliers + Purchase Orders + Role-based access
-- ============================================================

-- 1. ENUM TYPES
create type user_role as enum ('admin', 'manager', 'staff');
create type po_status as enum ('draft', 'pending', 'approved', 'received', 'cancelled');
create type movement_type as enum ('in', 'out', 'adjustment');

-- 2. CORE TABLES
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role user_role not null default 'staff',
  branch_id uuid references public.branches(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  default_supplier_id uuid references public.suppliers(id) on delete set null,
  unit_price numeric(12,2) not null default 0,
  reorder_level integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.inventory_stock (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  quantity integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (product_id, branch_id)
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  status po_status not null default 'draft',
  order_date date not null default current_date,
  expected_date date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12,2) not null default 0
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  movement_type movement_type not null,
  quantity integer not null check (quantity > 0),
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 3. AUTO-UPDATE STOCK WHEN A MOVEMENT IS RECORDED
create or replace function public.apply_stock_movement()
returns trigger as $$
declare
  delta integer;
begin
  delta := case
    when new.movement_type = 'in' then new.quantity
    when new.movement_type = 'out' then -new.quantity
    else new.quantity
  end;

  insert into public.inventory_stock (product_id, branch_id, quantity)
  values (new.product_id, new.branch_id, delta)
  on conflict (product_id, branch_id)
  do update set
    quantity = public.inventory_stock.quantity + delta,
    updated_at = now();

  return new;
end;
$$ language plpgsql security definer;

create trigger trg_apply_stock_movement
after insert on public.stock_movements
for each row execute function public.apply_stock_movement();

-- 4. AUTO-CREATE A PROFILE WHEN A NEW USER SIGNS UP
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'staff');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 5. HELPER FUNCTIONS FOR RLS
create or replace function public.get_my_role()
returns user_role as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function public.get_my_branch()
returns uuid as $$
  select branch_id from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- 6. ENABLE ROW LEVEL SECURITY
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.inventory_stock enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.stock_movements enable row level security;

-- 7. RLS POLICIES
create policy "branches_select_all" on public.branches
  for select using (auth.role() = 'authenticated');
create policy "branches_admin_write" on public.branches
  for all using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.get_my_role() = 'admin');
create policy "profiles_admin_manage" on public.profiles
  for update using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
create policy "profiles_admin_delete" on public.profiles
  for delete using (public.get_my_role() = 'admin');

create policy "categories_select_all" on public.categories
  for select using (auth.role() = 'authenticated');
create policy "categories_manage" on public.categories
  for all using (public.get_my_role() in ('admin', 'manager'))
  with check (public.get_my_role() in ('admin', 'manager'));

create policy "suppliers_select_all" on public.suppliers
  for select using (auth.role() = 'authenticated');
create policy "suppliers_manage" on public.suppliers
  for all using (public.get_my_role() in ('admin', 'manager'))
  with check (public.get_my_role() in ('admin', 'manager'));

create policy "products_select_all" on public.products
  for select using (auth.role() = 'authenticated');
create policy "products_manage" on public.products
  for all using (public.get_my_role() in ('admin', 'manager'))
  with check (public.get_my_role() in ('admin', 'manager'));

create policy "stock_select_scoped" on public.inventory_stock
  for select using (
    public.get_my_role() = 'admin' or branch_id = public.get_my_branch()
  );
create policy "stock_write_admin_or_manager" on public.inventory_stock
  for update using (
    public.get_my_role() = 'admin'
    or (public.get_my_role() = 'manager' and branch_id = public.get_my_branch())
  )
  with check (
    public.get_my_role() = 'admin'
    or (public.get_my_role() = 'manager' and branch_id = public.get_my_branch())
  );

create policy "po_select_scoped" on public.purchase_orders
  for select using (
    public.get_my_role() = 'admin' or branch_id = public.get_my_branch()
  );
create policy "po_insert_admin_or_manager" on public.purchase_orders
  for insert with check (
    public.get_my_role() = 'admin'
    or (public.get_my_role() = 'manager' and branch_id = public.get_my_branch())
  );
create policy "po_update_admin_or_manager" on public.purchase_orders
  for update using (
    public.get_my_role() = 'admin'
    or (public.get_my_role() = 'manager' and branch_id = public.get_my_branch())
  );
create policy "po_delete_admin_only" on public.purchase_orders
  for delete using (public.get_my_role() = 'admin');

create policy "po_items_select_scoped" on public.purchase_order_items
  for select using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_id
        and (public.get_my_role() = 'admin' or po.branch_id = public.get_my_branch())
    )
  );
create policy "po_items_write_admin_or_manager" on public.purchase_order_items
  for all using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_id
        and (
          public.get_my_role() = 'admin'
          or (public.get_my_role() = 'manager' and po.branch_id = public.get_my_branch())
        )
    )
  );

create policy "movements_select_scoped" on public.stock_movements
  for select using (
    public.get_my_role() = 'admin' or branch_id = public.get_my_branch()
  );
create policy "movements_insert_scoped" on public.stock_movements
  for insert with check (
    public.get_my_role() = 'admin' or branch_id = public.get_my_branch()
  );
create policy "movements_admin_update_delete" on public.stock_movements
  for update using (public.get_my_role() = 'admin');
create policy "movements_admin_delete" on public.stock_movements
  for delete using (public.get_my_role() = 'admin');
```

3. Go to **Table Editor** (left sidebar) → confirm you now see: `branches`, `profiles`, `categories`, `suppliers`, `products`, `inventory_stock`, `purchase_orders`, `purchase_order_items`, `stock_movements`.
4. Go to **Authentication → Users** → click **Add User** → create your own account (email + password). This auto-creates a row in `profiles` with role `staff`.
5. Go to **Table Editor → profiles** → find your new row → change `role` from `staff` to `admin` manually. Save.

### 🤖 AI Prompt for today
No coding prompt needed today — this is pure Supabase dashboard setup. (You already have the full script above; no AI needed to generate it.)

### ✅ Recheck before moving on
- [x] All 9 tables appear in Table Editor.
- [x] Running the current `supabase/schema.sql` setup is represented in the live project schema.
- [x] Your user exists in Authentication → Users.
- [x] Your `profiles` row shows `role = admin`.

---

## DAY 3 — Connect React to Supabase + Login

### 🎯 Goal
Build a working login screen. After logging in, the app should know your role and branch.

### 🤖 AI Prompt for today
```
Using React and @supabase/supabase-js, create:
1. A supabaseClient.js file (if not already made) using VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
2. A LoginForm component with email and password fields that calls supabase.auth.signInWithPassword.
3. An AuthContext (React Context) that, after login, fetches the current user's row from the 
   "profiles" table (including role and branch_id) and makes it available app-wide via a useAuth() hook.
4. A simple protected route wrapper that redirects to the login page if no user is logged in.
Style everything with Tailwind CSS in a clean, minimal way.
```

### ✅ Recheck before moving on
- [ ] You can log in with the admin account you created on Day 2.
- [x] After login, `useAuth()` correctly loads the user's `profiles.role`.
- [ ] Logging out returns you to the login screen.
- [x] Trying to load the app while logged out shows the login screen.

---

## DAY 4 — Branches, Categories & Suppliers (Master Data)

### 🎯 Goal
Admin can create and manage branches, categories, and suppliers — the foundation data everything else depends on.

### 🤖 AI Prompt for today
```
Using React, Tailwind, and @supabase/supabase-js, create a "Master Data" section with three tabs:
Branches, Categories, and Suppliers. Each tab should:
- List existing records in a table, fetched from Supabase.
- Have a simple form (modal or inline) to add a new record.
- Allow editing and deleting a record.
Use the "branches" table (name, address), "categories" table (name), 
and "suppliers" table (name, contact_person, phone, email, address).
Only show the "Add/Edit/Delete" buttons if the logged-in user's role is admin or manager 
(use the useAuth() hook from before).
```

### ✅ Recheck before moving on
- [x] You can add at least 2 branches (e.g. "Main Branch", "Branch 2").
- [x] You can add categories and suppliers.
- [x] Changes appear immediately in Supabase's Table Editor.
- [x] Logging in as a non-admin/manager hides the add/edit/delete buttons by role condition.

---

## DAY 5 — Products & Inventory Stock View

### 🎯 Goal
Manage the product catalog and see stock levels per branch.

### 🤖 AI Prompt for today
```
Using React, Tailwind, and @supabase/supabase-js, create a Products page that:
1. Lists all products from the "products" table, joined with "categories" (category name) 
   and "suppliers" (default supplier name).
2. Has a form to add/edit a product: sku, name, description, category, default supplier, 
   unit_price, reorder_level.
3. Below the product list, or on a separate "Stock" tab, show a table of "inventory_stock" 
   joined with "products" and "branches", so the user can see quantity per branch per product.
4. If reorder_level is greater than the quantity for a branch, highlight that row in red/orange.
Only admin and manager roles can add/edit products (use useAuth()).
```

### ✅ Recheck before moving on
- [x] You can add a product with a SKU, price, and reorder level.
- [x] The product shows up in the list with its category and supplier names (not just IDs).
- [x] The stock view shows 0 quantity for a brand-new product (since no stock movement yet).
- [x] Low-stock rows are visually highlighted.

---

## DAY 6 — Stock Movements (Stock In / Stock Out)

### 🎯 Goal
Record actual stock coming in or going out, and see the `inventory_stock` numbers update automatically.

### 🤖 AI Prompt for today
```
Using React, Tailwind, and @supabase/supabase-js, create a "Stock Movement" form that:
1. Lets the user pick a product, a branch (default to the logged-in user's branch_id if not admin), 
   movement type ("in" or "out"), quantity, and optional notes.
2. On submit, inserts a row into the "stock_movements" table with created_by set to the logged-in user's id.
3. After submission, show a success message and refresh the inventory_stock view from Day 5 
   so the updated quantity is visible.
4. Also show a "Movement History" table below, listing recent stock_movements 
   (joined with product name and branch name) for the user's branch (or all branches if admin).
```

### ✅ Recheck before moving on
- [x] Recording a "stock in" of 50 units increases `inventory_stock.quantity` by 50 (check Supabase Table Editor directly — this confirms the trigger from Day 2 works).
- [x] Recording a "stock out" decreases the quantity correctly.
- [ ] A staff-role test account (if you've created one) can only record movements for their own branch, not others.
- [x] Movement history shows correctly with product/branch names, not raw IDs.

---

## DAY 7 — Purchase Orders

### 🎯 Goal
Create and track purchase orders to suppliers.

### 🤖 AI Prompt for today
```
Using React, Tailwind, and @supabase/supabase-js, create a Purchase Orders page that:
1. Lists purchase orders (joined with supplier name and branch name), showing status 
   (draft, pending, approved, received, cancelled).
2. Has a "Create Purchase Order" form: pick a supplier, branch (default to user's branch), 
   expected date, and notes. After creating the order, let the user add multiple line items 
   (product + quantity + unit_cost) into "purchase_order_items".
3. Allow updating a purchase order's status via a dropdown.
4. When a PO's status is changed to "received", automatically insert a "stock_movements" row 
   (type "in") for each line item, using the PO's id as reference_id and 'purchase_order' 
   as reference_type.
Only admin and manager can create/edit purchase orders (use useAuth()).
```

### ✅ Recheck before moving on
- [x] You can create a PO with 2+ line items for different products.
- [x] Changing status to "received" increases stock in `inventory_stock` for each item.
- [x] A staff account can view POs for their branch but cannot create/edit one by role condition.
- [x] Admin can see and manage POs from all branches by role condition.

---

## DAY 8 — Role-Based Dashboard, Low Stock Alerts, Final Testing & Deploy

### 🎯 Goal
Tie everything together with a dashboard, and make sure the whole system is solid before going live.

### 🤖 AI Prompt for today
```
Using React, Tailwind, and @supabase/supabase-js, create a Dashboard home page that shows:
1. Total number of products, total branches, and total low-stock items (quantity < reorder_level).
2. A "Low Stock Alerts" list/table showing product, branch, current quantity, and reorder_level, 
   for items that need reordering.
3. A recent activity feed showing the last 10 entries from "stock_movements" (product, branch, 
   type, quantity, date).
Adjust what's visible based on role: admin sees data for all branches, manager/staff only see 
their own branch's data.
Use the useAuth() hook to filter queries accordingly.
```

### 🛠️ Final Testing Steps
1. Create two more test accounts in Authentication → Users: one set to `manager` (with a branch_id), one left as `staff` (with a branch_id).
2. Log in as each role and confirm:
   - Staff cannot add/edit products, suppliers, categories, or branches.
   - Manager can manage master data and stock for their own branch only.
   - Admin can see and do everything, across all branches.
3. Try to access another branch's data by manually changing a branch_id in a request (e.g., via browser dev tools) — RLS should block it.

### 🛠️ Deployment (optional)
1. Push your code to GitHub.
2. Go to https://vercel.com (or Netlify) → import your repo.
3. Add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in the deployment settings.
4. Deploy.

### ✅ Final Recheck
- [ ] All 3 roles behave correctly (tested manually).
- [x] Low stock alerts show the right items based on loaded product and stock data.
- [x] Dashboard numbers match the app's loaded Supabase data.
- [ ] The deployed link (if you deployed) works and login functions correctly.

---

## Future Upgrade — Admin Users Page

For the beginner version, the safest way to create manager and staff accounts is still through the Supabase Dashboard:

1. Go to **Authentication → Users**.
2. Click **Add user**.
3. Create the user's email and temporary password.
4. Go to **Table Editor → profiles**.
5. Set that user's `role` to `admin`, `manager`, or `staff`.
6. Set their `branch_id` so managers and staff are assigned to the correct branch.

Later, build an **Admin Users** page inside the app so the admin does not need to keep going back to the Supabase Dashboard.

The Admin Users page can support:
- [x] Add or invite users.
- [x] Assign roles.
- [x] Assign branches.
- [x] Update a user's role or branch.
- [x] Help reset or rotate temporary passwords.

Important security note: do **not** create Auth users directly from the React frontend with a `service_role` key. The `service_role` key must never be exposed in browser code. To safely create users from inside the app, use a secure server-side endpoint such as a **Supabase Edge Function** that checks the current user's admin role before calling the Supabase Admin API.

Suggested future prompt:
```
Build an Admin Users page for my inventory system.
Use a Supabase Edge Function to securely invite/create users, assign role and branch in profiles,
and make sure only admin users can access this feature.
Do not expose the service_role key in the React frontend.
```

Status: completed with the `Admin Users` tab and the deployed `admin-users` Supabase Edge Function. The function verifies the caller's admin role before using server-side Auth Admin APIs.

---

## Kung Naay Sayop (If something breaks)
- Always check the browser console (F12) for errors first.
- If a query returns empty unexpectedly, it's usually RLS blocking it — double check the logged-in user's `role` and `branch_id` in the `profiles` table.
- You can always re-paste any single day's AI prompt again and describe what's going wrong — the AI will fix just that part without touching the rest.
