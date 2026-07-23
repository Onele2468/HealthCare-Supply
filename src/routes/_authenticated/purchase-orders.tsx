import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentContext, logAudit, PO_STATUSES, STATUS_TONE, type PoStatus } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Receipt } from "lucide-react";

const PAYMENT_STATUSES = ["unpaid", "partial", "paid", "overdue", "cancelled"] as const;
type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
const PAYMENT_TONE: Record<string, string> = {
  unpaid: "bg-muted text-muted-foreground",
  partial: "bg-warning/15 text-warning-foreground",
  paid: "bg-success/20 text-success",
  overdue: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export const Route = createFileRoute("/_authenticated/purchase-orders")({
  head: () => ({ meta: [{ title: "Purchase Orders — Smart Supply" }] }),
  component: POPage,
});

function POPage() {
  const qc = useQueryClient();
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });
  const orgId = ctx?.currentOrg?.id;

  const { data: pos } = useQuery({
    queryKey: ["pos", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, buyer:organizations!buyer_org_id(name), supplier:organizations!supplier_org_id(name), quotation:quotations(quote_number)" as any)
        .or(`buyer_org_id.eq.${orgId},supplier_org_id.eq.${orgId}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = async (id: string, status: PoStatus) => {
    const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    if (orgId) logAudit(orgId, `po.status.${status}`, "purchase_order", id);

    // Auto-create delivery on dispatch
    if (status === "dispatched") {
      await supabase.from("deliveries").insert({ po_id: id, status: "in_transit" });
    }
    if (status === "delivered") {
      await supabase.from("deliveries").update({ status: "delivered", actual_delivery: new Date().toISOString() }).eq("po_id", id);
    }
    toast.success(`Status updated to ${status.replace(/_/g, " ")}`);
    qc.invalidateQueries({ queryKey: ["pos"] });
  };

  const [paying, setPaying] = useState<any | null>(null);

  return (
    <AppShell>
      <div className="p-8 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Purchase orders</h1>
            <p className="text-sm text-muted-foreground">Create, approve and track procurement orders. Payments are recorded here for audit — Smart Supply does not process payments.</p>
          </div>
          {orgId && <CreatePO orgId={orgId} onDone={() => qc.invalidateQueries({ queryKey: ["pos"] })} />}
        </div>

        <Card className="mt-6 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead><TableHead>Buyer</TableHead><TableHead>Supplier</TableHead>
                <TableHead>Created</TableHead><TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead><TableHead>Payment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pos?.map((p: any) => {
                const isBuyer = p.buyer_org_id === orgId;
                return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.po_number}{p.quotation?.quote_number && <span className="ml-1 text-muted-foreground">· {p.quotation.quote_number}</span>}</TableCell>
                  <TableCell className="text-sm">{p.buyer?.name}</TableCell>
                  <TableCell className="text-sm">{p.supplier?.name}</TableCell>
                  <TableCell className="text-sm">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(p.total_amount, p.currency ?? "ZAR")}</TableCell>
                  <TableCell>
                    <Select value={p.status} onValueChange={(v) => updateStatus(p.id, v as PoStatus)}>
                      <SelectTrigger className={`h-7 text-xs px-2 ${STATUS_TONE[p.status]} border-0 w-[140px]`}><SelectValue /></SelectTrigger>
                      <SelectContent>{PO_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${PAYMENT_TONE[p.payment_status ?? "unpaid"]}`}>
                      {p.payment_status ?? "unpaid"}
                    </span>
                    {p.invoice_number && <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{p.invoice_number}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    {isBuyer && <Button size="sm" variant="ghost" onClick={() => setPaying(p)}><Receipt className="size-3.5 mr-1" />Payment</Button>}
                  </TableCell>
                </TableRow>
              );})}
              {!pos?.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No purchase orders yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>

        {paying && orgId && <PaymentDialog po={paying} orgId={orgId} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); qc.invalidateQueries({ queryKey: ["pos"] }); }} />}
      </div>
    </AppShell>
  );
}

function PaymentDialog({ po, orgId, onClose, onSaved }: { po: any; orgId: string; onClose: () => void; onSaved: () => void }) {
  const [terms, setTerms] = useState(po.payment_terms ?? "");
  const [method, setMethod] = useState(po.payment_method ?? "");
  const [invNum, setInvNum] = useState(po.invoice_number ?? "");
  const [invDate, setInvDate] = useState(po.invoice_date ?? "");
  const [status, setStatus] = useState<PaymentStatus>(po.payment_status ?? "unpaid");
  const save = async () => {
    const patch = {
      payment_terms: terms || null, payment_method: method || null,
      invoice_number: invNum || null, invoice_date: invDate || null,
      payment_status: status,
    };
    const { error } = await supabase.from("purchase_orders").update(patch).eq("id", po.id);
    if (error) return toast.error(error.message);
    logAudit(orgId, "po.payment.updated", "purchase_order", po.id, patch);
    toast.success("Payment metadata saved");
    onSaved();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Payment · {po.po_number}</DialogTitle>
          <p className="text-xs text-muted-foreground">Record-keeping only. Smart Supply does not process payments.</p>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Payment terms</Label><Input value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="30 days from invoice" /></div>
          <div><Label>Payment method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                {["EFT / Bank transfer","Credit card","Cash","Cheque","Debit order","Other"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Invoice number</Label><Input value={invNum} onChange={(e) => setInvNum(e.target.value)} /></div>
            <div><Label>Invoice date</Label><Input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} /></div>
          </div>
          <div><Label>Payment status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as PaymentStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Line = { product_id: string; product_name: string; quantity: number; unit_price: number };

function CreatePO({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState("");

  const { data: suppliers } = useQuery({
    queryKey: ["po-supplier-connections", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("business_connections")
        .select("requester_org_id, addressee_org_id, requester:requester_org_id(id,name,type), addressee:addressee_org_id(id,name,type)")
        .eq("status", "accepted")
        .or(`requester_org_id.eq.${orgId},addressee_org_id.eq.${orgId}`);
      return (data ?? [])
        .map((c: any) => (c.requester_org_id === orgId ? c.addressee : c.requester))
        .filter((s: any) => s && s.id);
    },
  });

  const { data: products } = useQuery({
    queryKey: ["po-products", supplierId, q],
    enabled: !!supplierId,
    queryFn: async () => {
      let qy = supabase.from("products").select("id, name, sku, unit_price").eq("supplier_org_id", supplierId).eq("is_active", true).limit(20);
      if (q) qy = qy.ilike("name", `%${q}%`);
      return (await qy).data ?? [];
    },
  });

  const total = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);

  const create = useMutation({
    mutationFn: async () => {
      const { data: po, error } = await supabase.from("purchase_orders").insert({
        buyer_org_id: orgId, supplier_org_id: supplierId, total_amount: total, notes, status: "submitted",
      }).select().single();
      if (error) throw error;
      if (lines.length) {
        const { error: itemErr } = await supabase.from("purchase_order_items").insert(
          lines.map((l) => ({ po_id: po.id, product_id: l.product_id, quantity: l.quantity, unit_price: l.unit_price }))
        );
        if (itemErr) throw itemErr;
      }
      logAudit(orgId, "po.created", "purchase_order", po.id, { total, items: lines.length });
      return po;
    },
    onSuccess: () => { toast.success("Purchase order submitted"); setOpen(false); setLines([]); setSupplierId(""); setNotes(""); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  const addLine = (p: any) => {
    if (lines.find((l) => l.product_id === p.id)) return;
    setLines([...lines, { product_id: p.id, product_name: p.name, quantity: 1, unit_price: Number(p.unit_price) }]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-1.5" /> New PO</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Create purchase order</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId} disabled={!suppliers?.length}>
              <SelectTrigger><SelectValue placeholder={suppliers?.length ? "Select connected partner" : "No business connections yet"} /></SelectTrigger>
              <SelectContent>
                {suppliers?.filter((s: any) => s?.id).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name ?? "Unnamed organization"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!suppliers?.length && <p className="text-xs text-muted-foreground mt-1">Connect with a partner in the Business Network first.</p>}
          </div>

          {supplierId && (
            <div>
              <Label>Add products</Label>
              <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="mt-1 max-h-32 overflow-y-auto border rounded-md divide-y">
                {products?.map((p: any) => (
                  <button key={p.id} type="button" onClick={() => addLine(p)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex justify-between">
                    <span>{p.name}</span><span className="text-muted-foreground">{formatCurrency(p.unit_price)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {lines.length > 0 && (
            <div className="border rounded-md">
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="w-24">Qty</TableHead><TableHead className="w-28">Price</TableHead><TableHead className="w-8"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {lines.map((l, idx) => (
                    <TableRow key={l.product_id}>
                      <TableCell className="text-sm">{l.product_name}</TableCell>
                      <TableCell><Input type="number" className="h-8" value={l.quantity} onChange={(e) => { const v = [...lines]; v[idx].quantity = parseInt(e.target.value) || 0; setLines(v); }} /></TableCell>
                      <TableCell><Input type="number" step="0.01" className="h-8" value={l.unit_price} onChange={(e) => { const v = [...lines]; v[idx].unit_price = parseFloat(e.target.value) || 0; setLines(v); }} /></TableCell>
                      <TableCell><Button variant="ghost" size="icon" className="size-7" onClick={() => setLines(lines.filter((_, i) => i !== idx))}><Trash2 className="size-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="px-3 py-2 border-t flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span><span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
              </div>
            </div>
          )}

          <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={() => create.mutate()} disabled={!supplierId || !lines.length || create.isPending}>Submit PO</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
