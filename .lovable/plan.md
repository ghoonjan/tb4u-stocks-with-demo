## Goal

Give super admins a dedicated page to manage what new users receive on first login: the **template portfolio** (with its holdings) and a new **template watchlist**. Today the only admin UI for templates is a small panel on the Dashboard (`TemplateAdminPanel`) that just toggles which existing portfolio is the template — there is no way to edit its holdings, and watchlist templates don't exist at all.

## What gets built

### 1. New route `/admin/templates`

- New page `src/pages/AdminTemplates.tsx`, gated by `ProtectedAdminRoute` (same as `/admin`).
- Add link/button from `/admin` ("Manage Templates") and from the existing dashboard `TemplateAdminPanel` ("Edit template →").
- Layout matches `/admin` (LogoMark header, GradientMeshBackground, CopyrightFooter).

### 2. Template portfolio management

A "Template Portfolio" section that:

- Shows the current template portfolio name (editable inline) and holding count.
- If no template exists, offers a **Create template portfolio** button (creates a portfolio owned by the current super admin with `is_template = true`).
- Lists all holdings of the template portfolio in a table: ticker, company, shares, avg cost, conviction, target %, thesis (truncated), notes (truncated).
- **Add holding**: reuses existing `HoldingModal` against the template portfolio id.
- **Edit holding**: opens `HoldingModal` prefilled.
- **Delete holding**: confirm dialog, then delete row.
- "Promote a different portfolio to template" dropdown (covers existing flow from `TemplateAdminPanel`).

### 3. Template watchlist management (new concept)

The current `watchlist` table is per-user only — no template marker. Two clean options; the plan uses **Option A** (separate table) because it keeps user data and templates physically separate and avoids RLS complications.

**Schema change (migration):**

```sql
create table public.watchlist_template (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  company_name text,
  target_price numeric,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.watchlist_template enable row level security;

-- Anyone authenticated may read (so clone RPC running as caller can read it,
-- and admin UI can show it). Only super admins may write.
create policy "Authenticated can view watchlist template"
  on public.watchlist_template for select to authenticated using (true);

create policy "Super admins manage watchlist template"
  on public.watchlist_template for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));
```

**RPC update:** extend `public.clone_template_for_user(target_user_id uuid)` so step 6 (currently a "skip" comment) inserts rows from `watchlist_template` into `public.watchlist` for the target user. Keep the existing `has_been_initialized` guard and auth check.

**UI in AdminTemplates page:** "Template Watchlist" section with:
- Table of template watchlist entries (ticker, company, target price, notes).
- Add / edit / delete rows via a small inline modal (lightweight form, similar shape to `WatchlistModal` but writing to `watchlist_template`).

### 4. Cleanup

- Remove `TemplateAdminPanel` from `Dashboard.tsx` (it becomes redundant), or shrink it to a single "Manage templates →" link that routes to `/admin/templates`. Plan: replace with the link to keep discoverability for super admins on the dashboard.

## Files

**New**
- `src/pages/AdminTemplates.tsx`
- `src/components/admin/TemplateHoldingsTable.tsx`
- `src/components/admin/TemplateWatchlistTable.tsx`
- `src/components/admin/TemplateWatchlistModal.tsx`
- Migration: `watchlist_template` table + RLS + updated `clone_template_for_user` RPC.

**Edited**
- `src/App.tsx` — add `/admin/templates` route inside `ProtectedAdminRoute`.
- `src/pages/Admin.tsx` — add "Manage Templates" button in header.
- `src/components/dashboard/TemplateAdminPanel.tsx` — replace body with a single link to `/admin/templates` (still hidden for non-admins).
- Reuse `src/components/dashboard/HoldingModal.tsx` for template-holding edits (already supports a portfolio id).

## Out of scope

- Multiple named templates / template versioning.
- Per-segment templates (e.g. different template for different signup sources).
- Backfilling watchlists for users already initialized.
