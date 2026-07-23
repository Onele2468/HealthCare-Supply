import { createFileRoute } from "@tanstack/react-router";
import { authenticate, json, preflight, requireScope } from "@/lib/public-api.server";

export const Route = createFileRoute("/api/public/v1/connections")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth.ok) return auth.response;
        const denied = requireScope(auth.caller, "network:read");
        if (denied) return denied;

        const orgId = auth.caller.orgId;
        const { data, error } = await auth.admin
          .from("business_connections")
          .select("id, status, relationship, created_at, requester_org_id, addressee_org_id, requester:requester_org_id(id,name,type,industry), addressee:addressee_org_id(id,name,type,industry)")
          .or(`requester_org_id.eq.${orgId},addressee_org_id.eq.${orgId}`)
          .eq("status", "accepted");
        if (error) return json({ error: error.message }, 500);

        const connections = (data ?? []).map((c: any) => ({
          id: c.id,
          relationship: c.relationship,
          connected_at: c.created_at,
          partner: c.requester_org_id === orgId ? c.addressee : c.requester,
        }));
        return json({ connections, count: connections.length });
      },
    },
  },
});
