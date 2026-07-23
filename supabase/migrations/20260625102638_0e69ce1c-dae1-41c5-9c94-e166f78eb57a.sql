-- Invitations table for email-based team invites
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');

CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL,
  token_hash text NOT NULL UNIQUE,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL,
  accepted_by uuid,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invitations_org_id_idx ON public.invitations(org_id);
CREATE INDEX invitations_email_idx ON public.invitations(lower(email));
CREATE UNIQUE INDEX invitations_unique_pending ON public.invitations(org_id, lower(email)) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Admins (any membership) of the org can view/manage invitations
CREATE POLICY "Org members view invitations"
  ON public.invitations FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members create invitations"
  ON public.invitations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id) AND invited_by = auth.uid());

CREATE POLICY "Org members update invitations"
  ON public.invitations FOR UPDATE
  TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members delete invitations"
  ON public.invitations FOR DELETE
  TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE TRIGGER invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Accept an invitation by token (called by authenticated user)
CREATE OR REPLACE FUNCTION public.accept_invitation(_token_hash text)
RETURNS public.invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _inv public.invitations;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _uid;

  SELECT * INTO _inv FROM public.invitations
   WHERE token_hash = _token_hash
   FOR UPDATE;

  IF _inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  IF _inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation is %', _inv.status;
  END IF;
  IF _inv.expires_at < now() THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = _inv.id;
    RAISE EXCEPTION 'Invitation has expired';
  END IF;
  IF lower(_inv.email) <> lower(_email) THEN
    RAISE EXCEPTION 'Invitation was sent to a different email address';
  END IF;

  INSERT INTO public.memberships (user_id, org_id, role)
  VALUES (_uid, _inv.org_id, _inv.role)
  ON CONFLICT (user_id, org_id, role) DO NOTHING;

  UPDATE public.profiles SET current_org_id = _inv.org_id WHERE id = _uid;

  UPDATE public.invitations
     SET status = 'accepted', accepted_by = _uid, accepted_at = now()
   WHERE id = _inv.id
   RETURNING * INTO _inv;

  RETURN _inv;
END;
$function$;

-- Lookup invitation by token (for the accept page, public read of minimal fields)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token_hash text)
RETURNS TABLE(id uuid, org_id uuid, org_name text, email text, role app_role, status invitation_status, expires_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT i.id, i.org_id, o.name, i.email, i.role, i.status, i.expires_at
    FROM public.invitations i
    JOIN public.organizations o ON o.id = i.org_id
   WHERE i.token_hash = _token_hash;
$function$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;