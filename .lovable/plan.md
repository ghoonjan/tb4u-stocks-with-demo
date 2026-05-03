## What's actually broken

New users do get a cloned portfolio — but it's empty. The clone runs correctly; the source template just has nothing in it.

In the database, the super_admin currently owns two portfolios:

| Name | `is_template` | Holdings |
|---|---|---|
| Template Portfolio | false | **8** |
| My Portfolio | **true** | 0 |

`clone_template_for_user` reads from the portfolio flagged `is_template = true`, which is the empty "My Portfolio". The 8 real holdings live on "Template Portfolio", which is no longer flagged.

This likely happened when the admin toggled the template flag onto a different portfolio via the "Set as template" button — the flag moved, but holdings didn't.

The watchlist works because it's seeded from the separate `watchlist_template` table, which is populated.

## Fix

### 1. Repoint the template flag (data migration)

Make "Template Portfolio" (the one with 8 holdings) the active template, and clear the flag on the empty "My Portfolio":

```sql
UPDATE public.portfolios SET is_template = false
  WHERE id = 'd7fda9ea-3396-4008-8ac5-edcd8daaf44e';
UPDATE public.portfolios SET is_template = true
  WHERE id = '0b73a40e-ec54-4f84-8761-dbeffa1d3bb1';
```

After this, the next new signup will get the 8 holdings cloned.

### 2. Harden the admin UI (`src/pages/AdminTemplates.tsx`)

Two small changes so this doesn't silently happen again:

- When the active template has **0 holdings**, show a warning banner ("This template is empty — new users will start with no holdings") instead of the neutral "No holdings yet" message.
- In the "Promote a different portfolio to template" list, show each candidate's holdings count, and add a confirm dialog when promoting an empty portfolio over a non-empty current template.

### 3. Verification

After the migration:
- Reload `/admin/templates` — "Template Portfolio" should be marked as the active template with 8 holdings.
- Sign up a brand-new test account and confirm the dashboard shows the seeded holdings (no need to click "Add holding" first).

No schema changes, no edge-function changes, no RLS changes.
