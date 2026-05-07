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