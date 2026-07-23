import { createFileRoute } from "@tanstack/react-router";
import { authenticate, json, preflight, requireScope } from "@/lib/public-api.server";

export const Route = createFileRoute("/api/public/v1/products")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth.ok) return auth.response;
        const denied = requireScope(auth.caller, "products:read");
        if (denied) return denied;

        const url = new URL(request.url);
        const search = url.searchParams.get("search");
        const supplierId = url.searchParams.get("supplier_id");

        let q = auth.admin
          .from("products")
          .select("id, supplier_org_id, name, generic_name, brand_name, category, dosage, formulation, packaging, sku, barcode, unit_price")
          .eq("is_active", true)
          .limit(200);
        if (supplierId) q = q.eq("supplier_org_id", supplierId);
        if (search) q = q.ilike("name", `%${search}%`);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 500);
        return json({ items: data ?? [], count: data?.length ?? 0 });
      },
    },
  },
});
