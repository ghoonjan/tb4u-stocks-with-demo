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

create index idx_tax_lots_holding_id on public.tax_lots(holding_id);

create or replace function public.tax_lots_validate()
returns trigger
language plpgsql
set search_path = public
as $$
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
end;
$$;

create trigger trg_tax_lots_validate
before insert or update on public.tax_lots
for each row execute function public.tax_lots_validate();

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
))
with check (exists (
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