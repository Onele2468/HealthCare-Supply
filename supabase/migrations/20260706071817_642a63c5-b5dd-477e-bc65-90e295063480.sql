
-- 1. Extend products with marketplace fields
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS description text;

-- 2. Marketplace read access: any signed-in user can browse active products & basic org info
DROP POLICY IF EXISTS "marketplace_products_read" ON public.products;
CREATE POLICY "marketplace_products_read" ON public.products
  FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "marketplace_orgs_read" ON public.organizations;
CREATE POLICY "marketplace_orgs_read" ON public.organizations
  FOR SELECT TO authenticated
  USING (true);

-- 3. Favourites
CREATE TABLE IF NOT EXISTS public.product_favourites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

GRANT SELECT, INSERT, DELETE ON public.product_favourites TO authenticated;
GRANT ALL ON public.product_favourites TO service_role;

ALTER TABLE public.product_favourites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favourites_own_read" ON public.product_favourites
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "favourites_own_insert" ON public.product_favourites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "favourites_own_delete" ON public.product_favourites
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Supplier reviews
CREATE TABLE IF NOT EXISTS public.supplier_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reviewer_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_org_id, reviewer_org_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_reviews TO authenticated;
GRANT ALL ON public.supplier_reviews TO service_role;

ALTER TABLE public.supplier_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_read_all" ON public.supplier_reviews
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "reviews_insert_own_org" ON public.supplier_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_user_id = auth.uid()
    AND public.is_org_member(auth.uid(), reviewer_org_id)
    AND reviewer_org_id <> supplier_org_id
  );

CREATE POLICY "reviews_update_own" ON public.supplier_reviews
  FOR UPDATE TO authenticated
  USING (reviewer_user_id = auth.uid())
  WITH CHECK (reviewer_user_id = auth.uid());

CREATE POLICY "reviews_delete_own" ON public.supplier_reviews
  FOR DELETE TO authenticated
  USING (reviewer_user_id = auth.uid());

CREATE TRIGGER trg_supplier_reviews_updated_at
  BEFORE UPDATE ON public.supplier_reviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5. Aggregate view for supplier ratings (avoids denormalized columns)
CREATE OR REPLACE VIEW public.supplier_rating_stats AS
  SELECT
    supplier_org_id,
    ROUND(AVG(rating)::numeric, 2) AS avg_rating,
    COUNT(*)::int AS review_count
  FROM public.supplier_reviews
  GROUP BY supplier_org_id;

GRANT SELECT ON public.supplier_rating_stats TO authenticated;
