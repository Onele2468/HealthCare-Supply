import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentContext, logAudit } from "@/lib/api";
import { HEALTHCARE_CATEGORIES } from "@/lib/org-config";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Search, Trash2, PackageOpen, Check, X, Pencil } from "lucide-react";

function EditablePrice({ product, currency, onSaved }: { product: any; currency: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(product.unit_price ?? "0"));
  const [saving, setSaving] = useState(false);

  async function save() {
    const num = parseFloat(value);
    if (!Number.isFinite(num) || num < 0) { toast.error("Enter a valid price"); return; }
    setSaving(true);
    const { error } = await supabase.from("products").update({ unit_price: num }).eq("id", product.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Price updated");
    setEditing(false);
    onSaved();
  }

  if (!editing) {
    return (
      <button onClick={() => { setValue(String(product.unit_price ?? "0")); setEditing(true); }} className="inline-flex items-center gap-1.5 hover:text-primary group" title="Edit price">
        <span>{formatCurrency(product.unit_price, currency)}</span>
        <Pencil className="size-3 opacity-0 group-hover:opacity-100 transition" />
      </button>
    );
  }
  return (
    <div className="inline-flex items-center gap-1 justify-end">
      <Input
        type="number" step="0.01" min="0" autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        className="h-7 w-24 text-right tabular-nums"
      />
      <Button size="icon" variant="ghost" className="size-7" onClick={save} disabled={saving}><Check className="size-3.5" /></Button>
      <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditing(false)} disabled={saving}><X className="size-3.5" /></Button>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/catalog")({
  head: () => ({ meta: [{ title: "Catalog — Smart Supply" }] }),
  component: CatalogPage,
});

function CatalogPage() {
  const qc = useQueryClient();
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });
  const [q, setQ] = useState("");

  const { data: products } = useQuery({
    queryKey: ["products", q],
    queryFn: async () => {
      let query = supabase.from("products").select("*, supplier:organizations!supplier_org_id(name)").eq("is_active", true).order("created_at", { ascending: false }).limit(200);
      if (q) query = query.or(`name.ilike.%${q}%,generic_name.ilike.%${q}%,brand_name.ilike.%${q}%,sku.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const canManage = !!ctx?.currentOrg && ["supplier", "warehouse", "distributor"].includes(ctx.currentOrg.type);

  return (
    <AppShell>
      <div className="p-8 max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Product catalog</h1>
            <p className="text-sm text-muted-foreground">Browse and manage your company's products.</p>
          </div>
          {canManage && <AddProduct orgId={ctx!.currentOrg!.id} onDone={() => qc.invalidateQueries({ queryKey: ["products"] })} />}
        </div>

        <div className="mt-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, brand, SKU…" className="pl-9" />
        </div>

        {products && products.length === 0 ? (
          <Card className="mt-4 py-16 flex flex-col items-center justify-center text-center px-6">
            <div className="size-20 rounded-full bg-primary/10 grid place-items-center mb-4">
              <PackageOpen className="size-10 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">No products yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {canManage
                ? "Click 'Add Product' to create your first product."
                : "Once products are added to your catalog, they will appear here."}
            </p>
          </Card>
        ) : (
          <Card className="mt-4 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Variant</TableHead>
                  <TableHead>Seller</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Price</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.map((p: any) => {
                  const isOwn = !!ctx?.currentOrg && p.supplier_org_id === ctx.currentOrg.id;
                  return (
                  <TableRow key={p.id}>
                    <TableCell><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.generic_name}</div></TableCell>
                    <TableCell className="text-sm">{p.category ?? "—"}</TableCell>
                    <TableCell className="text-sm">{p.dosage ?? "—"}</TableCell>
                    <TableCell className="text-sm">{p.supplier?.name}</TableCell>
                    <TableCell className="text-xs font-mono">{p.sku ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {isOwn ? (
                        <EditablePrice product={p} currency={ctx?.currentOrg?.currency ?? "ZAR"} onSaved={() => qc.invalidateQueries({ queryKey: ["products"] })} />
                      ) : (
                        formatCurrency(p.unit_price, ctx?.currentOrg?.currency ?? "ZAR")
                      )}
                    </TableCell>
                    <TableCell>{isOwn && (
                      <Button variant="ghost" size="icon" className="size-7" onClick={async () => {
                        if (!confirm(`Archive product "${p.name}"?`)) return;
                        const { error } = await supabase.from("products").update({ is_active: false }).eq("id", p.id);
                        if (error) return toast.error(error.message);
                        logAudit(ctx!.currentOrg!.id, "product.archived", "product", p.id);
                        toast.success("Archived"); qc.invalidateQueries({ queryKey: ["products"] });
                      }}><Trash2 className="size-3.5" /></Button>
                    )}</TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function AddProduct({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const empty = { name: "", generic_name: "", brand_name: "", category: "", dosage: "", formulation: "", sku: "", unit_price: "0", image_url: "", description: "" };
  const [form, setForm] = useState(empty);

  const mut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("products").insert({
        supplier_org_id: orgId,
        ...form,
        unit_price: parseFloat(form.unit_price) || 0,
      }).select().single();
      if (error) throw error;
      logAudit(orgId, "product.created", "product", data.id);
      return data;
    },
    onSuccess: () => { toast.success("Product added"); setOpen(false); setForm(empty); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-1.5" /> Add product</Button></DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add healthcare product</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Paracetamol 500mg" />
          </div>
          <div>
            <Label>Generic name</Label>
            <Input value={form.generic_name} onChange={(e) => setForm({ ...form, generic_name: e.target.value })} />
          </div>
          <div>
            <Label>Brand</Label>
            <Input value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Category</Label>
            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Select category…</option>
              {HEALTHCARE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label>Dosage / size</Label>
            <Input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="500mg, 10ml" />
          </div>
          <div>
            <Label>Form / packaging</Label>
            <Input value={form.formulation} onChange={(e) => setForm({ ...form, formulation: e.target.value })} placeholder="Tablet, box of 20" />
          </div>
          <div>
            <Label>SKU</Label>
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div>
            <Label>Unit price</Label>
            <Input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Image URL</Label>
            <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" />
          </div>
          <div className="col-span-2">
            <Label>Description</Label>
            <textarea className="w-full min-h-20 rounded-md border border-input bg-background p-2 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Product details, indications, storage requirements…" />
          </div>
        </div>
        <DialogFooter><Button onClick={() => mut.mutate()} disabled={!form.name || mut.isPending}>Add product</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
