## Reattach `on_auth_user_created` trigger

Run a single migration to (re)create the trigger that fires `public.handle_new_user()` after every insert into `auth.users`. This ensures every new signup automatically gets a `profiles` row and a starter `portfolios` row, eliminating the `portfolio_user_id_fkey` foreign-key failures.

### Migration SQL

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### Notes
- `public.handle_new_user()` already exists (SECURITY DEFINER, inserts into `profiles` and `portfolios`).
- No app/code changes needed.
- Existing users were already backfilled in a prior turn, so this only affects future signups.
