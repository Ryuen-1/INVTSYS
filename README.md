# Inventory System

A role-based inventory management system built with React, Vite, TypeScript, and Supabase.

The app supports product catalog management, branch stock tracking, stock movements, purchase orders, low-stock dashboard alerts, and admin user management through a Supabase Edge Function.

## Features

- Email/password authentication with Supabase Auth
- Role-based navigation for admin, manager, and staff users
- Branch, category, supplier, and product management
- Inventory stock view with low-stock highlighting
- Stock in/out movement recording with movement history
- Purchase order creation and receiving workflow
- Dashboard totals, low-stock alerts, and recent activity
- Admin user creation, editing, role assignment, branch assignment, and deletion

## Tech Stack

- React 19
- TypeScript
- Vite
- Supabase Auth, Database, Row Level Security, and Edge Functions

## Project Structure

```text
src/
  App.tsx                 Main application shell and data workflows
  AuthContext.tsx         Supabase auth/session/profile context
  AdminUsersPage.tsx      Admin user management UI
  pages.tsx               Dashboard and inventory section components
  utils/supabase.ts       Supabase browser client
supabase/
  schema.sql              Database schema, RLS policies, and triggers
  functions/admin-users/  Secure admin user management Edge Function
```

## Requirements

- Node.js LTS
- npm
- A Supabase project

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

The browser app must only use the anon key. Service role or secret keys belong only in Supabase Edge Function secrets.

## Setup

Install dependencies:

```bash
npm install
```

Apply the database schema in Supabase SQL Editor using:

```text
supabase/schema.sql
```

Deploy or configure the `admin-users` Edge Function with the required Supabase secrets before using the Admin Users page.

## Scripts

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Roles

- `admin`: full access across all branches, including user management
- `manager`: manage inventory data and purchase orders for assigned branch scope
- `staff`: view assigned branch stock and record stock movements

Supabase Row Level Security policies in `supabase/schema.sql` enforce database access rules in addition to the app UI.

## Deployment Notes

When deploying to Vercel, Netlify, or another static host, add the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables in the hosting provider settings.

Do not expose `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEYS` in frontend deployment settings.
