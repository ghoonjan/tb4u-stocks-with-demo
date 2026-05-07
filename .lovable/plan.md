## Prompt 2: Backfill existing holdings into `tax_lots`

### Migration

One idempotent migration that inserts a single tax lot per existing holding, only where no lot already exists for that holding (so re-running is safe and it won't duplicate the lots created in testing).

```sql
insert into public.tax_lots (
  holding_id, shares, shares_remaining, cost_basis_per_share, purchased_at
)
select
  h.id,
  h.shares,
  h.shares,
  h.avg_cost_basis,
  h.date_added::date
from public.holdings h
where not exists (
  select 1 from public.tax_lots tl where tl.holding_id = h.id
);
```

### Notes

- `purchased_at` is a `date`, while `holdings.date_added` is `timestamptz` — cast with `::date`.
- The `where not exists` guard makes this safe even if some holdings already have lots from your manual testing of Prompt 1.
- `shares_remaining` is set explicitly to `shares` (matches the trigger's default behavior).
- The `tax_lots_validate` trigger will run on each insert; all values come from existing holdings so they should pass (`shares > 0`, `cost_basis > 0`, `purchased_at <= today`). If any historical holding has bad data (e.g. zero shares), that row would fail — let me know if you want me to skip such rows defensively.

### Scope

Migration-only. No app code, no UI changes. After approval I'll apply it and you can verify with a quick count of `tax_lots` vs `holdings`.
