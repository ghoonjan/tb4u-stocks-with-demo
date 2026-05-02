-- Super admin password rotation (sanitized).
-- The actual rotation was applied directly to the live database. The plaintext
-- password is intentionally NOT stored in this migration file. To rotate again,
-- use the Lovable Cloud / Supabase Dashboard (Authentication -> Users) rather
-- than a committed SQL migration.
SELECT 1;
