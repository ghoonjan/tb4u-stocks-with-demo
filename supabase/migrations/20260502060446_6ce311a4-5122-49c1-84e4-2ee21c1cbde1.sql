-- Rotate the super admin password to a fresh value not committed in any prior migration.
-- The previous two passwords were exposed in plaintext in migration history and must be
-- treated as compromised. The new value is set here once and not reused in source files.
DO $$
DECLARE
  v_email text := 'saxplayingurd@gmail.com';
  v_new_password text := 'TB4U-Admin-9QdHPexU8aysCopqLlj1vzduT3Zz!';
BEGIN
  UPDATE auth.users
  SET encrypted_password = crypt(v_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE email = v_email;
END $$;