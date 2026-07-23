import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticate, json, preflight, requireScope } from "@/lib/public-api.server";

const Body = z.object({
  supplier_org_id: z.string().uuid(),
  notes: z.string().max(2000).optional(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().positive().max(100000),
    unit_price: z.number().nonnegative().optional(),
  })).min(1).max(200),
  submit: z.boolean().optional(),
});

export const Route = createFileRoute("/api/public/v1/purchase-orders")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth.ok) return auth.response;
        const denied = requireScope(auth.caller, "purchase-orders:read");
        if (denied) return denied;

        const { data, error } = await auth.admin
          .from("purchase_orders")
          .select("id, po_number, status, supplier_org_id, total_amount, created_at, updated_at")
          .eq("buyer_org_id", auth.caller.orgId)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) return json({ error: error.message }, 500);
        return json({ items: data ?? [], count: data?.length ?? 0 });
      },
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth.ok) return auth.response;
        const denied = requireScope(auth.caller, "purchase-orders:write");
        if (denied) return denied;

        let payload;
        try { payload = Body.parse(await request.json()); }
        catch (e: any) { return json({ error: "Invalid body", details: e.errors ?? String(e) }, 400); }

        // Fetch products to resolve prices & validate supplier ownership
        const ids = payload.items.map((i) => i.product_id);
        const { data: products, error: pErr } = await auth.admin
          .from("products")
          .select("id, supplier_org_id, unit_price, is_active")
          .in("id", ids);
        if (pErr) return json({ error: pErr.message }, 500);
        const byId = new Map(products?.map((p) => [p.id, p]) ?? []);
        for (const item of payload.items) {
          const p = byId.get(item.product_id);
          if (!p || !p.is_active) return json({ error: `Unknown or inactive product ${item.product_id}` }, 400);
          if (p.supplier_org_id !== payload.supplier_org_id)
            return json({ error: `Product ${item.product_id} does not belong to supplier ${payload.supplier_org_id}` }, 400);
        }

        const itemRows = payload.items.map((i) => {
          const price = i.unit_price ?? Number(byId.get(i.product_id)!.unit_price);
          return { product_id: i.product_id, quantity: i.quantity, unit_price: price };
        });
        const total = itemRows.reduce((s, r) => s + r.unit_price * r.quantity, 0);

        const { data: po, error: poErr } = await auth.admin
          .from("purchase_orders")
          .insert({
            buyer_org_id: auth.caller.orgId,
            supplier_org_id: payload.supplier_org_id,
            status: payload.submit ? "submitted" : "draft",
            total_amount: total,
            notes: payload.notes ?? null,
          })
          .select("id, po_number, status, total_amount, created_at")
          .single();
        if (poErr || !po) return json({ error: poErr?.message ?? "Failed to create PO" }, 500);

        const { error: itemsErr } = await auth.admin
          .from("purchase_order_items")
          .insert(itemRows.map((r) => ({ po_id: po.id, ...r })));
        if (itemsErr) {
          await auth.admin.from("purchase_orders").delete().eq("id", po.id);
          return json({ error: itemsErr.message }, 500);
        }

        await auth.admin.from("audit_logs").insert({
          org_id: auth.caller.orgId,
          action: "po.created.api",
          entity: "purchase_order",
          entity_id: po.id,
          metadata: { source: "public_api", key_id: auth.caller.keyId },
        });

        return json({ purchase_order: po }, 201);
      },
    },
  },
});
