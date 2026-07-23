
DROP VIEW IF EXISTS public.supplier_rating_stats;
CREATE VIEW public.supplier_rating_stats
  WITH (security_invoker = true) AS
  SELECT
    supplier_org_id,
    ROUND(AVG(rating)::numeric, 2) AS avg_rating,
    COUNT(*)::int AS review_count
  FROM public.supplier_reviews
  GROUP BY supplier_org_id;

GRANT SELECT ON public.supplier_rating_stats TO authenticated;
