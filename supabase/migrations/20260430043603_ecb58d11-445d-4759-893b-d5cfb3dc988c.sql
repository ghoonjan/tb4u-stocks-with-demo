-- Super admin password rotation (sanitized).
-- An earlier version of this migration contained a plaintext password used to
-- rotate the super admin account. That value has itself been rotated again to
-- a password that is not stored in any source file. This migration is now a
-- no-op so historical apply order is preserved without re-exposing credentials.
SELECT 1;
