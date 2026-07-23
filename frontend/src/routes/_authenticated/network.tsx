import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentContext } from "@/lib/api";
import { BUSINESS_TYPES, INDUSTRY_OPTIONS, getRoleLabel } from "@/lib/org-config";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, Network, Check, X, Trash2, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/network")({
  head: () => ({ meta: [{ title: "Business Network — Smart Supply" }] }),
  component: NetworkPage,
});

const RELATIONSHIPS = [
  { value: "buyer_supplier",          label: "Buyer ↔ Supplier" },
  { value: "supplier_manufacturer",   label: "Supplier ↔ Manufacturer" },
  { value: "manufacturer_distributor", label: "Manufacturer ↔ Distributor" },
  { value: "distributor_retailer",    label: "Distributor ↔ Retailer" },
  { value: "supplier_warehouse",      label: "Supplier ↔ Warehouse" },
  { value: "warehouse_logistics",     label: "Warehouse ↔ Logistics" },
  { value: "generic",                 label: "General partnership" },
];

function NetworkPage() {
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });
  const orgId = ctx?.currentOrg?.id;

  return (
    <AppShell>
      <div className="p-8 max-w-6xl">
        <div className="flex items-center gap-2">
          <Network className="size-6 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Business Network</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Discover and connect with other organizations as independent business partners.
        </p>

        <Tabs defaultValue="directory" className="mt-6">
          <TabsList>
            <TabsTrigger value="directory">Directory</TabsTrigger>
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="directory"><DirectoryTab orgId={orgId} /></TabsContent>
          <TabsContent value="connections"><ConnectionsTab orgId={orgId} /></TabsContent>
          <TabsContent value="requests"><RequestsTab orgId={orgId} /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function DirectoryTab({ orgId }: { orgId?: string }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [industry, setIndustry] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["org-search", q, type, industry],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_organizations", {
        _q: q || undefined, _type: type || undefined, _industry: industry || undefined,
        _country: undefined, _province: undefined, _limit: 50,
      });
      if (error) throw error;
      return (data ?? []).filter((o: any) => o.id !== orgId);
    },
  });

  return (
    <Card className="p-5 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <div className="md:col-span-2">
          <Label className="text-xs">Search</Label>
          <div className="relative">
            <Search className="size-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && refetch()} placeholder="Company name or code…" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <Select value={type || "__any"} onValueChange={(v) => setType(v === "__any" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__any">Any type</SelectItem>
              {BUSINESS_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Industry</Label>
          <Select value={industry || "__any"} onValueChange={(v) => setIndustry(v === "__any" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__any">Any industry</SelectItem>
              {INDUSTRY_OPTIONS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Searching…</p>}
        {!isLoading && !data?.length && <p className="text-sm text-muted-foreground">No companies match those filters.</p>}
        {data?.map((o: any) => (
          <div key={o.id} className="flex items-start justify-between border rounded-md p-3">
            <div>
              <div className="font-medium flex items-center gap-2">
                {o.name}
                {o.status === "verified" && <Badge variant="secondary" className="text-[10px]">Verified</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">
                {getRoleLabel(o.type)}{o.industry ? ` · ${o.industry}` : ""}{o.city ? ` · ${o.city}` : ""}{o.country ? `, ${o.country}` : ""}
              </div>
              {o.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 max-w-xl">{o.description}</p>}
            </div>
            <ConnectButton addresseeId={o.id} addresseeName={o.name} disabled={!orgId} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function ConnectButton({ addresseeId, addresseeName, disabled }: { addresseeId: string; addresseeName: string; disabled?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rel, setRel] = useState("buyer_supplier");
  const [msg, setMsg] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_business_connection", {
        _addressee_org_id: addresseeId, _relationship_type: rel, _message: msg || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Connection request sent"); setOpen(false); setMsg(""); qc.invalidateQueries({ queryKey: ["connections"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}><Send className="size-4 mr-1.5" /> Connect</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Connect with {addresseeName}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Relationship</Label>
            <Select value={rel} onValueChange={setRel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{RELATIONSHIPS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Message (optional)</Label>
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Introduce your company…" />
          </div>
        </div>
        <DialogFooter><Button onClick={() => m.mutate()} disabled={m.isPending}>Send request</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConnectionsTab({ orgId }: { orgId?: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["connections", "accepted", orgId], enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_connections")
        .select("*, requester:requester_org_id(id,name,type,industry,city,country), addressee:addressee_org_id(id,name,type,industry,city,country)")
        .eq("status", "accepted")
        .or(`requester_org_id.eq.${orgId},addressee_org_id.eq.${orgId}`);
      if (error) throw error;
      return data ?? [];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("remove_business_connection", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Connection removed"); qc.invalidateQueries({ queryKey: ["connections"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-5 mt-4">
      {!data?.length ? <p className="text-sm text-muted-foreground">No accepted connections yet. Use the Directory tab to discover partners.</p> : (
        <div className="space-y-2">
          {data.map((c: any) => {
            const other = c.requester_org_id === orgId ? c.addressee : c.requester;
            return (
              <div key={c.id} className="flex items-center justify-between border rounded-md p-3">
                <div>
                  <div className="font-medium">{other?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {getRoleLabel(other?.type)} · {(RELATIONSHIPS.find(r => r.value === c.relationship_type)?.label) ?? c.relationship_type}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(c.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function RequestsTab({ orgId }: { orgId?: string }) {
  const qc = useQueryClient();
  const { data: inbound } = useQuery({
    queryKey: ["connections", "inbound", orgId], enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_connections")
        .select("*, requester:requester_org_id(id,name,type)")
        .eq("status", "pending").eq("addressee_org_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: outbound } = useQuery({
    queryKey: ["connections", "outbound", orgId], enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_connections")
        .select("*, addressee:addressee_org_id(id,name,type)")
        .eq("status", "pending").eq("requester_org_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { error } = await supabase.rpc("decide_business_connection", { _id: id, _accept: accept });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["connections"] }); toast.success("Updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("remove_business_connection", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["connections"] }); toast.success("Request cancelled"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Inbound</h3>
        {!inbound?.length && <p className="text-sm text-muted-foreground">No inbound requests.</p>}
        <div className="space-y-2">
          {inbound?.map((r: any) => (
            <div key={r.id} className="border rounded-md p-3">
              <div className="font-medium">{r.requester?.name}</div>
              <div className="text-xs text-muted-foreground">
                {getRoleLabel(r.requester?.type)} · {RELATIONSHIPS.find(x => x.value === r.relationship_type)?.label}
              </div>
              {r.message && <p className="text-xs italic mt-1">"{r.message}"</p>}
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={() => decide.mutate({ id: r.id, accept: true })}><Check className="size-4 mr-1" /> Accept</Button>
                <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: r.id, accept: false })}><X className="size-4 mr-1" /> Reject</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Outbound</h3>
        {!outbound?.length && <p className="text-sm text-muted-foreground">No outbound requests.</p>}
        <div className="space-y-2">
          {outbound?.map((r: any) => (
            <div key={r.id} className="border rounded-md p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{r.addressee?.name}</div>
                <div className="text-xs text-muted-foreground">{RELATIONSHIPS.find(x => x.value === r.relationship_type)?.label}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => cancel.mutate(r.id)}><X className="size-4" /></Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
