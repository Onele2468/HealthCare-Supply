import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentContext, logAudit } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, AlertTriangle, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Smart Supply" }] }),
  component: InventoryPage,
});

function InventoryPage() {
  const qc = useQueryClient();
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });
  const orgId = ctx?.currentOrg?.id;

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses", orgId],
    enabled: !!orgId,
    queryFn: async () => (await supabase.from("warehouses").select("id, name").eq("org_id", orgId!)).data ?? [],
  });

  const { data: inventory } = useQuery({
    queryKey: ["inventory", orgId],
    enabled: !!orgId && !!warehouses?.length,
    queryFn: async () => {
      const ids = warehouses!.map((w: any) => w.id);
      const { data, error } = await supabase
        .from("inventory")
        .select("*, product:products(name, generic_name, sku), warehouse:warehouses(name)")
        .in("warehouse_id", ids)
        .order("expiry_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateRow = async (id: string, patch: any) => {
    const { error } = await supabase.from("inventory").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    if (orgId) logAudit(orgId, "inventory.updated", "inventory", id, patch);
    qc.invalidateQueries({ queryKey: ["inventory"] });
  };
  const deleteRow = async (id: string) => {
    if (!confirm("Delete this inventory item?")) return;
    const { error } = await supabase.from("inventory").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (orgId) logAudit(orgId, "inventory.deleted", "inventory", id);
    toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["inventory"] });
  };

  return (
    <AppShell>
      <div className="p-8 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
            <p className="text-sm text-muted-foreground">Stock levels across all warehouses with batch and expiry tracking.</p>
          </div>
          {orgId && warehouses && warehouses.length > 0 && (
            <AddInventory warehouses={warehouses} orgId={orgId} onDone={() => qc.invalidateQueries({ queryKey: ["inventory"] })} />
          )}
        </div>

        <Card className="mt-6 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead><TableHead>Warehouse</TableHead><TableHead>Batch</TableHead>
                <TableHead>Expiry</TableHead><TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Reorder at</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory?.map((i: any) => {
                const low = i.quantity <= i.reorder_threshold;
                const exp = i.expiry_date ? new Date(i.expiry_date) : null;
                const expiring = exp && exp < new Date(Date.now() + 1000 * 60 * 60 * 24 * 60);
                return (
                  <TableRow key={i.id}>
                    <TableCell><div className="font-medium">{i.product?.name}</div><div className="text-xs text-muted-foreground">{i.product?.sku}</div></TableCell>
                    <TableCell className="text-sm">{i.warehouse?.name}</TableCell>
                    <TableCell className="text-xs font-mono">{i.batch_number ?? "—"}</TableCell>
                    <TableCell className={expiring ? "text-warning-foreground" : ""}>{i.expiry_date ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Input type="number" defaultValue={i.quantity} className={`h-8 w-20 ml-auto tabular-nums ${low ? "text-destructive font-medium" : ""}`}
                        onBlur={(e) => { const v = parseInt(e.target.value) || 0; if (v !== i.quantity) updateRow(i.id, { quantity: v }); }} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" defaultValue={i.reorder_threshold} className="h-8 w-20 ml-auto tabular-nums"
                        onBlur={(e) => { const v = parseInt(e.target.value) || 0; if (v !== i.reorder_threshold) updateRow(i.id, { reorder_threshold: v }); }} />
                    </TableCell>
                    <TableCell className="flex items-center gap-1">
                      {(low || expiring) && <AlertTriangle className="size-4 text-warning-foreground" />}
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => deleteRow(i.id)}><Trash2 className="size-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!inventory?.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No inventory yet. Add a warehouse and stock items.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppShell>
  );
}

function AddInventory({ warehouses, orgId, onDone }: { warehouses: any[]; orgId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [productId, setProductId] = useState("");
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ batch_number: "", expiry_date: "", quantity: "0", reorder_threshold: "0" });

  const { data: products } = useQuery({
    queryKey: ["product-search", q],
    queryFn: async () => {
      let qy = supabase.from("products").select("id, name, sku").eq("is_active", true).limit(20);
      if (q) qy = qy.ilike("name", `%${q}%`);
      return (await qy).data ?? [];
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("inventory").insert({
        warehouse_id: warehouseId, product_id: productId,
        batch_number: form.batch_number || null,
        expiry_date: form.expiry_date || null,
        quantity: parseInt(form.quantity) || 0,
        reorder_threshold: parseInt(form.reorder_threshold) || 0,
      }).select().single();
      if (error) throw error;
      logAudit(orgId, "inventory.created", "inventory", data.id);
      return data;
    },
    onSuccess: () => { toast.success("Stock added"); setOpen(false); setProductId(""); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-1.5" /> Add stock</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add inventory</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Product</Label>
            <Input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="mt-1 max-h-32 overflow-y-auto border rounded-md divide-y">
              {products?.map((p: any) => (
                <button key={p.id} type="button" onClick={() => setProductId(p.id)}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent ${productId === p.id ? "bg-accent" : ""}`}>
                  {p.name} <span className="text-xs text-muted-foreground">{p.sku}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Batch number</Label><Input value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} /></div>
            <div><Label>Expiry date</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
            <div><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
            <div><Label>Reorder threshold</Label><Input type="number" value={form.reorder_threshold} onChange={(e) => setForm({ ...form, reorder_threshold: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={() => mut.mutate()} disabled={!productId || !warehouseId || mut.isPending}>Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
