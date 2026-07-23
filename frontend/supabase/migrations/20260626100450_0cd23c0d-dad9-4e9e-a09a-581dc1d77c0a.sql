
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'org_admin';

ALTER TABLE public.organizations
  ALTER COLUMN type TYPE text USING type::text;
