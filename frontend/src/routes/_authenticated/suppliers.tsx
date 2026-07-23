import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentContext, STATUS_TONE } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: "Partners — Smart Supply" }] }),
  component: PartnersPage,
});

// Buyer-style roles view "suppliers" (upstream). Supplier-style roles view "customers" (downstream).
const SUPPLIER_ROLE = new Set(["supplier", "manufacturer", "distributor", "wholesaler", "warehouse", "logistics", "transport"]);

function PartnersPage() {
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });
  const orgId = ctx?.currentOrg?.id;
  const orgType = ctx?.currentOrg?.type;
  const currency = ctx?.currentOrg?.currency ?? "ZAR";
  const isSellerView = !!orgType && SUPPLIER_ROLE.has(orgType);

  const L = isSellerView
    ? { titleH1: "Customers", titleP: "Customer directory with sales history and performance.", searchPh: "Search customers…", empty: "No customers found.", pick: "Select a customer to view performance and history.", statTitle: "Total orders", statSpend: "Total revenue" }
    : { titleH1: "Suppliers", titleP: "Supplier directory with purchase history and performance.", searchPh: "Search suppliers…", empty: "No suppliers found.", pick: "Select a supplier to view performance and history.", statTitle: "Total POs", statSpend: "Total spend" };

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  // Partners = accepted business connections ∪ organizations we have PO history with.
  const { data: partners } = useQuery({
    queryKey: ["partners", orgId, isSellerView],
    enabled: !!orgId,
    queryFn: async () => {
      const [conns, poHist] = await Promise.all([
        supabase
          .from("business_connections")
          .select("requester:requester_org_id(id,name,type,contact_email,contact_phone,address), addressee:addressee_org_id(id,name,type,contact_email,contact_phone,address), requester_org_id, addressee_org_id")
          .eq("status", "accepted")
          .or(`requester_org_id.eq.${orgId},addressee_org_id.eq.${orgId}`),
        supabase
          .from("purchase_orders")
          .select("buyer:buyer_org_id(id,name,type,contact_email,contact_phone,address), supplier:supplier_org_id(id,name,type,contact_email,contact_phone,address), buyer_org_id, supplier_org_id")
          .or(`buyer_org_id.eq.${orgId},supplier_org_id.eq.${orgId}`),
      ]);
      const map = new Map<string, any>();
      const add = (o: any) => { if (o?.id && o.id !== orgId) map.set(o.id, o); };
      (conns.data ?? []).forEach((c: any) => add(c.requester_org_id === orgId ? c.addressee : c.requester));
      (poHist.data ?? []).forEach((p: any) => {
        // In seller view show buyers; in buyer view show suppliers
        if (isSellerView) add(p.buyer_org_id !== orgId ? p.buyer : null);
        else add(p.supplier_org_id !== orgId ? p.supplier : null);
      });
      return Array.from(map.values()).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    },
  });

  const filtered = useMemo(() => {
    const list = partners ?? [];
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter((p) => (p.name ?? "").toLowerCase().includes(needle));
  }, [partners, q]);

  const { data: metrics } = useQuery({
    queryKey: ["partner-metrics", selected, orgId, isSellerView],
    enabled: !!selected && !!orgId,
    queryFn: async () => {
      const filterCol = isSellerView ? "buyer_org_id" : "supplier_org_id";
      const selfCol = isSellerView ? "supplier_org_id" : "buyer_org_id";
      const { data } = await supabase
        .from("purchase_orders")
        .select("id, po_number, status, total_amount, currency, created_at")
        .eq(filterCol, selected!)
        .eq(selfCol, orgId!)
        .order("created_at", { ascending: false });
      const list = data ?? [];
      const total = list.reduce((s, p: any) => s + Number(p.total_amount ?? 0), 0);
      const delivered = list.filter((p: any) => p.status === "delivered").length;
      return { pos: list, total, delivered };
    },
  });

  const current = filtered?.find((s) => s.id === selected) ?? partners?.find((s) => s.id === selected) ?? null;

  return (
    <AppShell>
      <div className="p-8 max-w-7xl">
        <h1 className="text-2xl font-semibold tracking-tight">{L.titleH1}</h1>
        <p className="text-sm text-muted-foreground">{L.titleP}</p>

        <div className="grid lg:grid-cols-[1fr_2fr] gap-6 mt-6">
          <Card className="p-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.searchPh} className="pl-9" />
            </div>
            <div className="divide-y max-h-[60vh] overflow-y-auto">
              {filtered?.map((s: any) => (
                <button key={s.id} onClick={() => setSelected(s.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-md hover:bg-accent ${selected === s.id ? "bg-accent" : ""}`}>
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{s.name ?? "Unnamed organization"}</div>
                      <div className="text-xs text-muted-foreground">{s.contact_email ?? s.type ?? "—"}</div>
                    </div>
                  </div>
                </button>
              ))}
              {!filtered?.length && <p className="text-sm text-muted-foreground p-3">{L.empty}</p>}
            </div>
          </Card>

          <Card className="p-6">
            {!current ? (
              <p className="text-sm text-muted-foreground">{L.pick}</p>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{current.name ?? "Unnamed organization"}</h2>
                    <div className="text-sm text-muted-foreground mt-1">{current.contact_email ?? "—"} · {current.contact_phone ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{current.address ?? "No address"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-6">
                  <Stat label={L.statTitle} value={metrics?.pos.length ?? 0} />
                  <Stat label="Delivered" value={metrics?.delivered ?? 0} />
                  <Stat label={L.statSpend} value={formatCurrency(metrics?.total ?? 0, currency)} />
                </div>

                <h3 className="font-medium mt-6 mb-2">Order history</h3>
                <Table>
                  <TableHeader><TableRow><TableHead>PO #</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {metrics?.pos.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.po_number}</TableCell>
                        <TableCell className="text-sm">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(p.total_amount, p.currency ?? currency)}</TableCell>
                        <TableCell><span className={`text-xs px-2 py-1 rounded-md ${STATUS_TONE[p.status]}`}>{p.status.replace(/_/g, " ")}</span></TableCell>
                      </TableRow>
                    ))}
                    {!metrics?.pos.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No orders yet.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="border rounded-md p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
