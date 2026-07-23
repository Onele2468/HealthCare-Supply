import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentContext, DELIVERY_STATUSES, STATUS_TONE, logAudit, type DeliveryStatus } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/deliveries")({
  head: () => ({ meta: [{ title: "Deliveries — Smart Supply" }] }),
  component: DeliveriesPage,
});

function DeliveriesPage() {
  const qc = useQueryClient();
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });
  const orgId = ctx?.currentOrg?.id;

  const { data: deliveries } = useQuery({
    queryKey: ["deliveries", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("*, po:purchase_orders!inner(id, po_number, buyer_org_id, supplier_org_id, buyer:organizations!buyer_org_id(name), supplier:organizations!supplier_org_id(name))")
        .or(`buyer_org_id.eq.${orgId},supplier_org_id.eq.${orgId}`, { foreignTable: "purchase_orders" })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const update = async (id: string, patch: any) => {
    const { error } = await supabase.from("deliveries").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    if (orgId) logAudit(orgId, "delivery.updated", "delivery", id, patch);
    qc.invalidateQueries({ queryKey: ["deliveries"] });
  };

  const confirmReceipt = async (d: any) => {
    const { data: userRes } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    const { error } = await supabase.from("deliveries").update({
      status: "delivered", actual_delivery: now,
      received_by: userRes.user?.id ?? null, received_at: now,
    }).eq("id", d.id);
    if (error) return toast.error(error.message);
    // Reflect on PO
    await supabase.from("purchase_orders").update({ status: "delivered" }).eq("id", d.po_id);
    if (orgId) logAudit(orgId, "delivery.received", "delivery", d.id);
    toast.success("Goods receipt confirmed");
    qc.invalidateQueries({ queryKey: ["deliveries"] });
    qc.invalidateQueries({ queryKey: ["pos"] });
  };

  return (
    <AppShell>
      <div className="p-8 max-w-7xl">
        <h1 className="text-2xl font-semibold tracking-tight">Deliveries</h1>
        <p className="text-sm text-muted-foreground">Track shipments from dispatch through proof of delivery. Buyers confirm receipt to close the order.</p>

        <Card className="mt-6 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead><TableHead>From</TableHead><TableHead>To</TableHead>
                <TableHead>Tracking</TableHead><TableHead>Driver</TableHead><TableHead>ETA</TableHead>
                <TableHead>Status</TableHead><TableHead>Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries?.map((d: any) => {
                const isBuyer = d.po?.buyer_org_id === orgId;
                return (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">{d.po?.po_number}</TableCell>
                  <TableCell className="text-sm">{d.po?.supplier?.name}</TableCell>
                  <TableCell className="text-sm">{d.po?.buyer?.name}</TableCell>
                  <TableCell><Input className="h-8 w-32" defaultValue={d.tracking_number ?? ""} onBlur={(e) => e.target.value !== (d.tracking_number ?? "") && update(d.id, { tracking_number: e.target.value })} /></TableCell>
                  <TableCell><Input className="h-8 w-32" defaultValue={d.driver_name ?? ""} onBlur={(e) => e.target.value !== (d.driver_name ?? "") && update(d.id, { driver_name: e.target.value })} /></TableCell>
                  <TableCell><Input type="date" className="h-8 w-36" defaultValue={d.estimated_delivery ?? ""} onBlur={(e) => e.target.value !== (d.estimated_delivery ?? "") && update(d.id, { estimated_delivery: e.target.value || null })} /></TableCell>
                  <TableCell>
                    <Select value={d.status} onValueChange={(v) => update(d.id, { status: v as DeliveryStatus, ...(v === "delivered" ? { actual_delivery: new Date().toISOString() } : {}) })}>
                      <SelectTrigger className={`h-7 text-xs px-2 ${STATUS_TONE[d.status]} border-0 w-[120px]`}><SelectValue /></SelectTrigger>
                      <SelectContent>{DELIVERY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {d.received_at ? (
                      <span className="text-xs text-success">✓ {new Date(d.received_at).toLocaleDateString()}</span>
                    ) : isBuyer && ["in_transit","delivered","packed"].includes(d.status) ? (
                      <Button size="sm" variant="outline" onClick={() => confirmReceipt(d)}>Confirm receipt</Button>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              );})}
              {!deliveries?.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No deliveries yet. They're created automatically when a purchase order is dispatched.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppShell>
  );
}
