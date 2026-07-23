import { createFileRoute } from "@tanstack/react-router";
import { authenticate, json, preflight, requireScope } from "@/lib/public-api.server";

export const Route = createFileRoute("/api/public/v1/companies")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth.ok) return auth.response;
        const denied = requireScope(auth.caller, "network:read");
        if (denied) return denied;

        const url = new URL(request.url);
        const search = url.searchParams.get("search") ?? "";
        const type = url.searchParams.get("type");
        const industry = url.searchParams.get("industry");
        const country = url.searchParams.get("country");

        let q = auth.admin
          .from("organizations")
          .select("id, name, type, ownership, industry, country, province, website, description, status")
          .neq("status", "archived");
        if (search) q = q.ilike("name", `%${search}%`);
        if (type) q = q.eq("type", type);
        if (industry) q = q.eq("industry", industry);
        if (country) q = q.eq("country", country);
        const { data, error } = await q.limit(100);
        if (error) return json({ error: error.message }, 500);
        return json({ companies: data ?? [], count: data?.length ?? 0 });
      },
    },
  },
});
