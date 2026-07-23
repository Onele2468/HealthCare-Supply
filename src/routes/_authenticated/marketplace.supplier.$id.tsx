import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentContext } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Package, ShieldCheck, Star, ArrowLeft, MessageSquarePlus, Mail, Globe, Phone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/marketplace/supplier/$id")({
  head: () => ({ meta: [{ title: "Supplier — Healthcare Marketplace" }] }),
  component: SupplierStorefront,
});

function SupplierStorefront() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });

  const { data: supplier } = useQuery({
    queryKey: ["storefront-supplier", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["storefront-products", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, category, image_url, unit_price, brand_name").eq("supplier_org_id", id).eq("is_active", true).limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["storefront-stats", id],
    queryFn: async () => {
      const { data } = await supabase.from("supplier_rating_stats").select("*").eq("supplier_org_id", id).maybeSingle();
      return data;
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["storefront-reviews", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_reviews")
        .select("*, reviewer:organizations!reviewer_org_id(name, logo_url)")
        .eq("supplier_org_id", id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const currency = ctx?.currentOrg?.currency ?? "ZAR";
  const canReview = !!ctx?.currentOrg && ctx.currentOrg.id !== id;

  if (!supplier) return <AppShell><div className="p-8">Loading…</div></AppShell>;

  return (
    <AppShell>
      <div className="p-8 max-w-6xl">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/marketplace" })}><ArrowLeft className="size-4 mr-1.5" /> Back to marketplace</Button>

        <Card className="mt-4 p-6">
          <div className="flex items-start gap-4 flex-wrap">
            {supplier.logo_url ? <img src={supplier.logo_url} alt={supplier.name} className="size-16 rounded-lg object-cover" /> : <div className="size-16 rounded-lg bg-muted grid place-items-center text-xl font-semibold">{supplier.name?.[0]}</div>}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-tight">{supplier.name}</h1>
                {supplier.status === "verified" && <Badge className="gap-1"><ShieldCheck className="size-3" /> Verified supplier</Badge>}
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {[supplier.industry, supplier.city, supplier.country].filter(Boolean).join(" • ")}
              </div>
              {stats?.avg_rating && (
                <div className="mt-2 flex items-center gap-1 text-sm">
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  <span className="font-medium">{Number(stats.avg_rating).toFixed(1)}</span>
                  <span className="text-muted-foreground">({stats.review_count} reviews)</span>
                </div>
              )}
              {supplier.description && <p className="text-sm mt-3 max-w-2xl">{supplier.description}</p>}
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground flex-wrap">
                {supplier.business_email && <span className="flex items-center gap-1"><Mail className="size-3" /> {supplier.business_email}</span>}
                {supplier.phone && <span className="flex items-center gap-1"><Phone className="size-3" /> {supplier.phone}</span>}
                {supplier.website && <a href={supplier.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary"><Globe className="size-3" /> {supplier.website}</a>}
              </div>
            </div>
            {canReview && <ReviewDialog supplierId={id} reviewerOrgId={ctx!.currentOrg!.id} userId={ctx!.user!.id} onDone={() => { qc.invalidateQueries({ queryKey: ["storefront-reviews", id] }); qc.invalidateQueries({ queryKey: ["storefront-stats", id] }); }} />}
          </div>
        </Card>

        <div className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight mb-3">Products ({products?.length ?? 0})</h2>
          {products && products.length === 0 ? (
            <Card className="py-12 text-center text-sm text-muted-foreground">This supplier hasn't listed products yet.</Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {products?.map((p: any) => (
                <Link key={p.id} to="/marketplace/product/$id" params={{ id: p.id }}>
                  <Card className="overflow-hidden hover:border-primary transition">
                    <div className="aspect-square bg-muted">
                      {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center"><Package className="size-8 text-muted-foreground" /></div>}
                    </div>
                    <div className="p-2.5">
                      <div className="text-sm font-medium line-clamp-2">{p.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.category || p.brand_name}</div>
                      <div className="text-sm font-semibold mt-1 tabular-nums">{formatCurrency(p.unit_price, currency)}</div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight mb-3">Reviews</h2>
          {reviews && reviews.length === 0 ? (
            <Card className="py-8 text-center text-sm text-muted-foreground">No reviews yet. Be the first to review this supplier.</Card>
          ) : (
            <div className="space-y-3">
              {reviews?.map((r: any) => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded bg-muted grid place-items-center text-xs font-semibold">{r.reviewer?.name?.[0] ?? "?"}</div>
                    <div>
                      <div className="text-sm font-medium">{r.reviewer?.name ?? "Organization"}</div>
                      <div className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map((n) => (
                          <Star key={n} className={`size-3 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                        ))}
                      </div>
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  {r.title && <div className="mt-2 font-medium text-sm">{r.title}</div>}
                  {r.comment && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{r.comment}</p>}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ReviewDialog({ supplierId, reviewerOrgId, userId, onDone }: { supplierId: string; reviewerOrgId: string; userId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("supplier_reviews").upsert({
        supplier_org_id: supplierId,
        reviewer_org_id: reviewerOrgId,
        reviewer_user_id: userId,
        rating,
        title: title || null,
        comment: comment || null,
      }, { onConflict: "supplier_org_id,reviewer_org_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Review submitted"); setOpen(false); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><MessageSquarePlus className="size-4 mr-1.5" /> Write a review</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Review this supplier</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Rating</Label>
            <div className="flex items-center gap-1 mt-1">
              {[1,2,3,4,5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)}>
                  <Star className={`size-6 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Title (optional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Great supplier, fast delivery…" />
          </div>
          <div>
            <Label>Comment</Label>
            <textarea className="w-full min-h-24 rounded-md border border-input bg-background p-2 text-sm" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>
        <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending}>Submit review</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
