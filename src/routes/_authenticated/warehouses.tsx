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
import { toast } from "sonner";
import { Plus, Warehouse as WarehouseIcon, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/warehouses")({
  head: () => ({ meta: [{ title: "Warehouses — Smart Supply" }] }),
  component: WarehousesPage,
});

function WarehousesPage() {
  const qc = useQueryClient();
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });
  const orgId = ctx?.currentOrg?.id;

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase.from("warehouses").select("*").eq("org_id", orgId!).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <div className="p-8 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Warehouses</h1>
            <p className="text-sm text-muted-foreground">Manage storage locations and capacity.</p>
          </div>
          {orgId && <AddWarehouse orgId={orgId} onDone={() => qc.invalidateQueries({ queryKey: ["warehouses"] })} />}
        </div>

        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses?.map((w: any) => (
            <WarehouseCard key={w.id} w={w} onChange={() => qc.invalidateQueries({ queryKey: ["warehouses"] })} />
          ))}
          {!warehouses?.length && <p className="text-sm text-muted-foreground">No warehouses yet.</p>}
        </div>
      </div>
    </AppShell>
  );
}

function AddWarehouse({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", location: "", capacity: "" });

  const mut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("warehouses").insert({
        org_id: orgId, name: form.name, location: form.location || null,
        capacity: form.capacity ? parseInt(form.capacity) : null,
      }).select().single();
      if (error) throw error;
      logAudit(orgId, "warehouse.created", "warehouse", data.id);
      return data;
    },
    onSuccess: () => { toast.success("Warehouse created"); setOpen(false); setForm({ name: "", location: "", capacity: "" }); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-1.5" /> Add warehouse</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add warehouse</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <div><Label>Capacity (units)</Label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={() => mut.mutate()} disabled={!form.name || mut.isPending}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WarehouseCard({ w, onChange }: { w: any; onChange: () => void }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ name: w.name, location: w.location ?? "", capacity: w.capacity?.toString() ?? "" });
  const [invCount, setInvCount] = useState<number | null>(null);

  useQuery({
    queryKey: ["wh-inv-count", w.id],
    queryFn: async () => {
      const { count } = await supabase.from("inventory").select("id", { count: "exact", head: true }).eq("warehouse_id", w.id);
      setInvCount(count ?? 0);
      return count ?? 0;
    },
  });

  const save = async () => {
    const { error } = await supabase.from("warehouses").update({
      name: form.name, location: form.location || null,
      capacity: form.capacity ? parseInt(form.capacity) : null,
    }).eq("id", w.id);
    if (error) return toast.error(error.message);
    logAudit(w.org_id, "warehouse.updated", "warehouse", w.id);
    toast.success("Updated"); setEdit(false); onChange();
  };
  const remove = async () => {
    if (!confirm(`Delete warehouse "${w.name}"? Inventory will be removed.`)) return;
    const { error } = await supabase.from("warehouses").delete().eq("id", w.id);
    if (error) return toast.error(error.message);
    logAudit(w.org_id, "warehouse.deleted", "warehouse", w.id);
    toast.success("Deleted"); onChange();
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold">{w.name}</div>
          <div className="text-sm text-muted-foreground mt-0.5">{w.location ?? "No location set"}</div>
        </div>
        <div className="size-10 rounded-md bg-primary/10 text-primary grid place-items-center"><WarehouseIcon className="size-5" /></div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>Capacity: <span className="text-foreground font-medium">{w.capacity ?? "—"}</span></span>
        <span>Items: <span className="text-foreground font-medium">{invCount ?? "—"}</span></span>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setEdit(true)}><Pencil className="size-3.5 mr-1" /> Edit</Button>
        <Button variant="ghost" size="sm" onClick={remove}><Trash2 className="size-3.5 mr-1" /> Delete</Button>
      </div>
      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit warehouse</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
