import { createFileRoute } from "@tanstack/react-router";
import { authenticate, json, preflight, requireScope } from "@/lib/public-api.server";

export const Route = createFileRoute("/api/public/v1/rfqs")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth.ok) return auth.response;
        const denied = requireScope(auth.caller, "rfqs:read");
        if (denied) return denied;

        const { data, error } = await auth.admin
          .from("rfqs")
          .select("id, rfq_number, status, priority, cold_chain_required, needed_by, delivery_location, buyer_org_id, supplier_org_id, notes, created_at, items:rfq_items(id, product_id, description, quantity, unit_hint, category, brand_preference, specifications)")
          .or(`buyer_org_id.eq.${auth.caller.orgId},supplier_org_id.eq.${auth.caller.orgId}`)
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) return json({ error: error.message }, 500);
        return json({ items: data ?? [], count: data?.length ?? 0 });
      },
    },
  },
});
