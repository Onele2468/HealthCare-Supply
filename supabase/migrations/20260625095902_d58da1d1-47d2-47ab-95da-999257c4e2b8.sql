CREATE OR REPLACE FUNCTION public.create_organization_with_admin(_name text, _type org_type)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _org public.organizations;
  _admin_role app_role;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF trim(coalesce(_name, '')) = '' THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;

  _admin_role := (CASE _type
    WHEN 'clinic'      THEN 'clinic_admin'
    WHEN 'hospital'    THEN 'hospital_admin'
    WHEN 'pharmacy'    THEN 'clinic_admin'
    WHEN 'supplier'    THEN 'supplier_admin'
    WHEN 'warehouse'   THEN 'warehouse_manager'
    WHEN 'distributor' THEN 'supplier_admin'
  END)::app_role;

  INSERT INTO public.organizations (name, type)
  VALUES (_name, _type)
  RETURNING * INTO _org;

  INSERT INTO public.memberships (user_id, org_id, role)
  VALUES (_uid, _org.id, _admin_role);

  UPDATE public.profiles SET current_org_id = _org.id WHERE id = _uid;

  RETURN _org;
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization_with_admin(text, org_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization_with_admin(text, org_type) TO authenticated;