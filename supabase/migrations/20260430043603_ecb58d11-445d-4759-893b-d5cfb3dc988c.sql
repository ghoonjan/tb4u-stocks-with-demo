-- Rotate the super admin password. The previous password was committed in
-- plaintext to a migration file and must be treated as compromised.
DO $$
DECLARE
  v_email text := 'saxplayingurd@gmail.com';
  v_new_password text := 'TB4U-Admin-t01lbkBT21pvkQVnJUSHbvp8!';
BEGIN
  UPDATE auth.users
  SET encrypted_password = crypt(v_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE email = v_email;
END $$;