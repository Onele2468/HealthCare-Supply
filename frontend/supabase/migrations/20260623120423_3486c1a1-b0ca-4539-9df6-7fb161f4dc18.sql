
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['inventory:read','products:read','purchase-orders:write','deliveries:read']::text[],
  created_by uuid REFERENCES auth.users(id),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX api_keys_org_idx ON public.api_keys(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read api keys" ON public.api_keys
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "org admins manage api keys" ON public.api_keys
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), org_id, 'clinic_admin')
    OR public.has_role(auth.uid(), org_id, 'hospital_admin')
    OR public.has_role(auth.uid(), org_id, 'supplier_admin')
    OR public.has_role(auth.uid(), org_id, 'procurement_officer')
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), org_id, 'clinic_admin')
    OR public.has_role(auth.uid(), org_id, 'hospital_admin')
    OR public.has_role(auth.uid(), org_id, 'supplier_admin')
    OR public.has_role(auth.uid(), org_id, 'procurement_officer')
    OR public.is_super_admin(auth.uid())
  );
