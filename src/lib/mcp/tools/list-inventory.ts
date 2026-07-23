import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function client(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_inventory",
  title: "List inventory",
  description: "List inventory levels across the signed-in user's warehouses. Optionally filter to low-stock items.",
  inputSchema: {
    low_stock: z.boolean().optional().describe("Only return items below their reorder threshold."),
    warehouse_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ low_stock, warehouse_id, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = client(ctx)
      .from("inventory")
      .select("id, product_id, warehouse_id, quantity, reorder_level, products(name, sku), warehouses(name)")
      .limit(limit ?? 50);
    if (warehouse_id) q = q.eq("warehouse_id", warehouse_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = low_stock
      ? (data ?? []).filter((r: any) => r.reorder_level != null && r.quantity <= r.reorder_level)
      : data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(rows) }],
      structuredContent: { inventory: rows },
    };
  },
});
