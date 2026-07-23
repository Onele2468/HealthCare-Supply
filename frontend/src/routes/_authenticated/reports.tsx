import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentContext, STATUS_TONE } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Smart Supply" }] }),
  component: ReportsPage,
});

function exportCsv(name: string, rows: any[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });
  const orgId = ctx?.currentOrg?.id;
  const [tab, setTab] = useState("inventory");

  const { data: inventory } = useQuery({
    queryKey: ["rep-inv", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory")
        .select("quantity, reorder_threshold, batch_number, expiry_date, product:products(name, sku), warehouse:warehouses!inner(name, org_id)")
        .eq("warehouse.org_id", orgId!);
      return (data ?? []).map((r: any) => ({
        product: r.product?.name, sku: r.product?.sku, warehouse: r.warehouse?.name,
        quantity: r.quantity, reorder_threshold: r.reorder_threshold,
        batch: r.batch_number, expiry: r.expiry_date,
        status: r.quantity <= r.reorder_threshold ? "LOW" : "OK",
      }));
    },
  });

  const { data: pos } = useQuery({
    queryKey: ["rep-pos", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase.from("purchase_orders")
        .select("po_number, status, total_amount, created_at, buyer:organizations!buyer_org_id(name), supplier:organizations!supplier_org_id(name)")
        .or(`buyer_org_id.eq.${orgId},supplier_org_id.eq.${orgId}`)
        .order("created_at", { ascending: false });
      return (data ?? []).map((r: any) => ({
        po_number: r.po_number, buyer: r.buyer?.name, supplier: r.supplier?.name,
        status: r.status, total: Number(r.total_amount), date: r.created_at?.slice(0, 10),
      }));
    },
  });

  const { data: deliveries } = useQuery({
    queryKey: ["rep-del", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase.from("deliveries")
        .select("status, tracking_number, driver_name, estimated_delivery, actual_delivery, received_at, created_at, po:purchase_orders!inner(po_number, buyer_org_id, supplier_org_id)")
        .or(`buyer_org_id.eq.${orgId},supplier_org_id.eq.${orgId}`, { foreignTable: "purchase_orders" })
        .order("created_at", { ascending: false });
      return (data ?? []).map((r: any) => ({
        po: r.po?.po_number, tracking: r.tracking_number, driver: r.driver_name,
        status: r.status, eta: r.estimated_delivery, delivered_at: r.actual_delivery,
        received_at: r.received_at,
      }));
    },
  });

  const { data: quotations } = useQuery({
    queryKey: ["rep-quotes", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase.from("quotations")
        .select("quote_number, status, total, currency, valid_until, created_at, buyer:organizations!buyer_org_id(name), supplier:organizations!supplier_org_id(name), rfq:rfqs(rfq_number)")
        .or(`buyer_org_id.eq.${orgId},supplier_org_id.eq.${orgId}`)
        .order("created_at", { ascending: false });
      return (data ?? []).map((r: any) => ({
        quote_number: r.quote_number, rfq: r.rfq?.rfq_number, buyer: r.buyer?.name, supplier: r.supplier?.name,
        status: r.status, total: Number(r.total), valid_until: r.valid_until, date: r.created_at?.slice(0, 10),
      }));
    },
  });

  const { data: rfqs } = useQuery({
    queryKey: ["rep-rfqs", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase.from("rfqs")
        .select("rfq_number, status, priority, needed_by, created_at, buyer:organizations!buyer_org_id(name), supplier:organizations!supplier_org_id(name)")
        .or(`buyer_org_id.eq.${orgId},supplier_org_id.eq.${orgId}`)
        .order("created_at", { ascending: false });
      return (data ?? []).map((r: any) => ({
        rfq_number: r.rfq_number, buyer: r.buyer?.name, supplier: r.supplier?.name,
        status: r.status, priority: r.priority, needed_by: r.needed_by, date: r.created_at?.slice(0, 10),
      }));
    },
  });

  const lowStock = (inventory ?? []).filter((i: any) => i.status === "LOW");

  return (
    <AppShell>
      <div className="p-8 max-w-7xl">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Operational reports across inventory, procurement and logistics.</p>

        <Tabs value={tab} onValueChange={setTab} className="mt-6">
          <TabsList>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="low">Low stock</TabsTrigger>
            <TabsTrigger value="rfqs">RFQs</TabsTrigger>
            <TabsTrigger value="quotations">Quotations</TabsTrigger>
            <TabsTrigger value="pos">Purchase orders</TabsTrigger>
            <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory">
            <ReportCard title="Inventory snapshot" rows={inventory ?? []} onExport={() => exportCsv("inventory", inventory ?? [])}
              columns={["product", "sku", "warehouse", "quantity", "reorder_threshold", "batch", "expiry", "status"]} />
          </TabsContent>
          <TabsContent value="low">
            <ReportCard title="Low stock alerts" rows={lowStock} onExport={() => exportCsv("low-stock", lowStock)}
              columns={["product", "sku", "warehouse", "quantity", "reorder_threshold", "expiry"]} />
          </TabsContent>
          <TabsContent value="rfqs">
            <ReportCard title="Requests for quotation" rows={rfqs ?? []} onExport={() => exportCsv("rfqs", rfqs ?? [])}
              columns={["rfq_number", "buyer", "supplier", "priority", "status", "needed_by", "date"]} statusCol="status" />
          </TabsContent>
          <TabsContent value="quotations">
            <ReportCard title="Quotations" rows={quotations ?? []} onExport={() => exportCsv("quotations", quotations ?? [])}
              columns={["quote_number", "rfq", "buyer", "supplier", "status", "total", "valid_until", "date"]} statusCol="status" />
          </TabsContent>
          <TabsContent value="pos">
            <ReportCard title="Purchase orders" rows={pos ?? []} onExport={() => exportCsv("purchase-orders", pos ?? [])}
              columns={["po_number", "buyer", "supplier", "status", "total", "date"]} statusCol="status" />
          </TabsContent>
          <TabsContent value="deliveries">
            <ReportCard title="Deliveries" rows={deliveries ?? []} onExport={() => exportCsv("deliveries", deliveries ?? [])}
              columns={["po", "tracking", "driver", "status", "eta", "delivered_at", "received_at"]} statusCol="status" />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function ReportCard({ title, rows, columns, onExport, statusCol }: { title: string; rows: any[]; columns: string[]; onExport: () => void; statusCol?: string }) {
  return (
    <Card className="mt-4 p-0 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{rows.length} record{rows.length === 1 ? "" : "s"}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onExport} disabled={!rows.length}><Download className="size-4 mr-1.5" /> Export CSV</Button>
      </div>
      <Table>
        <TableHeader><TableRow>{columns.map((c) => <TableHead key={c} className="capitalize">{c.replace(/_/g, " ")}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.map((r, idx) => (
            <TableRow key={idx}>
              {columns.map((c) => (
                <TableCell key={c} className="text-sm">
                  {statusCol === c && r[c]
                    ? <span className={`text-xs px-2 py-1 rounded-md ${STATUS_TONE[r[c]] ?? ""}`}>{String(r[c]).replace(/_/g, " ")}</span>
                    : (typeof r[c] === "number" ? <span className="tabular-nums">{r[c].toLocaleString()}</span> : (r[c] ?? "—"))}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {!rows.length && <TableRow><TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">No data.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );
}
