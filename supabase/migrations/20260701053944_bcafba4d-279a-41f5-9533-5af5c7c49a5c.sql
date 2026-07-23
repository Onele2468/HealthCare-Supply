
-- 1) Extend organizations SELECT so partners are visible via connections or PO history.
CREATE POLICY "partners readable via connections"
  ON public.organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.business_connections bc
      JOIN public.memberships m ON m.user_id = auth.uid()
      WHERE bc.status = 'accepted'
        AND (
          (bc.requester_org_id = organizations.id AND bc.addressee_org_id = m.org_id)
          OR (bc.addressee_org_id = organizations.id AND bc.requester_org_id = m.org_id)
        )
    )
  );

CREATE POLICY "partners readable via purchase orders"
  ON public.organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.purchase_orders po
      JOIN public.memberships m ON m.user_id = auth.uid()
      WHERE (
        (po.buyer_org_id = organizations.id AND po.supplier_org_id = m.org_id)
        OR (po.supplier_org_id = organizations.id AND po.buyer_org_id = m.org_id)
      )
    )
  );

-- 2) Fix UPDATE policy to include modern org_admin role.
DROP POLICY IF EXISTS "org admins update organization" ON public.organizations;
CREATE POLICY "org admins update organization"
  ON public.organizations FOR UPDATE
  USING (
    public.has_role(auth.uid(), id, 'org_admin'::app_role)
    OR public.has_role(auth.uid(), id, 'supplier_admin'::app_role)
    OR public.has_role(auth.uid(), id, 'clinic_admin'::app_role)
    OR public.has_role(auth.uid(), id, 'hospital_admin'::app_role)
    OR public.is_super_admin(auth.uid())
  );

-- 3) Default currency for new organizations to ZAR, backfill any nulls.
ALTER TABLE public.organizations ALTER COLUMN currency SET DEFAULT 'ZAR';
UPDATE public.organizations SET currency = 'ZAR' WHERE currency IS NULL;
