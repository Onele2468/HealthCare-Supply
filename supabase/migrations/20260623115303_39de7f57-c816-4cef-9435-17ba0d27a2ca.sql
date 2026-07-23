
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.org_type AS ENUM ('clinic','hospital','pharmacy','supplier','warehouse','distributor');
CREATE TYPE public.app_role AS ENUM (
  'super_admin','support_admin','compliance_admin',
  'supplier_admin','warehouse_manager','delivery_manager','supplier_staff',
  'clinic_admin','hospital_admin','pharmacist','inventory_manager','procurement_officer'
);
CREATE TYPE public.po_status AS ENUM ('draft','submitted','under_review','approved','processing','dispatched','delivered','cancelled');
CREATE TYPE public.delivery_status AS ENUM ('pending','processing','packed','in_transit','delivered','delayed','cancelled');

-- =========================================================
-- ORGANIZATIONS
-- =========================================================
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type public.org_type NOT NULL,
  contact_email text,
  contact_phone text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- PROFILES (user metadata + current org)
-- =========================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  current_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- MEMBERSHIPS (user <-> organization with role)
-- =========================================================
CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- HELPER FUNCTIONS (security definer to avoid RLS recursion)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_org_member(_user uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _user AND org_id = _org);
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user uuid, _org uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _user AND org_id = _org AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _user AND role = 'super_admin');
$$;

-- Profile auto-create on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- =========================================================
-- ORGANIZATIONS RLS
-- =========================================================
CREATE POLICY "members read their organizations" ON public.organizations
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "any authenticated can create organization" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "org admins update organization" ON public.organizations
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), id, 'supplier_admin') OR
    public.has_role(auth.uid(), id, 'clinic_admin') OR
    public.has_role(auth.uid(), id, 'hospital_admin') OR
    public.is_super_admin(auth.uid())
  );

CREATE TRIGGER organizations_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- PROFILES RLS
-- =========================================================
CREATE POLICY "users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- MEMBERSHIPS RLS
-- =========================================================
CREATE POLICY "users read own memberships" ON public.memberships
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_org_member(auth.uid(), org_id));
CREATE POLICY "users insert own initial membership" ON public.memberships
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "org admins manage memberships" ON public.memberships
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), org_id, 'supplier_admin') OR
    public.has_role(auth.uid(), org_id, 'clinic_admin') OR
    public.has_role(auth.uid(), org_id, 'hospital_admin') OR
    public.is_super_admin(auth.uid())
  );

-- =========================================================
-- WAREHOUSES
-- =========================================================
CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text,
  capacity int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access org warehouses" ON public.warehouses
  FOR ALL TO authenticated USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE TRIGGER warehouses_updated BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- PRODUCTS (medication catalog, owned by supplier orgs)
-- =========================================================
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  generic_name text,
  brand_name text,
  category text,
  dosage text,
  formulation text,
  packaging text,
  sku text,
  barcode text,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
-- All authenticated users can browse the catalog (needed for procurement). Only supplier members can edit.
CREATE POLICY "authenticated read catalog" ON public.products
  FOR SELECT TO authenticated USING (is_active OR public.is_org_member(auth.uid(), supplier_org_id));
CREATE POLICY "supplier members write products" ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(auth.uid(), supplier_org_id));
CREATE POLICY "supplier members update products" ON public.products
  FOR UPDATE TO authenticated USING (public.is_org_member(auth.uid(), supplier_org_id));
CREATE POLICY "supplier members delete products" ON public.products
  FOR DELETE TO authenticated USING (public.is_org_member(auth.uid(), supplier_org_id));
CREATE TRIGGER products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- INVENTORY (per warehouse, per product, batch + expiry)
-- =========================================================
CREATE TABLE public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number text,
  expiry_date date,
  quantity int NOT NULL DEFAULT 0,
  reorder_threshold int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO authenticated;
GRANT ALL ON public.inventory TO service_role;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warehouse org members access inventory" ON public.inventory
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = warehouse_id AND public.is_org_member(auth.uid(), w.org_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = warehouse_id AND public.is_org_member(auth.uid(), w.org_id))
  );
CREATE TRIGGER inventory_updated BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX inventory_warehouse_idx ON public.inventory(warehouse_id);
CREATE INDEX inventory_product_idx ON public.inventory(product_id);

-- =========================================================
-- PURCHASE ORDERS
-- =========================================================
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  po_number text NOT NULL DEFAULT ('PO-' || to_char(now(),'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  status public.po_status NOT NULL DEFAULT 'draft',
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buyer or supplier members access PO" ON public.purchase_orders
  FOR ALL TO authenticated USING (
    public.is_org_member(auth.uid(), buyer_org_id) OR public.is_org_member(auth.uid(), supplier_org_id)
  ) WITH CHECK (
    public.is_org_member(auth.uid(), buyer_org_id) OR public.is_org_member(auth.uid(), supplier_org_id)
  );
CREATE TRIGGER po_updated BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PO members access items" ON public.purchase_order_items
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id
      AND (public.is_org_member(auth.uid(), po.buyer_org_id) OR public.is_org_member(auth.uid(), po.supplier_org_id)))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id
      AND (public.is_org_member(auth.uid(), po.buyer_org_id) OR public.is_org_member(auth.uid(), po.supplier_org_id)))
  );

-- =========================================================
-- DELIVERIES
-- =========================================================
CREATE TABLE public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  status public.delivery_status NOT NULL DEFAULT 'pending',
  tracking_number text,
  driver_name text,
  estimated_delivery date,
  actual_delivery timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliveries TO authenticated;
GRANT ALL ON public.deliveries TO service_role;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PO members access deliveries" ON public.deliveries
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id
      AND (public.is_org_member(auth.uid(), po.buyer_org_id) OR public.is_org_member(auth.uid(), po.supplier_org_id)))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id
      AND (public.is_org_member(auth.uid(), po.buyer_org_id) OR public.is_org_member(auth.uid(), po.supplier_org_id)))
  );
CREATE TRIGGER deliveries_updated BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- AUDIT LOG
-- =========================================================
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read audit" ON public.audit_logs
  FOR SELECT TO authenticated USING (org_id IS NULL OR public.is_org_member(auth.uid(), org_id));
CREATE POLICY "org members insert audit" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
