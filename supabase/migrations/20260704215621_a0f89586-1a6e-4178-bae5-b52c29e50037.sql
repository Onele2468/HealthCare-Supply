
-- =========================================================================
-- Quotations module
-- =========================================================================

-- Add quotation_id link on purchase_orders (nullable to preserve existing flow)
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS quotation_id uuid;

-- ------------------------------------------------------------------ rfqs
CREATE TABLE public.rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_number text UNIQUE,
  buyer_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','quoted','accepted','rejected','expired','cancelled')),
  needed_by date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfqs TO authenticated;
GRANT ALL ON public.rfqs TO service_role;

ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rfqs_select_parties" ON public.rfqs
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), buyer_org_id)
    OR public.is_org_member(auth.uid(), supplier_org_id)
  );

CREATE POLICY "rfqs_write_buyer" ON public.rfqs
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), buyer_org_id))
  WITH CHECK (public.is_org_member(auth.uid(), buyer_org_id));

CREATE TRIGGER trg_rfqs_updated
  BEFORE UPDATE ON public.rfqs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.generate_rfq_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _n text; _try int := 0;
BEGIN
  IF NEW.rfq_number IS NOT NULL AND NEW.rfq_number <> '' THEN RETURN NEW; END IF;
  LOOP
    _n := 'RFQ-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.rfqs WHERE rfq_number = _n);
    _try := _try + 1;
    IF _try > 10 THEN RAISE EXCEPTION 'Could not generate RFQ number'; END IF;
  END LOOP;
  NEW.rfq_number := _n;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_rfqs_number
  BEFORE INSERT ON public.rfqs
  FOR EACH ROW EXECUTE FUNCTION public.generate_rfq_number();

-- --------------------------------------------------------------- rfq_items
CREATE TABLE public.rfq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_hint text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfq_items TO authenticated;
GRANT ALL ON public.rfq_items TO service_role;

ALTER TABLE public.rfq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rfq_items_select_parties" ON public.rfq_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rfqs r
    WHERE r.id = rfq_items.rfq_id
      AND (public.is_org_member(auth.uid(), r.buyer_org_id)
        OR public.is_org_member(auth.uid(), r.supplier_org_id))
  ));

CREATE POLICY "rfq_items_write_buyer" ON public.rfq_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rfqs r
    WHERE r.id = rfq_items.rfq_id
      AND public.is_org_member(auth.uid(), r.buyer_org_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rfqs r
    WHERE r.id = rfq_items.rfq_id
      AND public.is_org_member(auth.uid(), r.buyer_org_id)
  ));

-- ------------------------------------------------------------- quotations
CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text UNIQUE,
  rfq_id uuid REFERENCES public.rfqs(id) ON DELETE SET NULL,
  buyer_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','accepted','rejected','expired','withdrawn')),
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  valid_until date,
  payment_terms text,
  delivery_terms text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated;
GRANT ALL ON public.quotations TO service_role;

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotations_select_parties" ON public.quotations
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(auth.uid(), buyer_org_id)
    OR public.is_org_member(auth.uid(), supplier_org_id)
  );

CREATE POLICY "quotations_write_supplier" ON public.quotations
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), supplier_org_id))
  WITH CHECK (public.is_org_member(auth.uid(), supplier_org_id));

CREATE TRIGGER trg_quotations_updated
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _n text; _try int := 0;
BEGIN
  IF NEW.quote_number IS NOT NULL AND NEW.quote_number <> '' THEN RETURN NEW; END IF;
  LOOP
    _n := 'QT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.quotations WHERE quote_number = _n);
    _try := _try + 1;
    IF _try > 10 THEN RAISE EXCEPTION 'Could not generate quote number'; END IF;
  END LOOP;
  NEW.quote_number := _n;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_quotations_number
  BEFORE INSERT ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.generate_quote_number();

-- -------------------------------------------------------- quotation_items
CREATE TABLE public.quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  rfq_item_id uuid REFERENCES public.rfq_items(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotation_items TO authenticated;
GRANT ALL ON public.quotation_items TO service_role;

ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotation_items_select_parties" ON public.quotation_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quotations q
    WHERE q.id = quotation_items.quotation_id
      AND (public.is_org_member(auth.uid(), q.buyer_org_id)
        OR public.is_org_member(auth.uid(), q.supplier_org_id))
  ));

CREATE POLICY "quotation_items_write_supplier" ON public.quotation_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quotations q
    WHERE q.id = quotation_items.quotation_id
      AND public.is_org_member(auth.uid(), q.supplier_org_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.quotations q
    WHERE q.id = quotation_items.quotation_id
      AND public.is_org_member(auth.uid(), q.supplier_org_id)
  ));

-- ============================================================ RPC helpers

-- create_rfq: buyer creates an RFQ with items (draft)
CREATE OR REPLACE FUNCTION public.create_rfq(
  _supplier_org uuid,
  _needed_by date DEFAULT NULL,
  _notes text DEFAULT NULL,
  _items jsonb DEFAULT '[]'::jsonb,
  _send boolean DEFAULT false
) RETURNS public.rfqs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  INSERT INTO public.rfqs (buyer_org_id, supplier_org_id, needed_by, notes, created_by, status)
  VALUES (_buyer, _supplier_org, _needed_by, _notes, _uid, CASE WHEN _send THEN 'sent' ELSE 'draft' END)
  RETURNING * INTO _rfq;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    INSERT INTO public.rfq_items (rfq_id, product_id, description, quantity, unit_hint)
    VALUES (
      _rfq.id,
      NULLIF(_it->>'product_id','')::uuid,
      COALESCE(_it->>'description', ''),
      (_it->>'quantity')::numeric,
      _it->>'unit_hint'
    );
  END LOOP;

  RETURN _rfq;
END $$;

-- send_rfq: buyer moves draft -> sent
CREATE OR REPLACE FUNCTION public.send_rfq(_rfq_id uuid)
RETURNS public.rfqs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _rfq public.rfqs;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO _rfq FROM public.rfqs WHERE id = _rfq_id FOR UPDATE;
  IF _rfq.id IS NULL THEN RAISE EXCEPTION 'RFQ not found'; END IF;
  IF NOT public.is_org_member(_uid, _rfq.buyer_org_id) THEN
    RAISE EXCEPTION 'Only buyer can send RFQ' USING ERRCODE='42501';
  END IF;
  IF _rfq.status <> 'draft' THEN RAISE EXCEPTION 'RFQ is %', _rfq.status; END IF;
  UPDATE public.rfqs SET status = 'sent' WHERE id = _rfq_id RETURNING * INTO _rfq;
  RETURN _rfq;
END $$;

-- submit_quotation: supplier answers an RFQ (or creates standalone quote)
CREATE OR REPLACE FUNCTION public.submit_quotation(
  _rfq_id uuid,
  _items jsonb,
  _valid_until date DEFAULT NULL,
  _payment_terms text DEFAULT NULL,
  _delivery_terms text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _tax numeric DEFAULT 0
) RETURNS public.quotations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _supplier uuid;
  _rfq public.rfqs;
  _q public.quotations;
  _it jsonb;
  _subtotal numeric := 0;
  _line numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  SELECT current_org_id INTO _supplier FROM public.profiles WHERE id = _uid;
  IF _supplier IS NULL THEN RAISE EXCEPTION 'No active organization'; END IF;
  SELECT * INTO _rfq FROM public.rfqs WHERE id = _rfq_id FOR UPDATE;
  IF _rfq.id IS NULL THEN RAISE EXCEPTION 'RFQ not found'; END IF;
  IF _rfq.supplier_org_id <> _supplier THEN
    RAISE EXCEPTION 'This RFQ is not addressed to your organization' USING ERRCODE='42501';
  END IF;
  IF NOT public.is_org_member(_uid, _supplier) THEN
    RAISE EXCEPTION 'Not a member of the supplier organization' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  INSERT INTO public.quotations (
    rfq_id, buyer_org_id, supplier_org_id, status,
    valid_until, payment_terms, delivery_terms, notes, created_by, tax
  ) VALUES (
    _rfq.id, _rfq.buyer_org_id, _supplier, 'sent',
    _valid_until, _payment_terms, _delivery_terms, _notes, _uid, COALESCE(_tax,0)
  ) RETURNING * INTO _q;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _line := (_it->>'quantity')::numeric * (_it->>'unit_price')::numeric;
    _subtotal := _subtotal + _line;
    INSERT INTO public.quotation_items (
      quotation_id, rfq_item_id, product_id, description, quantity, unit_price, line_total
    ) VALUES (
      _q.id,
      NULLIF(_it->>'rfq_item_id','')::uuid,
      NULLIF(_it->>'product_id','')::uuid,
      COALESCE(_it->>'description',''),
      (_it->>'quantity')::numeric,
      (_it->>'unit_price')::numeric,
      _line
    );
  END LOOP;

  UPDATE public.quotations
     SET subtotal = _subtotal, total = _subtotal + COALESCE(_tax,0)
   WHERE id = _q.id
   RETURNING * INTO _q;

  UPDATE public.rfqs SET status = 'quoted' WHERE id = _rfq.id AND status IN ('sent','draft');

  RETURN _q;
END $$;

-- decide_quotation: buyer accepts or rejects; accept auto-creates PO
CREATE OR REPLACE FUNCTION public.decide_quotation(_quotation_id uuid, _accept boolean)
RETURNS public.quotations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _q public.quotations;
  _po_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO _q FROM public.quotations WHERE id = _quotation_id FOR UPDATE;
  IF _q.id IS NULL THEN RAISE EXCEPTION 'Quotation not found'; END IF;
  IF NOT public.is_org_member(_uid, _q.buyer_org_id) THEN
    RAISE EXCEPTION 'Only the buyer can decide a quotation' USING ERRCODE='42501';
  END IF;
  IF _q.status NOT IN ('sent') THEN
    RAISE EXCEPTION 'Quotation is %', _q.status;
  END IF;

  IF _accept THEN
    INSERT INTO public.purchase_orders (
      buyer_org_id, supplier_org_id, status, total_amount, notes, quotation_id
    ) VALUES (
      _q.buyer_org_id, _q.supplier_org_id, 'submitted', _q.total,
      COALESCE(_q.notes, '') || CASE WHEN _q.quote_number IS NOT NULL THEN E'\nFrom quotation ' || _q.quote_number ELSE '' END,
      _q.id
    ) RETURNING id INTO _po_id;

    INSERT INTO public.purchase_order_items (po_id, product_id, quantity, unit_price)
    SELECT _po_id, qi.product_id, qi.quantity, qi.unit_price
      FROM public.quotation_items qi
     WHERE qi.quotation_id = _q.id
       AND qi.product_id IS NOT NULL;

    UPDATE public.quotations SET status='accepted', decided_by=_uid, decided_at=now()
      WHERE id=_q.id RETURNING * INTO _q;
    IF _q.rfq_id IS NOT NULL THEN
      UPDATE public.rfqs SET status='accepted' WHERE id=_q.rfq_id;
    END IF;
  ELSE
    UPDATE public.quotations SET status='rejected', decided_by=_uid, decided_at=now()
      WHERE id=_q.id RETURNING * INTO _q;
  END IF;

  RETURN _q;
END $$;

-- withdraw_quotation: supplier withdraws before decision
CREATE OR REPLACE FUNCTION public.withdraw_quotation(_quotation_id uuid)
RETURNS public.quotations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _q public.quotations;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO _q FROM public.quotations WHERE id = _quotation_id FOR UPDATE;
  IF _q.id IS NULL THEN RAISE EXCEPTION 'Quotation not found'; END IF;
  IF NOT public.is_org_member(_uid, _q.supplier_org_id) THEN
    RAISE EXCEPTION 'Only the supplier can withdraw' USING ERRCODE='42501';
  END IF;
  IF _q.status NOT IN ('sent','draft') THEN
    RAISE EXCEPTION 'Quotation is %', _q.status;
  END IF;
  UPDATE public.quotations SET status='withdrawn' WHERE id=_q.id RETURNING * INTO _q;
  RETURN _q;
END $$;
