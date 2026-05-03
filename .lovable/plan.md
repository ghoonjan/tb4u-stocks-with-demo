# Phase 4 — Prompt 4: Admin template badge & management

Adapt the spec to the project's actual security model and place the UI in the dashboard.

## Spec ↔ project reconciliation

- The spec says `profile.role === 'admin'`. This project intentionally has **no** `role` column on `profiles` — admin status lives in `user_roles` as `super_admin` (per existing security memory). The existing hook `src/hooks/useUserRole.ts` already returns `isSuperAdmin`. We will **reuse it as-is** and treat `isSuperAdmin` as the admin gate. No new hook, no new role column.
- Watchlist has no template marker / no parent container → skip the watchlist badge (per spec's "if you cannot find … skip").

## New component: `src/components/dashboard/TemplateAdminPanel.tsx`

A self-contained, admin-only panel rendered between `PortfolioHeader` and the main grid in `Dashboard.tsx`. Hidden entirely for non-admins.

Behavior:
1. Calls `useUserRole()`. If `loading` → render nothing. If `!isSuperAdmin` → render nothing.
2. Fetches the admin's portfolios with their holdings count:
   ```ts
   supabase
     .from("portfolios")
     .select("id, name, is_template, holdings(count)")
     .eq("user_id", userId)
     .order("created_at", { ascending: true })
   ```
   (`holdings(count)` returns an aggregate on the embedded relation; falls back to a per-portfolio count query if needed.)
3. Renders one card containing:
   - **Template card** (only if a template exists): green badge "🌟 Template Portfolio" next to the portfolio name, muted helper line "New users receive a copy of this portfolio on their first login", and "X holdings will be cloned".
   - **Other portfolios list** (if more than one portfolio total): each row shows portfolio name + a small outline button "Set as Template".
   - If **no template** exists yet, show an amber notice "No template set — new users will start with an empty portfolio" and a "Set as Template" button on each portfolio.
4. "Set as Template" handler:
   - Inside a single logical operation:
     - `update portfolios set is_template = false where user_id = <admin> and is_template = true`
     - `update portfolios set is_template = true where id = <chosen>`
   - Both are scoped by `user_id = auth.uid()` and protected by existing RLS (admin only operates on their own portfolios; RLS already restricts that).
   - On success: `toast("Template updated", { description: "New users will now receive this portfolio" })` (sonner) and refetch.
   - On error: `toast.error("Failed to update template")`.
5. Optional realtime not needed; refetch after mutation is enough.

Visual style:
- Wrap in a rounded card consistent with other dashboard surfaces (`rounded-xl border border-border bg-card/60 backdrop-blur-sm p-3`).
- Badge uses semantic green: `bg-gain/15 text-gain border border-gain/30 rounded-full px-2 py-0.5 text-[11px] font-medium`. No raw color classes.
- "Set as Template" button: existing secondary button styling pattern from PortfolioHeader (`rounded-md border border-border bg-secondary px-3 py-1 text-xs hover:bg-secondary/80`).

## Integration: `src/pages/Dashboard.tsx`

Insert one line right after `<PortfolioHeader … />`:

```tsx
<TemplateAdminPanel userId={user.id} />
```

Plus the import. Nothing else changes in Dashboard.

## Out of scope

- No changes to `useUserRole`, `usePortfolioData`, `PortfolioHeader`, or any data hook.
- No watchlist template (no schema support).
- No new RPC; mutations use existing RLS-protected `update` on `portfolios`.
