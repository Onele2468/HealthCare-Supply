import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Warehouse, ClipboardList, Truck, BarChart3, ShieldCheck, Boxes,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Supply — Healthcare Procurement & Marketplace Platform" },
      { name: "description", content: "Enterprise healthcare procurement platform for hospitals, clinics, pharmacies, laboratories and medical suppliers. Source medicines, medical consumables, equipment and lab supplies from verified suppliers." },
      { property: "og:title", content: "Smart Supply — Healthcare Procurement" },
      { property: "og:description", content: "Connect verified healthcare suppliers with hospitals, clinics and pharmacies." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-[image:var(--gradient-primary)] grid place-items-center text-primary-foreground font-bold">S</div>
            <span className="font-semibold tracking-tight">Smart Supply</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild><Link to="/auth">Sign in</Link></Button>
            <Button asChild><Link to="/auth">Get started</Link></Button>
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="absolute inset-0 bg-[image:var(--gradient-hero)] opacity-[0.97]" />
        <div className="relative max-w-6xl mx-auto px-6 py-24 text-primary-foreground">
          <p className="uppercase text-xs tracking-widest text-primary-foreground/70 mb-4">Enterprise healthcare procurement</p>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight max-w-3xl">
            Healthcare procurement, connected end-to-end.
          </h1>
          <p className="mt-6 text-lg text-primary-foreground/80 max-w-2xl">
            Hospitals, clinics, pharmacies and laboratories source medicines,
            consumables, equipment and lab supplies from verified healthcare
            suppliers — with RFQs, quotations, orders and deliveries in one platform.
          </p>
          <div className="mt-8 flex gap-3">
            <Button size="lg" variant="secondary" asChild>
              <Link to="/auth">Start free trial</Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-transparent border-white/30 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-semibold tracking-tight">Built for every link in the chain</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          A single source of truth across procurement, warehousing and last-mile delivery —
          across every industry.
        </p>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Boxes, title: "Product catalog", body: "Manage SKUs, batches, pricing and barcodes per supplier." },
            { icon: Warehouse, title: "Warehouse operations", body: "Per-warehouse inventory with reorder thresholds and expiry tracking." },
            { icon: ClipboardList, title: "Procurement workflows", body: "Draft → Approved → Dispatched → Delivered. Full audit trail." },
            { icon: Truck, title: "Delivery tracking", body: "Track status, ETAs, drivers and proof of delivery in real time." },
            { icon: BarChart3, title: "Supply chain analytics", body: "Spend, fast/slow movers, supplier performance and stock-out risk." },
            { icon: ShieldCheck, title: "Multi-tenant security", body: "Row-level isolation, granular roles, audit logs and a public API." },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="size-10 rounded-md bg-primary/10 text-primary grid place-items-center mb-4">
                <f.icon className="size-5" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1.5">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Smart Supply. All rights reserved.
      </footer>
    </div>
  );
}
