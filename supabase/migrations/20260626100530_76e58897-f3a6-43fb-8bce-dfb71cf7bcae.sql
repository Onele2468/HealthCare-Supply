
-- 1. New status enum
DO $$ BEGIN
  CREATE TYPE public.org_status AS ENUM ('pending', 'verified', 'suspended', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. New business fields
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS tax_number text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS business_email text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS code text UNIQUE,
  ADD COLUMN IF NOT EXISTS status public.org_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';

-- 3. Auto-generate org code on insert
CREATE OR REPLACE FUNCTION public.generate_org_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _code text;
  _try int := 0;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN RETURN NEW; END IF;
  LOOP
    _code := 'SUP-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.organizations WHERE code = _code);
    _try := _try + 1;
    IF _try > 10 THEN RAISE EXCEPTION 'Could not generate unique org code'; END IF;
  END LOOP;
  NEW.code := _code;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_generate_org_code ON public.organizations;
CREATE TRIGGER trg_generate_org_code
  BEFORE INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.generate_org_code();

UPDATE public.organizations
   SET code = 'SUP-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6))
 WHERE code IS NULL;

-- 4. Updated create_organization function (old signature used org_type enum)
DROP FUNCTION IF EXISTS public.create_organization_with_admin(text, public.org_type);
DROP FUNCTION IF EXISTS public.create_organization_with_admin(text, text);

CREATE OR REPLACE FUNCTION public.create_organization_with_admin(
  _name text,
  _type text,
  _industry text DEFAULT NULL,
  _registration_number text DEFAULT NULL,
  _tax_number text DEFAULT NULL,
  _country text DEFAULT NULL,
  _province text DEFAULT NULL,
  _city text DEFAULT NULL,
  _address text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _business_email text DEFAULT NULL,
  _website text DEFAULT NULL,
  _logo_url text DEFAULT NULL
) RETURNS public.organizations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _org public.organizations;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF trim(coalesce(_name, '')) = '' THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;
  IF trim(coalesce(_type, '')) = '' THEN
    RAISE EXCEPTION 'Organization type is required';
  END IF;

  INSERT INTO public.organizations (
    name, type, industry, registration_number, tax_number,
    country, province, city, address, phone, business_email, website, logo_url
  ) VALUES (
    _name, _type, _industry, _registration_number, _tax_number,
    _country, _province, _city, _address, _phone, _business_email, _website, _logo_url
  ) RETURNING * INTO _org;

  INSERT INTO public.memberships (user_id, org_id, role)
  VALUES (_uid, _org.id, 'org_admin'::public.app_role);

  UPDATE public.profiles SET current_org_id = _org.id WHERE id = _uid;

  RETURN _org;
END $$;

-- 5. Join requests table
CREATE TABLE IF NOT EXISTS public.join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  message text,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, status)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.join_requests TO authenticated;
GRANT ALL ON public.join_requests TO service_role;

ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see their own join requests" ON public.join_requests;
CREATE POLICY "Users see their own join requests"
  ON public.join_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "Users create their own join requests" ON public.join_requests;
CREATE POLICY "Users create their own join requests"
  ON public.join_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users cancel own; org admins update" ON public.join_requests;
CREATE POLICY "Users cancel own; org admins update"
  ON public.join_requests FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), org_id, 'org_admin'::public.app_role))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), org_id, 'org_admin'::public.app_role));

DROP TRIGGER IF EXISTS trg_join_requests_updated_at ON public.join_requests;
CREATE TRIGGER trg_join_requests_updated_at
  BEFORE UPDATE ON public.join_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 6. Request join by org code
CREATE OR REPLACE FUNCTION public.request_join_by_code(_code text, _message text DEFAULT NULL)
RETURNS public.join_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _org public.organizations;
  _req public.join_requests;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _org FROM public.organizations WHERE code = upper(trim(_code));
  IF _org.id IS NULL THEN
    RAISE EXCEPTION 'Organization code not found';
  END IF;

  IF EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _uid AND org_id = _org.id) THEN
    RAISE EXCEPTION 'You are already a member of this organization';
  END IF;

  INSERT INTO public.join_requests (org_id, user_id, message, status)
  VALUES (_org.id, _uid, _message, 'pending')
  ON CONFLICT (org_id, user_id, status) DO UPDATE SET message = EXCLUDED.message, updated_at = now()
  RETURNING * INTO _req;

  RETURN _req;
END $$;

-- 7. Approve/reject join request
CREATE OR REPLACE FUNCTION public.decide_join_request(
  _request_id uuid,
  _approve boolean,
  _role public.app_role DEFAULT 'org_admin'::public.app_role
) RETURNS public.join_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _req public.join_requests;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;

  SELECT * INTO _req FROM public.join_requests WHERE id = _request_id FOR UPDATE;
  IF _req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT public.has_role(_uid, _req.org_id, 'org_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only organization admins can decide join requests' USING ERRCODE = '42501';
  END IF;
  IF _req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is %', _req.status;
  END IF;

  IF _approve THEN
    INSERT INTO public.memberships (user_id, org_id, role)
    VALUES (_req.user_id, _req.org_id, _role)
    ON CONFLICT (user_id, org_id, role) DO NOTHING;
    UPDATE public.join_requests SET status = 'approved', decided_by = _uid, decided_at = now()
      WHERE id = _request_id RETURNING * INTO _req;
  ELSE
    UPDATE public.join_requests SET status = 'rejected', decided_by = _uid, decided_at = now()
      WHERE id = _request_id RETURNING * INTO _req;
  END IF;

  RETURN _req;
END $$;

-- 8. Update organization settings (admin only)
CREATE OR REPLACE FUNCTION public.update_organization_settings(
  _org_id uuid,
  _name text DEFAULT NULL,
  _type text DEFAULT NULL,
  _industry text DEFAULT NULL,
  _registration_number text DEFAULT NULL,
  _tax_number text DEFAULT NULL,
  _country text DEFAULT NULL,
  _province text DEFAULT NULL,
  _city text DEFAULT NULL,
  _address text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _business_email text DEFAULT NULL,
  _website text DEFAULT NULL,
  _logo_url text DEFAULT NULL,
  _currency text DEFAULT NULL,
  _timezone text DEFAULT NULL,
  _language text DEFAULT NULL
) RETURNS public.organizations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _org public.organizations;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  IF NOT public.has_role(_uid, _org_id, 'org_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only org admins can update settings' USING ERRCODE = '42501';
  END IF;

  UPDATE public.organizations SET
    name = COALESCE(_name, name),
    type = COALESCE(_type, type),
    industry = COALESCE(_industry, industry),
    registration_number = COALESCE(_registration_number, registration_number),
    tax_number = COALESCE(_tax_number, tax_number),
    country = COALESCE(_country, country),
    province = COALESCE(_province, province),
    city = COALESCE(_city, city),
    address = COALESCE(_address, address),
    phone = COALESCE(_phone, phone),
    business_email = COALESCE(_business_email, business_email),
    website = COALESCE(_website, website),
    logo_url = COALESCE(_logo_url, logo_url),
    currency = COALESCE(_currency, currency),
    timezone = COALESCE(_timezone, timezone),
    language = COALESCE(_language, language),
    updated_at = now()
  WHERE id = _org_id
  RETURNING * INTO _org;

  RETURN _org;
END $$;
