import { createFileRoute } from "@tanstack/react-router";
import { authenticate, json, preflight, requireScope } from "@/lib/public-api.server";

export const Route = createFileRoute("/api/public/v1/deliveries/$id")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await authenticate(request);
        if (!auth.ok) return auth.response;
        const denied = requireScope(auth.caller, "deliveries:read");
        if (denied) return denied;

        const { data, error } = await auth.admin
          .from("deliveries")
          .select("id, status, tracking_number, driver_name, estimated_delivery, actual_delivery, notes, created_at, updated_at, purchase_orders!inner(id, po_number, buyer_org_id, supplier_org_id)")
          .eq("id", params.id)
          .maybeSingle();
        if (error) return json({ error: error.message }, 500);
        if (!data) return json({ error: "Not found" }, 404);

        const po = (data as any).purchase_orders;
        if (po.buyer_org_id !== auth.caller.orgId && po.supplier_org_id !== auth.caller.orgId)
          return json({ error: "Forbidden" }, 403);

        return json({
          id: data.id,
          status: data.status,
          tracking_number: data.tracking_number,
          driver_name: data.driver_name,
          estimated_delivery: data.estimated_delivery,
          actual_delivery: data.actual_delivery,
          notes: data.notes,
          purchase_order: { id: po.id, po_number: po.po_number },
        });
      },
    },
  },
});
