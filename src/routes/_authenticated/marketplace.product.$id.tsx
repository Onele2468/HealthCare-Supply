import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentContext } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, ShieldCheck, Store, ArrowLeft, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/marketplace/product/$id")({
  head: () => ({ meta: [{ title: "Product — Healthcare Marketplace" }] }),
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });

  const { data: product, isLoading } = useQuery({
    queryKey: ["marketplace-product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, supplier:organizations!supplier_org_id(id, name, status, logo_url, city, country, description, business_email, phone, website)")
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const currency = ctx?.currentOrg?.currency ?? "ZAR";

  if (isLoading) return <AppShell><div className="p-8">Loading…</div></AppShell>;
  if (!product) return <AppShell><div className="p-8">Product not found.</div></AppShell>;

  const s: any = product.supplier;

  return (
    <AppShell>
      <div className="p-8 max-w-5xl">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/marketplace" })}><ArrowLeft className="size-4 mr-1.5" /> Back to marketplace</Button>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="overflow-hidden aspect-square bg-muted">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center"><Package className="size-16 text-muted-foreground" /></div>
            )}
          </Card>

          <div>
            {product.category && <Badge variant="secondary">{product.category}</Badge>}
            <h1 className="text-2xl font-semibold tracking-tight mt-2">{product.name}</h1>
            {product.brand_name && <p className="text-sm text-muted-foreground">Brand: {product.brand_name}</p>}
            {product.generic_name && <p className="text-sm text-muted-foreground">Generic: {product.generic_name}</p>}

            <div className="mt-4 text-3xl font-bold tabular-nums">{formatCurrency(product.unit_price, currency)}</div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              {product.dosage && <div><span className="text-muted-foreground">Dosage:</span> {product.dosage}</div>}
              {product.formulation && <div><span className="text-muted-foreground">Form:</span> {product.formulation}</div>}
              {product.packaging && <div><span className="text-muted-foreground">Packaging:</span> {product.packaging}</div>}
              {product.sku && <div><span className="text-muted-foreground">SKU:</span> <span className="font-mono">{product.sku}</span></div>}
              {product.barcode && <div><span className="text-muted-foreground">Barcode:</span> <span className="font-mono">{product.barcode}</span></div>}
            </div>

            {product.description && (
              <div className="mt-6">
                <h3 className="font-semibold mb-1">Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.description}</p>
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <Link to="/rfqs"><Button><FileText className="size-4 mr-1.5" /> Request quotation</Button></Link>
              {s && <Link to="/marketplace/supplier/$id" params={{ id: s.id }}><Button variant="outline"><Store className="size-4 mr-1.5" /> View supplier</Button></Link>}
            </div>
          </div>
        </div>

        {s && (
          <Card className="mt-6 p-5">
            <div className="flex items-start gap-3">
              {s.logo_url ? <img src={s.logo_url} alt={s.name} className="size-12 rounded object-cover" /> : <div className="size-12 rounded bg-muted grid place-items-center font-semibold">{s.name?.[0]}</div>}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">{s.name}</span>
                  {s.status === "verified" && <Badge className="gap-1"><ShieldCheck className="size-3" /> Verified</Badge>}
                </div>
                <div className="text-sm text-muted-foreground">{[s.city, s.country].filter(Boolean).join(", ")}</div>
                {s.description && <p className="text-sm mt-2 line-clamp-3">{s.description}</p>}
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
