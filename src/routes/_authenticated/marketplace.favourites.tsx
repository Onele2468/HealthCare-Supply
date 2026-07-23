import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentContext } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Heart, Package, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/marketplace/favourites")({
  head: () => ({ meta: [{ title: "Favourites — Healthcare Marketplace" }] }),
  component: FavouritesPage,
});

function FavouritesPage() {
  const qc = useQueryClient();
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });

  const { data: favs } = useQuery({
    queryKey: ["favourites-products", ctx?.user?.id],
    enabled: !!ctx?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_favourites")
        .select("product_id, product:products(id, name, category, image_url, unit_price, brand_name, supplier:organizations!supplier_org_id(id, name, status))")
        .eq("user_id", ctx!.user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const remove = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase.from("product_favourites").delete().eq("user_id", ctx!.user!.id).eq("product_id", productId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["favourites-products"] }); qc.invalidateQueries({ queryKey: ["favourites-ids"] }); },
  });

  const currency = ctx?.currentOrg?.currency ?? "ZAR";

  return (
    <AppShell>
      <div className="p-8 max-w-6xl">
        <h1 className="text-2xl font-semibold tracking-tight">My favourite products</h1>
        <p className="text-sm text-muted-foreground">Products you've saved from the marketplace.</p>

        {favs && favs.length === 0 ? (
          <Card className="mt-6 py-16 text-center">
            <Heart className="size-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No favourites yet.</p>
            <Link to="/marketplace" className="text-sm text-primary hover:underline mt-2 inline-block">Browse marketplace</Link>
          </Card>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {favs?.map((f: any) => {
              const p = f.product;
              if (!p) return null;
              return (
                <Card key={p.id} className="overflow-hidden flex flex-col">
                  <Link to="/marketplace/product/$id" params={{ id: p.id }}>
                    <div className="aspect-square bg-muted">
                      {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center"><Package className="size-10 text-muted-foreground" /></div>}
                    </div>
                  </Link>
                  <div className="p-3 flex-1 flex flex-col">
                    <Link to="/marketplace/product/$id" params={{ id: p.id }} className="font-medium text-sm line-clamp-2 hover:text-primary">{p.name}</Link>
                    <div className="text-xs text-muted-foreground truncate">{p.category || p.brand_name}</div>
                    <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1 truncate">
                      {p.supplier?.status === "verified" && <ShieldCheck className="size-3 text-primary shrink-0" />}
                      <span className="truncate">{p.supplier?.name}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-sm font-semibold tabular-nums">{formatCurrency(p.unit_price, currency)}</div>
                      <button onClick={() => remove.mutate(p.id)} className="p-1.5 rounded hover:bg-muted" aria-label="Remove">
                        <Heart className="size-4 fill-red-500 text-red-500" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
