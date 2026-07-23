DO $$
DECLARE
  demo_org_ids uuid[];
  demo_warehouse_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO demo_org_ids
  FROM public.organizations
  WHERE name IN ('MedSupply SA', 'Sunrise Clinic');

  IF demo_org_ids IS NULL OR array_length(demo_org_ids, 1) = 0 THEN
    RETURN;
  END IF;

  SELECT array_agg(id) INTO demo_warehouse_ids
  FROM public.warehouses WHERE org_id = ANY(demo_org_ids);

  DELETE FROM public.deliveries WHERE po_id IN (
    SELECT id FROM public.purchase_orders
    WHERE buyer_org_id = ANY(demo_org_ids) OR supplier_org_id = ANY(demo_org_ids)
  );
  DELETE FROM public.purchase_order_items WHERE po_id IN (
    SELECT id FROM public.purchase_orders
    WHERE buyer_org_id = ANY(demo_org_ids) OR supplier_org_id = ANY(demo_org_ids)
  );
  DELETE FROM public.purchase_orders
    WHERE buyer_org_id = ANY(demo_org_ids) OR supplier_org_id = ANY(demo_org_ids);
  IF demo_warehouse_ids IS NOT NULL THEN
    DELETE FROM public.inventory WHERE warehouse_id = ANY(demo_warehouse_ids);
  END IF;
  DELETE FROM public.inventory WHERE product_id IN (
    SELECT id FROM public.products WHERE supplier_org_id = ANY(demo_org_ids)
  );
  DELETE FROM public.products WHERE supplier_org_id = ANY(demo_org_ids);
  DELETE FROM public.warehouses WHERE org_id = ANY(demo_org_ids);
  DELETE FROM public.memberships WHERE org_id = ANY(demo_org_ids);
  DELETE FROM public.invitations WHERE org_id = ANY(demo_org_ids);
  DELETE FROM public.join_requests WHERE org_id = ANY(demo_org_ids);
  DELETE FROM public.api_keys WHERE org_id = ANY(demo_org_ids);
  DELETE FROM public.audit_logs WHERE org_id = ANY(demo_org_ids);
  DELETE FROM public.organizations WHERE id = ANY(demo_org_ids);
END $$;