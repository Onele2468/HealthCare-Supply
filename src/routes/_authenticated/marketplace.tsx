import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentContext } from "@/lib/api";
import { HEALTHCARE_CATEGORIES } from "@/lib/org-config";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Heart, ShieldCheck, Store, Star, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/marketplace")({
  head: () => ({ meta: [{ title: "Healthcare Marketplace — Smart Supply" }] }),
  component: MarketplacePage,
});

function MarketplacePage() {
  const qc = useQueryClient();
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("");

  const { data: products } = useQuery({
    queryKey: ["marketplace-products", q, category],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, name, generic_name, brand_name, category, image_url, unit_price, supplier_org_id, supplier:organizations!supplier_org_id(id, name, status, logo_url, city, country)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(120);
      if (category) query = query.eq("category", category);
      if (q) query = query.or(`name.ilike.%${q}%,generic_name.ilike.%${q}%,brand_name.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: favIds } = useQuery({
    queryKey: ["favourites-ids", ctx?.user?.id],
    enabled: !!ctx?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("product_favourites").select("product_id").eq("user_id", ctx!.user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.product_id));
    },
  });

  const { data: featuredSuppliers } = useQuery({
    queryKey: ["marketplace-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, status, logo_url, city, country, description, type")
        .in("type", ["supplier", "manufacturer", "distributor", "wholesaler"])
        .order("status", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleFav = useMutation({
    mutationFn: async (productId: string) => {
      if (!ctx?.user?.id) throw new Error("Sign in required");
      if (favIds?.has(productId)) {
        const { error } = await supabase.from("product_favourites").delete().eq("user_id", ctx.user.id).eq("product_id", productId);
        if (error) throw error;
        return "removed";
      }
      const { error } = await supabase.from("product_favourites").insert({ user_id: ctx.user.id, product_id: productId });
      if (error) throw error;
      return "added";
    },
    onSuccess: (r) => {
      toast.success(r === "added" ? "Added to favourites" : "Removed from favourites");
      qc.invalidateQueries({ queryKey: ["favourites-ids"] });
      qc.invalidateQueries({ queryKey: ["favourites-products"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const currency = ctx?.currentOrg?.currency ?? "ZAR";

  return (
    <AppShell>
      <div className="p-8 max-w-7xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Healthcare Marketplace</h1>
            <p className="text-sm text-muted-foreground">Discover verified suppliers of medicines, medical consumables, equipment and lab supplies.</p>
          </div>
          <Link to="/marketplace/favourites"><Button variant="outline"><Heart className="size-4 mr-1.5" /> My favourites</Button></Link>
        </div>

        <div className="mt-6 flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search medicines, devices, consumables…" className="pl-9" />
          </div>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {HEALTHCARE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Category chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {HEALTHCARE_CATEGORIES.slice(0, 8).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(category === c ? "" : c)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${category === c ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Featured suppliers */}
        {featuredSuppliers && featuredSuppliers.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold tracking-tight mb-3 flex items-center gap-2"><Store className="size-4" /> Featured suppliers</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {featuredSuppliers.map((s: any) => (
                <Link key={s.id} to="/marketplace/supplier/$id" params={{ id: s.id }}>
                  <Card className="p-4 hover:border-primary transition h-full">
                    <div className="flex items-start gap-3">
                      {s.logo_url ? (
                        <img src={s.logo_url} alt={s.name} className="size-10 rounded object-cover" />
                      ) : (
                        <div className="size-10 rounded bg-muted grid place-items-center text-sm font-semibold">{s.name?.[0]}</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium truncate">{s.name}</span>
                          {s.status === "verified" && <ShieldCheck className="size-3.5 text-primary shrink-0" />}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{[s.city, s.country].filter(Boolean).join(", ") || "—"}</div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Product grid */}
        <div className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight mb-3">Products</h2>
          {products && products.length === 0 ? (
            <Card className="py-16 text-center">
              <Package className="size-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No products match your filters.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {products?.map((p: any) => (
                <Card key={p.id} className="overflow-hidden group flex flex-col">
                  <Link to="/marketplace/product/$id" params={{ id: p.id }} className="block">
                    <div className="aspect-square bg-muted overflow-hidden">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                      ) : (
                        <div className="w-full h-full grid place-items-center"><Package className="size-10 text-muted-foreground" /></div>
                      )}
                    </div>
                  </Link>
                  <div className="p-3 flex-1 flex flex-col">
                    <Link to="/marketplace/product/$id" params={{ id: p.id }}>
                      <div className="font-medium text-sm line-clamp-2 hover:text-primary">{p.name}</div>
                    </Link>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{p.brand_name || p.generic_name || p.category}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-sm font-semibold tabular-nums">{formatCurrency(p.unit_price, currency)}</div>
                      <button
                        aria-label="Toggle favourite"
                        onClick={() => toggleFav.mutate(p.id)}
                        className="p-1.5 rounded hover:bg-muted"
                      >
                        <Heart className={`size-4 ${favIds?.has(p.id) ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                      </button>
                    </div>
                    <Link to="/marketplace/supplier/$id" params={{ id: p.supplier_org_id }} className="mt-2 text-xs text-muted-foreground hover:text-primary flex items-center gap-1 truncate">
                      {p.supplier?.status === "verified" && <ShieldCheck className="size-3 text-primary shrink-0" />}
                      <span className="truncate">{p.supplier?.name}</span>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
