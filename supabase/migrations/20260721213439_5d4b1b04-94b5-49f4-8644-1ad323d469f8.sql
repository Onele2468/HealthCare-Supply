
ALTER TABLE public.rfqs
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine','urgent','emergency')),
  ADD COLUMN IF NOT EXISTS cold_chain_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_location text;

ALTER TABLE public.rfq_items
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS brand_preference text,
  ADD COLUMN IF NOT EXISTS specifications text;

CREATE OR REPLACE FUNCTION public.create_rfq(
  _supplier_org uuid,
  _needed_by date DEFAULT NULL::date,
  _notes text DEFAULT NULL::text,
  _items jsonb DEFAULT '[]'::jsonb,
  _send boolean DEFAULT false,
  _priority text DEFAULT 'routine',
  _cold_chain boolean DEFAULT false,
  _delivery_location text DEFAULT NULL
)
RETURNS public.rfqs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _buyer uuid;
  _rfq public.rfqs;
  _it jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  SELECT current_org_id INTO _buyer FROM public.profiles WHERE id = _uid;
  IF _buyer IS NULL THEN RAISE EXCEPTION 'No active organization'; END IF;
  IF _buyer = _supplier_org THEN RAISE EXCEPTION 'Cannot RFQ your own organization'; END IF;
  IF NOT public.is_org_member(_uid, _buyer) THEN
    RAISE EXCEPTION 'Not a member of the buyer organization' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;

  INSERT INTO public.rfqs (buyer_org_id, supplier_org_id, needed_by, notes, created_by, status, priority, cold_chain_required, delivery_location)
  VALUES (_buyer, _supplier_org, _needed_by, _notes, _uid, CASE WHEN _send THEN 'sent' ELSE 'draft' END,
          COALESCE(_priority,'routine'), COALESCE(_cold_chain,false), _delivery_location)
  RETURNING * INTO _rfq;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    INSERT INTO public.rfq_items (rfq_id, product_id, description, quantity, unit_hint, category, brand_preference, specifications)
    VALUES (
      _rfq.id,
      NULLIF(_it->>'product_id','')::uuid,
      COALESCE(_it->>'description', ''),
      (_it->>'quantity')::numeric,
      _it->>'unit_hint',
      NULLIF(_it->>'category',''),
      NULLIF(_it->>'brand_preference',''),
      NULLIF(_it->>'specifications','')
    );
  END LOOP;

  RETURN _rfq;
END $function$;
