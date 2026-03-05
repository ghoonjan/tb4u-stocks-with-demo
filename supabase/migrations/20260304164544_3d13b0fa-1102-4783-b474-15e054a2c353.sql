ALTER TABLE public.profiles
ADD COLUMN email_digest_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN digest_frequency text NOT NULL DEFAULT 'weekly',
ADD COLUMN digest_preferred_time text NOT NULL DEFAULT 'morning';