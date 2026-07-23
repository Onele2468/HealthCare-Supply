import { createFileRoute } from "@tanstack/react-router";
import { authenticate, json, preflight, requireScope } from "@/lib/public-api.server";

export const Route = createFileRoute("/api/public/v1/restock")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      // Returns low-stock items in the caller's warehouses with a recommended supplier.
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth.ok) return auth.response;
        const denied = requireScope(auth.caller, "inventory:read");
        if (denied) return denied;

        const { data, error } = await auth.admin
          .from("inventory")
          .select("id, product_id, quantity, reorder_threshold, warehouses!inner(org_id, name), products(name, sku, supplier_org_id, unit_price)")
          .eq("warehouses.org_id", auth.caller.orgId);
        if (error) return json({ error: error.message }, 500);

        const recs = (data ?? [])
          .filter((r: any) => r.quantity <= r.reorder_threshold)
          .map((r: any) => ({
            product_id: r.product_id,
            product_name: r.products?.name,
            sku: r.products?.sku,
            warehouse: r.warehouses?.name,
            on_hand: r.quantity,
            reorder_threshold: r.reorder_threshold,
            recommended_quantity: Math.max(r.reorder_threshold * 2 - r.quantity, r.reorder_threshold),
            recommended_supplier_id: r.products?.supplier_org_id,
            unit_price: r.products?.unit_price,
          }));
        return json({ recommendations: recs, count: recs.length });
      },
    },
  },
});
