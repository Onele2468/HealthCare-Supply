import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentContext, STATUS_TONE } from "@/lib/api";
import { getDashboardForType, getRoleLabel, type WidgetKey } from "@/lib/org-config";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Package, Warehouse, Boxes, ClipboardList, Truck, AlertTriangle, ArrowRight,
  Users, ShoppingCart, Send, TrendingUp, TrendingDown, Factory,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Smart Supply" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });
  const orgId = ctx?.currentOrg?.id;
  const orgType = ctx?.currentOrg?.type;
  const currency = ctx?.currentOrg?.currency ?? "ZAR";

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [products, warehouses, inventory, posBuyer, posSupplier, deliveries, connections] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("supplier_org_id", orgId!),
        supabase.from("warehouses").select("id", { count: "exact", head: true }).eq("org_id", orgId!),
        supabase.from("inventory").select("quantity, reorder_threshold, expiry_date, warehouses!inner(org_id)").eq("warehouses.org_id", orgId!),
        supabase.from("purchase_orders").select("id, status, total_amount, created_at, po_number, supplier_org_id, buyer_org_id").eq("buyer_org_id", orgId!).order("created_at", { ascending: false }).limit(10),
        supabase.from("purchase_orders").select("id, status, total_amount, created_at, po_number, supplier_org_id, buyer_org_id").eq("supplier_org_id", orgId!).order("created_at", { ascending: false }).limit(10),
        supabase.from("deliveries").select("id, status, purchase_orders!inner(buyer_org_id, supplier_org_id)").or(`buyer_org_id.eq.${orgId},supplier_org_id.eq.${orgId}`, { foreignTable: "purchase_orders" }),
        supabase.from("business_connections").select("id, requester_org_id, addressee_org_id, status").eq("status", "accepted").or(`requester_org_id.eq.${orgId},addressee_org_id.eq.${orgId}`),
      ]);
      const inv = inventory.data ?? [];
      const lowStock = inv.filter((i: any) => i.quantity <= i.reorder_threshold).length;
      const expiringSoon = inv.filter((i: any) => i.expiry_date && new Date(i.expiry_date) < new Date(Date.now() + 1000 * 60 * 60 * 24 * 60)).length;
      const allDel = deliveries.data ?? [];
      const inTransit = allDel.filter((d: any) => ["in_transit", "dispatched", "processing"].includes(d.status)).length;
      const buyerPos = posBuyer.data ?? [];
      const supplierPos = posSupplier.data ?? [];
      const recentPos = [...buyerPos, ...supplierPos].sort((a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 5);
      const inventoryValue = inv.reduce((s: number, i: any) => s + Number(i.quantity ?? 0) * 0, 0); // unit cost not on inventory rows
      return {
        productCount: products.count ?? 0,
        warehouseCount: warehouses.count ?? 0,
        lowStock, expiringSoon, inTransit,
        spend: buyerPos.reduce((s, p: any) => s + Number(p.total_amount), 0),
        revenue: supplierPos.reduce((s, p: any) => s + Number(p.total_amount), 0),
        openBuyerPos: buyerPos.filter((p: any) => !["delivered", "cancelled"].includes(p.status)).length,
        openSupplierPos: supplierPos.filter((p: any) => !["delivered", "cancelled"].includes(p.status)).length,
        partners: connections.data?.length ?? 0,
        inventoryValue,
        recentPos,
      };
    },
  });

  if (!ctx?.currentOrg) {
    return (
      <AppShell>
        <div className="p-10 max-w-2xl">
          <h1 className="text-2xl font-semibold">Welcome to Smart Supply</h1>
          <p className="text-muted-foreground mt-2">
            You're not part of any organization yet. Create one to start managing procurement,
            inventory and deliveries.
          </p>
          <Button asChild className="mt-6"><Link to="/organization">Create organization <ArrowRight className="size-4 ml-1.5" /></Link></Button>
        </div>
      </AppShell>
    );
  }

  const config = getDashboardForType(orgType);

  const WIDGETS: Record<WidgetKey, { label: string; value: string | number; icon: any; to: string; warn?: boolean }> = {
    products:           { label: "Products",           value: stats?.productCount ?? "—",                                                icon: Package,        to: "/catalog" },
    warehouses:         { label: "Warehouses",         value: stats?.warehouseCount ?? "—",                                              icon: Warehouse,      to: "/warehouses" },
    inventory_value:    { label: "Inventory items",    value: stats?.lowStock !== undefined ? (stats.productCount ?? 0) : "—",            icon: Boxes,          to: "/inventory" },
    low_stock:          { label: "Low stock items",    value: stats?.lowStock ?? "—",                                                    icon: AlertTriangle,  to: "/inventory", warn: (stats?.lowStock ?? 0) > 0 },
    expiring:           { label: "Expiring soon",      value: stats?.expiringSoon ?? "—",                                                icon: AlertTriangle,  to: "/inventory", warn: (stats?.expiringSoon ?? 0) > 0 },
    shipments_in:       { label: "Incoming shipments", value: stats?.inTransit ?? "—",                                                    icon: Truck,          to: "/deliveries" },
    shipments_out:      { label: "Outgoing shipments", value: stats?.inTransit ?? "—",                                                    icon: Send,           to: "/deliveries" },
    po_open:            { label: "Open purchase orders", value: stats?.openBuyerPos ?? "—",                                                icon: ClipboardList,  to: "/purchase-orders" },
    po_recent_spend:    { label: "Monthly spend",      value: formatCurrency(stats?.spend ?? 0, currency),                                icon: TrendingDown,   to: "/purchase-orders" },
    so_open:            { label: "Open sales orders",  value: stats?.openSupplierPos ?? "—",                                              icon: ShoppingCart,   to: "/purchase-orders" },
    so_recent_revenue:  { label: "Recent revenue",     value: formatCurrency(stats?.revenue ?? 0, currency),                              icon: TrendingUp,     to: "/purchase-orders" },
    suppliers:          { label: "Suppliers",          value: stats?.partners ?? "—",                                                    icon: Users,          to: "/network" },
    customers:          { label: "Customers",          value: stats?.partners ?? "—",                                                    icon: Users,          to: "/network" },
    storage_capacity:   { label: "Warehouses",         value: stats?.warehouseCount ?? "—",                                              icon: Warehouse,      to: "/warehouses" },
    fleet:              { label: "Fleet",              value: stats?.warehouseCount ?? "—",                                              icon: Truck,          to: "/warehouses" },
    active_deliveries:  { label: "Active deliveries",  value: stats?.inTransit ?? "—",                                                    icon: Truck,          to: "/deliveries" },
  };

  return (
    <AppShell>
      <div className="p-8 max-w-7xl">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{config.title}</h1>
            <p className="text-sm text-muted-foreground">
              {ctx.currentOrg.name} · {getRoleLabel(orgType)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {config.widgets.map((key) => {
            const c = WIDGETS[key];
            if (!c) return null;
            return (
              <Link key={key} to={c.to}>
                <Card className={`p-5 hover:shadow-[var(--shadow-elegant)] transition-shadow ${c.warn ? "border-warning/40" : ""}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">{c.label}</div>
                      <div className="text-3xl font-semibold mt-2">{c.value}</div>
                    </div>
                    <div className={`size-10 rounded-md grid place-items-center ${c.warn ? "bg-warning/15 text-warning-foreground" : "bg-primary/10 text-primary"}`}>
                      <c.icon className="size-5" />
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        <Card className="mt-8 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent orders</h2>
            <Button variant="ghost" size="sm" asChild><Link to="/purchase-orders">View all</Link></Button>
          </div>
          {!stats?.recentPos.length ? (
            <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
          ) : (
            <div className="divide-y">
              {stats.recentPos.map((p: any) => (
                <div key={p.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{p.po_number}</div>
                    <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm tabular-nums">{formatCurrency(p.total_amount, currency)}</span>
                    <span className={`text-xs px-2 py-1 rounded-md ${STATUS_TONE[p.status]}`}>{p.status.replace(/_/g, " ")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

