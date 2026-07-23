import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentContext, logAudit, STATUS_TONE } from "@/lib/api";
import { HEALTHCARE_CATEGORIES } from "@/lib/org-config";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rfqs")({
  head: () => ({ meta: [{ title: "Requests for Quotation — Smart Supply" }] }),
  component: RfqPage,
});

const sb: any = supabase;

function RfqPage() {
  const qc = useQueryClient();
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });
  const orgId = ctx?.currentOrg?.id;
  const orgType = ctx?.currentOrg?.type;
  const isSupplier = ["supplier", "manufacturer", "distributor", "wholesaler"].includes(orgType ?? "");

  const { data: rfqs } = useQuery({
    queryKey: ["rfqs", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("rfqs")
        .select("*, buyer:organizations!buyer_org_id(name), supplier:organizations!supplier_org_id(name), items:rfq_items(count)")
        .or(`buyer_org_id.eq.${orgId},supplier_org_id.eq.${orgId}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const sendRfq = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.rpc("send_rfq", { _rfq_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("RFQ sent"); qc.invalidateQueries({ queryKey: ["rfqs"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div className="p-8 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Requests for Quotation</h1>
            <p className="text-sm text-muted-foreground">
              {isSupplier
                ? "RFQs sent to you by healthcare buyers. Respond with a quotation."
                : "Request pricing from your suppliers before placing an order."}
            </p>
          </div>
          {orgId && !isSupplier && <NewRfq orgId={orgId} onDone={() => qc.invalidateQueries({ queryKey: ["rfqs"] })} />}
        </div>

        <Card className="mt-6 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RFQ #</TableHead>
                <TableHead>{isSupplier ? "Buyer" : "Supplier"}</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Needed by</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rfqs?.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.rfq_number}</TableCell>
                  <TableCell className="text-sm">{isSupplier ? r.buyer?.name : r.supplier?.name}</TableCell>
                  <TableCell className="text-sm">
                    {r.items?.[0]?.count ?? 0}
                    {r.cold_chain_required && <span title="Cold chain" className="ml-1">❄️</span>}
                  </TableCell>
                  <TableCell className="text-sm">{r.needed_by ? new Date(r.needed_by).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs ${STATUS_TONE[r.status] ?? "bg-muted text-muted-foreground"}`}>
                        {r.status}
                      </span>
                      {r.priority && r.priority !== "routine" && (
                        <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] uppercase ${r.priority === "emergency" ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-700"}`}>
                          {r.priority}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {!isSupplier && r.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => sendRfq.mutate(r.id)}>
                        <Send className="size-3.5 mr-1" /> Send
                      </Button>
                    )}
                    {isSupplier && ["sent","quoted"].includes(r.status) && (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/quotations">Prepare quote →</Link>
                      </Button>
                    )}
                    {["quoted","accepted","rejected"].includes(r.status) && (!isSupplier || r.status === "accepted") && (
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/quotations">View quote</Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!rfqs?.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    No requests yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppShell>
  );
}

type Line = { product_id?: string; description: string; quantity: number; unit_hint?: string; category?: string; brand_preference?: string; specifications?: string };

function NewRfq({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<"routine"|"urgent"|"emergency">("routine");
  const [coldChain, setColdChain] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [lines, setLines] = useState<Line[]>([{ description: "", quantity: 1, category: "" }]);
  const [q, setQ] = useState("");

  const { data: suppliers } = useQuery({
    queryKey: ["rfq-supplier-connections", orgId],
    queryFn: async () => {
      const { data } = await sb
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
    queryKey: ["rfq-products", supplierId, q],
    enabled: !!supplierId,
    queryFn: async () => {
      let qy = sb.from("products").select("id, name, sku, category").eq("supplier_org_id", supplierId).eq("is_active", true).limit(15);
      if (q) qy = qy.ilike("name", `%${q}%`);
      return (await qy).data ?? [];
    },
  });

  const addProductLine = (p: any) => {
    if (lines.some((l) => l.product_id === p.id)) return;
    setLines([...lines.filter((l) => l.description || l.product_id), { product_id: p.id, description: p.name, quantity: 1, category: p.category ?? "" }]);
  };
  const addFreeLine = () => setLines([...lines, { description: "", quantity: 1, category: "" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const create = useMutation({
    mutationFn: async (send: boolean) => {
      const items = lines.filter((l) => l.description && l.quantity > 0).map((l) => ({
        product_id: l.product_id ?? null,
        description: l.description,
        quantity: l.quantity,
        unit_hint: l.unit_hint ?? null,
        category: l.category ?? null,
        brand_preference: l.brand_preference ?? null,
        specifications: l.specifications ?? null,
      }));
      if (!items.length) throw new Error("Add at least one line item");
      const { data, error } = await sb.rpc("create_rfq", {
        _supplier_org: supplierId,
        _needed_by: neededBy || null,
        _notes: notes || null,
        _items: items,
        _send: send,
        _priority: priority,
        _cold_chain: coldChain,
        _delivery_location: deliveryLocation || null,
      });
      if (error) throw error;
      logAudit(orgId, send ? "rfq.sent" : "rfq.created", "rfq", (data as any)?.id, { items: items.length });
      return data;
    },
    onSuccess: () => {
      toast.success("RFQ created");
      setOpen(false);
      setSupplierId(""); setNeededBy(""); setNotes(""); setPriority("routine"); setColdChain(false); setDeliveryLocation("");
      setLines([{ description: "", quantity: 1, category: "" }]);
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-1.5" /> New RFQ</Button></DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request quotation</DialogTitle>
          <p className="text-xs text-muted-foreground">Healthcare procurement — medicines, consumables, equipment, lab & diagnostics.</p>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Supplier / Distributor</Label>
            <Select value={supplierId} onValueChange={setSupplierId} disabled={!suppliers?.length}>
              <SelectTrigger><SelectValue placeholder={suppliers?.length ? "Select connected partner" : "No business connections yet"} /></SelectTrigger>
              <SelectContent>
                {suppliers?.filter((s: any) => s?.id).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name ?? "Unnamed organization"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!suppliers?.length && <p className="text-xs text-muted-foreground mt-1">Connect with a partner in the Healthcare Network first.</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Needed by</Label>
              <Input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Checkbox id="cold" checked={coldChain} onCheckedChange={(v) => setColdChain(!!v)} />
              <Label htmlFor="cold" className="text-sm">Cold-chain required</Label>
            </div>
          </div>

          <div>
            <Label>Delivery location (facility / ward / pharmacy)</Label>
            <Input value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} placeholder="e.g. Main Pharmacy Store, Ward 3, Lab receiving" />
          </div>

          {supplierId && (
            <div>
              <Label>Pick from supplier catalog (optional)</Label>
              <Input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="mt-1 max-h-28 overflow-y-auto border rounded-md divide-y">
                {products?.map((p: any) => (
                  <button key={p.id} type="button" onClick={() => addProductLine(p)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent">
                    {p.name} {p.sku ? <span className="text-muted-foreground text-xs">· {p.sku}</span> : null}
                    {p.category ? <span className="text-muted-foreground text-xs"> · {p.category}</span> : null}
                  </button>
                ))}
                {!products?.length && <div className="px-3 py-2 text-xs text-muted-foreground">No matching products — you can still describe items below.</div>}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Requested items</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addFreeLine}>
                <Plus className="size-3.5 mr-1" /> Add line
              </Button>
            </div>
            <div className="border rounded-md divide-y">
              {lines.map((l, i) => (
                <div key={i} className="p-3 space-y-2">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-6">
                      <Input className="h-8" placeholder="e.g. Paracetamol 500mg tablets, Nitrile gloves M, Glucose test strips"
                        value={l.description}
                        onChange={(e) => { const v=[...lines]; v[i].description=e.target.value; setLines(v); }} />
                    </div>
                    <div className="col-span-3">
                      <Select value={l.category ?? ""} onValueChange={(val) => { const v=[...lines]; v[i].category=val; setLines(v); }}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Category" /></SelectTrigger>
                        <SelectContent>
                          {HEALTHCARE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1">
                      <Input className="h-8" type="number" min={1} value={l.quantity}
                        onChange={(e) => { const v=[...lines]; v[i].quantity=parseInt(e.target.value)||0; setLines(v); }} />
                    </div>
                    <div className="col-span-1">
                      <Input className="h-8" placeholder="box" value={l.unit_hint ?? ""}
                        onChange={(e) => { const v=[...lines]; v[i].unit_hint=e.target.value; setLines(v); }} />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => removeLine(i)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input className="h-8" placeholder="Brand / generic preference (optional)" value={l.brand_preference ?? ""}
                      onChange={(e) => { const v=[...lines]; v[i].brand_preference=e.target.value; setLines(v); }} />
                    <Input className="h-8" placeholder="Specs: strength, size, sterility, batch/expiry needs" value={l.specifications ?? ""}
                      onChange={(e) => { const v=[...lines]; v[i].specifications=e.target.value; setLines(v); }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Additional clinical / procurement notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Regulatory requirements, tender ref, dispensing instructions, etc." />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => create.mutate(false)} disabled={!supplierId || create.isPending}>Save draft</Button>
          <Button onClick={() => create.mutate(true)} disabled={!supplierId || create.isPending}>Send to supplier</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
