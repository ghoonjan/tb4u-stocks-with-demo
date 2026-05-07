## Prompt 1: Create the `tax_lots` table

### Migration

Create one migration that adds the table, indexes, RLS, and a validation trigger.

```sql
-- Table
create table public.tax_lots (
  id uuid primary key default gen_random_uuid(),
  holding_id uuid not null references public.holdings(id) on delete cascade,
  shares numeric not null check (shares > 0),
  shares_remaining numeric not null check (shares_remaining >= 0),
  cost_basis_per_share numeric not null check (cost_basis_per_share > 0),
  purchased_at date not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Default shares_remaining = shares when not provided (handled via trigger
-- because column DEFAULTs cannot reference other columns)
create or replace function public.tax_lots_set_defaults()
returns trigger language plpgsql as $$
begin
  if new.shares_remaining is null then
    new.shares_remaining := new.shares;
  end if;
  if new.purchased_at > current_date then
    raise exception 'purchased_at cannot be in the future';
  end if;
  if new.shares_remaining > new.shares then
    raise exception 'shares_remaining cannot exceed shares';
  end if;
  return new;
end $$;

create trigger trg_tax_lots_validate
before insert or update on public.tax_lots
for each row execute function public.tax_lots_set_defaults();

-- Index
create index idx_tax_lots_holding_id on public.tax_lots(holding_id);

-- RLS
alter table public.tax_lots enable row level security;

create policy "Users can view own tax_lots"
on public.tax_lots for select to authenticated
using (exists (
  select 1 from public.holdings h
  join public.portfolios p on p.id = h.portfolio_id
  where h.id = tax_lots.holding_id and p.user_id = auth.uid()
));

create policy "Users can insert own tax_lots"
on public.tax_lots for insert to authenticated
with check (exists (
  select 1 from public.holdings h
  join public.portfolios p on p.id = h.portfolio_id
  where h.id = tax_lots.holding_id and p.user_id = auth.uid()
));

create policy "Users can update own tax_lots"
on public.tax_lots for update to authenticated
using (exists (
  select 1 from public.holdings h
  join public.portfolios p on p.id = h.portfolio_id
  where h.id = tax_lots.holding_id and p.user_id = auth.uid()
));

create policy "Users can delete own tax_lots"
on public.tax_lots for delete to authenticated
using (exists (
  select 1 from public.holdings h
  join public.portfolios p on p.id = h.portfolio_id
  where h.id = tax_lots.holding_id and p.user_id = auth.uid()
));
```

### Notes / deviations from your spec

- **`purchased_at <= CURRENT_DATE` enforced via trigger, not CHECK constraint.** Postgres requires CHECK expressions to be immutable, and `CURRENT_DATE` is not — using it in a CHECK breaks restores. The trigger above enforces the same rule on every insert/update.
- **`shares_remaining default = shares`** is also handled in the trigger (column defaults can't reference sibling columns). Insert without specifying `shares_remaining` and it auto-fills.
- The trigger additionally guards `shares_remaining <= shares` as a sanity check — let me know if you'd rather drop that.

### Scope

This prompt is migration-only. No app code, no UI, no `types.ts` edits (regenerated automatically). Ready to test by inserting/selecting rows after approval.
