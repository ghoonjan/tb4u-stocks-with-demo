## Fix orphaned tax_lots on user delete

### 1. `supabase/functions/admin-delete-user/index.ts`
Before deleting holdings, fetch their IDs and delete matching `tax_lots`:

```ts
if (portfolioIds.length > 0) {
  const { data: holdingRows } = await admin
    .from("holdings").select("id").in("portfolio_id", portfolioIds);
  const holdingIds = (holdingRows ?? []).map((h) => h.id);
  if (holdingIds.length > 0) {
    await admin.from("tax_lots").delete().in("holding_id", holdingIds);
  }
  await admin.from("holdings").delete().in("portfolio_id", portfolioIds);
}
```

### 2. Migration — add ON DELETE CASCADE foreign keys
- `tax_lots.holding_id` → `holdings(id) ON DELETE CASCADE`
- `holdings.portfolio_id` → `portfolios(id) ON DELETE CASCADE`

This prevents orphans on any future delete path, not just the admin one.

### 3. Cleanup — remove existing orphaned tax_lots
One-time delete of `tax_lots` rows whose `holding_id` no longer exists in `holdings`.
