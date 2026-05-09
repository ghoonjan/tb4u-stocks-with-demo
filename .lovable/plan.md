Update the `handle_new_user()` trigger to populate `full_name` from OAuth/auth metadata while preserving existing behavior.

### Problem
The current trigger only inserts `id`, `email`, and `has_been_initialized` into `profiles`. When users sign up via Google/Apple OAuth, their display name is lost because it lives in `raw_user_meta_data`.

### Changes

1. **Modify `handle_new_user()` function**
   - Extract `full_name` from `NEW.raw_user_meta_data` with cascading fallbacks:
     - `raw_user_meta_data->>'full_name'`
     - `raw_user_meta_data->>'name'`
     - `split_part(NEW.email, '@', 1)` as last resort
   - Extract `email` with fallback to `raw_user_meta_data->>'email'`.
   - Keep `has_been_initialized = false`.
   - Keep automatic portfolio creation (`INSERT INTO portfolios`).
   - Wrap profiles insert in `ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = COALESCE(EXCLUDED.full_name, profiles.full_name)` for idempotency.
   - **Note:** `role` is intentionally omitted from the `profiles` insert because the app stores roles in the separate `user_roles` table (not a column on `profiles`).

### SQL Migration

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, has_been_initialized)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  INSERT INTO public.portfolios (user_id, name)
  VALUES (NEW.id, 'My Portfolio');

  RETURN NEW;
END;
$$;
```

No application code changes are required — this is a pure backend trigger update.