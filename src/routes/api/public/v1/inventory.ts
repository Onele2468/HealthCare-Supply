import { createFileRoute } from "@tanstack/react-router";
import { authenticate, json, preflight, requireScope } from "@/lib/public-api.server";

export const Route = createFileRoute("/api/public/v1/inventory")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth.ok) return auth.response;
        const denied = requireScope(auth.caller, "inventory:read");
        if (denied) return denied;

        const url = new URL(request.url);
        const productId = url.searchParams.get("product_id");
        const lowOnly = url.searchParams.get("low_stock") === "true";

        // Inventory belongs to warehouses in the caller's org.
        let q = auth.admin
          .from("inventory")
          .select("id, product_id, warehouse_id, batch_number, expiry_date, quantity, reorder_threshold, warehouses!inner(org_id, name), products(name, sku, unit_price)")
          .eq("warehouses.org_id", auth.caller.orgId);
        if (productId) q = q.eq("product_id", productId);
        const { data, error } = await q.limit(500);
        if (error) return json({ error: error.message }, 500);

        const items = (data ?? [])
          .filter((r: any) => !lowOnly || r.quantity <= r.reorder_threshold)
          .map((r: any) => ({
            id: r.id,
            product_id: r.product_id,
            product_name: r.products?.name,
            sku: r.products?.sku,
            unit_price: r.products?.unit_price,
            warehouse_id: r.warehouse_id,
            warehouse_name: r.warehouses?.name,
            batch_number: r.batch_number,
            expiry_date: r.expiry_date,
            quantity: r.quantity,
            reorder_threshold: r.reorder_threshold,
            low_stock: r.quantity <= r.reorder_threshold,
          }));
        return json({ items, count: items.length });
      },
    },
  },
});
