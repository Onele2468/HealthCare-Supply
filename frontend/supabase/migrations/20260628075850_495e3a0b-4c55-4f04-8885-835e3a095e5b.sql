
-- Phase 1: Foundation redesign

-- 1. Organization fields
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS ownership text,
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.organizations ALTER COLUMN currency SET DEFAULT 'ZAR';

-- 2. business_connections table
CREATE TABLE IF NOT EXISTS public.business_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  addressee_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'generic',
  status text NOT NULL DEFAULT 'pending',
  message text,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_connections_not_self CHECK (requester_org_id <> addressee_org_id),
  CONSTRAINT business_connections_status_chk CHECK (status IN ('pending','accepted','rejected','removed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS business_connections_pair_uidx
  ON public.business_connections (
    LEAST(requester_org_id, addressee_org_id),
    GREATEST(requester_org_id, addressee_org_id),
    relationship_type
  ) WHERE status IN ('pending','accepted');

CREATE INDEX IF NOT EXISTS business_connections_requester_idx ON public.business_connections(requester_org_id);
CREATE INDEX IF NOT EXISTS business_connections_addressee_idx ON public.business_connections(addressee_org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_connections TO authenticated;
GRANT ALL ON public.business_connections TO service_role;

ALTER TABLE public.business_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members of either org can view connections"
  ON public.business_connections FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), requester_org_id)
    OR public.is_org_member(auth.uid(), addressee_org_id)
  );

-- writes only via SECURITY DEFINER RPCs below — no insert/update/delete policies

CREATE TRIGGER trg_business_connections_updated_at
  BEFORE UPDATE ON public.business_connections
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. RPCs
CREATE OR REPLACE FUNCTION public.request_business_connection(
  _addressee_org_id uuid,
  _relationship_type text DEFAULT 'generic',
  _message text DEFAULT NULL
) RETURNS public.business_connections
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _requester_org uuid;
  _existing public.business_connections;
  _row public.business_connections;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;

  SELECT current_org_id INTO _requester_org FROM public.profiles WHERE id = _uid;
  IF _requester_org IS NULL THEN
    RAISE EXCEPTION 'No active organization';
  END IF;
  IF _requester_org = _addressee_org_id THEN
    RAISE EXCEPTION 'Cannot connect to your own organization';
  END IF;
  IF NOT public.is_org_member(_uid, _requester_org) THEN
    RAISE EXCEPTION 'Not a member of the requesting organization' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _existing FROM public.business_connections
   WHERE LEAST(requester_org_id, addressee_org_id) = LEAST(_requester_org, _addressee_org_id)
     AND GREATEST(requester_org_id, addressee_org_id) = GREATEST(_requester_org, _addressee_org_id)
     AND relationship_type = _relationship_type
     AND status IN ('pending','accepted')
   LIMIT 1;
  IF _existing.id IS NOT NULL THEN
    RETURN _existing;
  END IF;

  INSERT INTO public.business_connections (requester_org_id, addressee_org_id, relationship_type, message, requested_by, status)
  VALUES (_requester_org, _addressee_org_id, _relationship_type, _message, _uid, 'pending')
  RETURNING * INTO _row;
  RETURN _row;
END $$;

CREATE OR REPLACE FUNCTION public.decide_business_connection(
  _id uuid,
  _accept boolean
) RETURNS public.business_connections
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.business_connections;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _row FROM public.business_connections WHERE id = _id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Connection request not found'; END IF;
  IF _row.status <> 'pending' THEN RAISE EXCEPTION 'Request is %', _row.status; END IF;
  IF NOT public.has_role(_uid, _row.addressee_org_id, 'org_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins of the receiving organization can decide' USING ERRCODE = '42501';
  END IF;

  UPDATE public.business_connections
     SET status = CASE WHEN _accept THEN 'accepted' ELSE 'rejected' END,
         decided_by = _uid, decided_at = now()
   WHERE id = _id
  RETURNING * INTO _row;
  RETURN _row;
END $$;

CREATE OR REPLACE FUNCTION public.remove_business_connection(_id uuid)
RETURNS public.business_connections
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.business_connections;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _row FROM public.business_connections WHERE id = _id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF NOT (
    public.has_role(_uid, _row.requester_org_id, 'org_admin'::public.app_role)
    OR public.has_role(_uid, _row.addressee_org_id, 'org_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Only org admins can remove a connection' USING ERRCODE = '42501';
  END IF;

  UPDATE public.business_connections SET status = 'removed', updated_at = now()
   WHERE id = _id RETURNING * INTO _row;
  RETURN _row;
END $$;

CREATE OR REPLACE FUNCTION public.search_organizations(
  _q text DEFAULT NULL,
  _type text DEFAULT NULL,
  _industry text DEFAULT NULL,
  _country text DEFAULT NULL,
  _province text DEFAULT NULL,
  _limit int DEFAULT 50
) RETURNS TABLE (
  id uuid, name text, code text, type text, ownership text, industry text,
  city text, province text, country text, logo_url text, description text, status text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.name, o.code, o.type, o.ownership, o.industry,
         o.city, o.province, o.country, o.logo_url, o.description, o.status::text
    FROM public.organizations o
   WHERE COALESCE(o.status::text, 'pending') IN ('pending','verified')
     AND (_q IS NULL OR _q = '' OR o.name ILIKE '%' || _q || '%' OR o.code ILIKE '%' || _q || '%')
     AND (_type IS NULL OR _type = '' OR o.type = _type)
     AND (_industry IS NULL OR _industry = '' OR o.industry = _industry)
     AND (_country IS NULL OR _country = '' OR o.country = _country)
     AND (_province IS NULL OR _province = '' OR o.province = _province)
   ORDER BY (o.status::text = 'verified') DESC, o.name ASC
   LIMIT GREATEST(1, LEAST(_limit, 200));
$$;

REVOKE ALL ON FUNCTION public.search_organizations(text,text,text,text,text,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_organizations(text,text,text,text,text,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_business_connection(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_business_connection(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_business_connection(uuid) TO authenticated;
