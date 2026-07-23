import { createFileRoute } from "@tanstack/react-router";
import { authenticate, json, preflight, requireScope } from "@/lib/public-api.server";

export const Route = createFileRoute("/api/public/v1/quotations")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth.ok) return auth.response;
        const denied = requireScope(auth.caller, "quotations:read");
        if (denied) return denied;

        const { data, error } = await auth.admin
          .from("quotations")
          .select("id, quote_number, rfq_id, status, subtotal, tax, total, currency, valid_until, payment_terms, delivery_terms, notes, buyer_org_id, supplier_org_id, created_at, items:quotation_items(id, rfq_item_id, product_id, description, quantity, unit_price, line_total)")
          .or(`buyer_org_id.eq.${auth.caller.orgId},supplier_org_id.eq.${auth.caller.orgId}`)
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) return json({ error: error.message }, 500);
        return json({ items: data ?? [], count: data?.length ?? 0 });
      },
    },
  },
});
