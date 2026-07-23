import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentContext, logAudit, STATUS_TONE } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Check, X, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/quotations")({
  head: () => ({ meta: [{ title: "Quotations — Smart Supply" }] }),
  component: QuotesPage,
});

const sb: any = supabase;

function QuotesPage() {
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });
  const orgId = ctx?.currentOrg?.id;
  const orgType = ctx?.currentOrg?.type;
  const isSupplier = ["supplier", "manufacturer", "distributor", "wholesaler"].includes(orgType ?? "");

  return (
    <AppShell>
      <div className="p-8 max-w-7xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quotations</h1>
          <p className="text-sm text-muted-foreground">
            {isSupplier
              ? "Answer incoming RFQs with priced quotations."
              : "Review quotations from your suppliers and convert accepted ones to purchase orders."}
          </p>
        </div>

        <Tabs defaultValue={isSupplier ? "inbox" : "received"} className="mt-6">
          <TabsList>
            {isSupplier && <TabsTrigger value="inbox">RFQ inbox</TabsTrigger>}
            <TabsTrigger value={isSupplier ? "sent" : "received"}>
              {isSupplier ? "Quotations sent" : "Quotations received"}
            </TabsTrigger>
          </TabsList>

          {isSupplier && orgId && (
            <TabsContent value="inbox" className="mt-4"><SupplierInbox orgId={orgId} /></TabsContent>
          )}
          {orgId && (
            <TabsContent value={isSupplier ? "sent" : "received"} className="mt-4">
              <QuotationList orgId={orgId} isSupplier={isSupplier} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppShell>
  );
}

// -------------------------------------------------------- Supplier: RFQ inbox
function SupplierInbox({ orgId }: { orgId: string }) {
  const [rfq, setRfq] = useState<any | null>(null);

  const { data: rfqs } = useQuery({
    queryKey: ["rfq-inbox", orgId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("rfqs")
        .select("*, buyer:organizations!buyer_org_id(name), items:rfq_items(*)")
        .eq("supplier_org_id", orgId)
        .in("status", ["sent", "quoted"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>RFQ #</TableHead><TableHead>Buyer</TableHead>
              <TableHead>Items</TableHead><TableHead>Needed by</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rfqs?.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.rfq_number}</TableCell>
                <TableCell className="text-sm">{r.buyer?.name}</TableCell>
                <TableCell className="text-sm">{r.items?.length ?? 0}</TableCell>
                <TableCell className="text-sm">{r.needed_by ? new Date(r.needed_by).toLocaleDateString() : "—"}</TableCell>
                <TableCell><span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${STATUS_TONE[r.status] ?? "bg-muted"}`}>{r.status}</span></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={() => setRfq(r)}>
                    <FileText className="size-3.5 mr-1" /> Prepare quote
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!rfqs?.length && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No open RFQs.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      {rfq && <PrepareQuoteDialog rfq={rfq} onClose={() => setRfq(null)} />}
    </>
  );
}

function PrepareQuoteDialog({ rfq, onClose }: { rfq: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [lines, setLines] = useState(
    (rfq.items ?? []).map((i: any) => ({
      rfq_item_id: i.id,
      product_id: i.product_id ?? null,
      description: i.description,
      quantity: Number(i.quantity),
      unit_price: 0,
    })),
  );
  const [validUntil, setValidUntil] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("30 days from invoice");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [tax, setTax] = useState(0);

  const subtotal = useMemo(() => lines.reduce((s: number, l: any) => s + l.quantity * l.unit_price, 0), [lines]);
  const total = subtotal + Number(tax || 0);

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await sb.rpc("submit_quotation", {
        _rfq_id: rfq.id,
        _items: lines,
        _valid_until: validUntil || null,
        _payment_terms: paymentTerms || null,
        _delivery_terms: deliveryTerms || null,
        _notes: notes || null,
        _tax: tax || 0,
      });
      if (error) throw error;
      logAudit(rfq.supplier_org_id, "quotation.submitted", "rfq", rfq.id);
    },
    onSuccess: () => {
      toast.success("Quotation sent");
      qc.invalidateQueries({ queryKey: ["rfq-inbox"] });
      qc.invalidateQueries({ queryKey: ["quotations"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quote for {rfq.rfq_number} · {rfq.buyer?.name}</DialogTitle>
          <div className="flex flex-wrap gap-2 text-xs pt-1">
            {rfq.priority && rfq.priority !== "routine" && (
              <span className={`rounded-full px-2 py-0.5 uppercase ${rfq.priority === "emergency" ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-700"}`}>{rfq.priority}</span>
            )}
            {rfq.cold_chain_required && <span className="rounded-full px-2 py-0.5 bg-sky-500/15 text-sky-700">❄️ Cold chain</span>}
            {rfq.needed_by && <span className="text-muted-foreground">Needed by {new Date(rfq.needed_by).toLocaleDateString()}</span>}
            {rfq.delivery_location && <span className="text-muted-foreground">→ {rfq.delivery_location}</span>}
          </div>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested item</TableHead>
                  <TableHead className="w-20">Qty</TableHead>
                  <TableHead className="w-32">Unit price</TableHead>
                  <TableHead className="w-32 text-right">Line total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l: any, i: number) => {
                  const src = rfq.items?.[i];
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-sm">
                        <div className="font-medium">{l.description}</div>
                        <div className="text-xs text-muted-foreground space-x-2">
                          {src?.category && <span>{src.category}</span>}
                          {src?.brand_preference && <span>· Brand: {src.brand_preference}</span>}
                          {src?.specifications && <span>· {src.specifications}</span>}
                          {src?.unit_hint && <span>· {src.unit_hint}</span>}
                        </div>
                      </TableCell>
                      <TableCell><Input className="h-8" type="number" value={l.quantity}
                        onChange={(e) => { const v=[...lines]; v[i].quantity=parseFloat(e.target.value)||0; setLines(v); }} /></TableCell>
                      <TableCell><Input className="h-8" type="number" step="0.01" value={l.unit_price}
                        onChange={(e) => { const v=[...lines]; v[i].unit_price=parseFloat(e.target.value)||0; setLines(v); }} /></TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(l.quantity * l.unit_price)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="px-3 py-2 border-t space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Tax</span>
                <Input className="h-7 w-32" type="number" step="0.01" value={tax} onChange={(e) => setTax(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="flex justify-between font-semibold pt-1 border-t"><span>Total</span><span className="tabular-nums">{formatCurrency(total)}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Valid until</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
            <div><Label>Payment terms</Label><Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} /></div>
          </div>
          <div><Label>Delivery terms</Label><Input value={deliveryTerms} onChange={(e) => setDeliveryTerms(e.target.value)} placeholder="e.g. FOB Johannesburg, 5 working days" /></div>
          <div><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={!lines.length || submit.isPending}>Send quotation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------- Buyer & Supplier: quote list
function QuotationList({ orgId, isSupplier }: { orgId: string; isSupplier: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: quotes } = useQuery({
    queryKey: ["quotations", orgId],
    queryFn: async () => {
      const col = isSupplier ? "supplier_org_id" : "buyer_org_id";
      const { data, error } = await sb
        .from("quotations")
        .select("*, buyer:organizations!buyer_org_id(name), supplier:organizations!supplier_org_id(name), items:quotation_items(*), rfq:rfqs(rfq_number)")
        .eq(col, orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [viewing, setViewing] = useState<any | null>(null);

  const decide = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { data, error } = await sb.rpc("decide_quotation", { _quotation_id: id, _accept: accept });
      if (error) throw error;
      logAudit(orgId, accept ? "quotation.accepted" : "quotation.rejected", "quotation", id);
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["quotations"] });
      qc.invalidateQueries({ queryKey: ["pos"] });
      if (vars.accept) {
        toast.success("Accepted — purchase order created");
        navigate({ to: "/purchase-orders" });
      } else {
        toast.success("Quotation rejected");
      }
      setViewing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const withdraw = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.rpc("withdraw_quotation", { _quotation_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Withdrawn"); qc.invalidateQueries({ queryKey: ["quotations"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quote #</TableHead>
              <TableHead>{isSupplier ? "Buyer" : "Supplier"}</TableHead>
              <TableHead>RFQ</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Valid until</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes?.map((q: any) => (
              <TableRow key={q.id}>
                <TableCell className="font-mono text-xs">{q.quote_number}</TableCell>
                <TableCell className="text-sm">{isSupplier ? q.buyer?.name : q.supplier?.name}</TableCell>
                <TableCell className="font-mono text-xs">{q.rfq?.rfq_number ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(q.total, q.currency ?? "ZAR")}</TableCell>
                <TableCell className="text-sm">{q.valid_until ? new Date(q.valid_until).toLocaleDateString() : "—"}</TableCell>
                <TableCell><span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${STATUS_TONE[q.status] ?? "bg-muted"}`}>{q.status}</span></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => setViewing(q)}>View</Button>
                  {!isSupplier && q.status === "sent" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: q.id, accept: false })}><X className="size-3.5" /></Button>
                      <Button size="sm" onClick={() => decide.mutate({ id: q.id, accept: true })}><Check className="size-3.5 mr-1" />Accept</Button>
                    </>
                  )}
                  {isSupplier && q.status === "sent" && (
                    <Button size="sm" variant="outline" onClick={() => withdraw.mutate(q.id)}>Withdraw</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!quotes?.length && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No quotations yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {viewing && (
        <Dialog open onOpenChange={(v) => !v && setViewing(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{viewing.quote_number} · {formatCurrency(viewing.total, viewing.currency ?? "ZAR")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Buyer:</span> {viewing.buyer?.name}</div>
                <div><span className="text-muted-foreground">Supplier:</span> {viewing.supplier?.name}</div>
                <div><span className="text-muted-foreground">Valid until:</span> {viewing.valid_until ? new Date(viewing.valid_until).toLocaleDateString() : "—"}</div>
                <div><span className="text-muted-foreground">Payment:</span> {viewing.payment_terms ?? "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Delivery:</span> {viewing.delivery_terms ?? "—"}</div>
                {viewing.notes && <div className="col-span-2"><span className="text-muted-foreground">Notes:</span> {viewing.notes}</div>}
              </div>
              <div className="border rounded-md">
                <Table>
                  <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="w-16">Qty</TableHead><TableHead className="w-28">Unit</TableHead><TableHead className="w-28 text-right">Line</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(viewing.items ?? []).map((it: any) => (
                      <TableRow key={it.id}>
                        <TableCell className="text-sm">{it.description}</TableCell>
                        <TableCell className="text-sm">{it.quantity}</TableCell>
                        <TableCell className="tabular-nums text-sm">{formatCurrency(it.unit_price, viewing.currency ?? "ZAR")}</TableCell>
                        <TableCell className="tabular-nums text-sm text-right">{formatCurrency(it.line_total, viewing.currency ?? "ZAR")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="px-3 py-2 border-t text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatCurrency(viewing.subtotal, viewing.currency ?? "ZAR")}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="tabular-nums">{formatCurrency(viewing.tax, viewing.currency ?? "ZAR")}</span></div>
                  <div className="flex justify-between font-semibold pt-1 border-t"><span>Total</span><span className="tabular-nums">{formatCurrency(viewing.total, viewing.currency ?? "ZAR")}</span></div>
                </div>
              </div>
            </div>
            <DialogFooter>
              {!isSupplier && viewing.status === "sent" && (
                <>
                  <Button variant="outline" onClick={() => decide.mutate({ id: viewing.id, accept: false })}>Reject</Button>
                  <Button onClick={() => decide.mutate({ id: viewing.id, accept: true })}>Accept & create PO</Button>
                </>
              )}
              {(isSupplier || viewing.status !== "sent") && <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
