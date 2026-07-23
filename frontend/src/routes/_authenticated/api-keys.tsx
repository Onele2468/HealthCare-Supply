import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentContext, logAudit } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, KeyRound, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/api-keys")({
  component: ApiKeysPage,
});

const DEFAULT_SCOPES = [
  "inventory:read",
  "products:read",
  "rfqs:read",
  "quotations:read",
  "purchase-orders:read",
  "purchase-orders:write",
  "deliveries:read",
  "network:read",
];

function ApiKeysPage() {
  const qc = useQueryClient();
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });
  const orgId = ctx?.currentOrg?.id;
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);

  const { data: keys } = useQuery({
    enabled: !!orgId,
    queryKey: ["api_keys", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("id, name, key_prefix, scopes, last_used_at, revoked_at, created_at")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createKey = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("No organization selected");
      if (!name.trim()) throw new Error("Name required");
      // Generate client-side using Web Crypto
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      const raw = "ssk_live_" + btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
      const hash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("api_keys").insert({
        org_id: orgId,
        name: name.trim(),
        key_prefix: raw.slice(0, 12),
        key_hash: hash,
        scopes: DEFAULT_SCOPES,
        created_by: u.user?.id,
      });
      if (error) throw error;
      logAudit(orgId, "api_key.created", "api_key", undefined, { name: name.trim() });
      return raw;
    },
    onSuccess: (raw) => {
      setCreated(raw);
      setName("");
      qc.invalidateQueries({ queryKey: ["api_keys"] });
      toast.success("API key created — copy it now, it won't be shown again");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revokeKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      if (orgId) logAudit(orgId, "api_key.revoked", "api_key", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api_keys"] });
      toast.success("Key revoked");
    },
  });

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><KeyRound className="size-6 text-primary" /> API Keys</h1>
          <p className="text-sm text-muted-foreground">Allow external systems and partner applications to query your catalog, inventory, purchase orders, deliveries, and business network on behalf of this organization.</p>
        </div>

        <Card className="p-5 space-y-3">
          <h2 className="font-medium">Create a new key</h2>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>Key name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Smart Clinic Production" />
            </div>
            <Button onClick={() => createKey.mutate()} disabled={createKey.isPending || !orgId}>
              Generate key
            </Button>
          </div>
          {created && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
              <div className="text-xs font-medium text-primary mb-1">Copy this key now — it will not be displayed again.</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs break-all bg-background border rounded px-2 py-1.5">{created}</code>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(created); toast.success("Copied"); }}>
                  <Copy className="size-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCreated(null)}>Done</Button>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-medium mb-3">Existing keys</h2>
          <div className="space-y-2">
            {!keys?.length && <p className="text-sm text-muted-foreground">No API keys yet.</p>}
            {keys?.map((k) => (
              <div key={k.id} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                <div className="space-y-0.5">
                  <div className="font-medium">{k.name}</div>
                  <div className="text-xs text-muted-foreground">
                    <code>{k.key_prefix}…</code> · {k.scopes.length} scopes · {k.last_used_at ? `last used ${new Date(k.last_used_at).toLocaleString()}` : "never used"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {k.revoked_at ? (
                    <Badge variant="outline" className="text-muted-foreground">Revoked</Badge>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => revokeKey.mutate(k.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 space-y-2 text-sm">
          <h2 className="font-medium">Endpoints</h2>
          <p className="text-muted-foreground text-xs">Base URL: <code>{typeof window !== "undefined" ? window.location.origin : ""}/api/public/v1</code>. Send the key as <code>Authorization: Bearer ssk_live_…</code> or <code>X-Api-Key</code>.</p>
          <ul className="text-xs space-y-1 font-mono">
            <li><span className="text-primary">GET</span> /companies?type=supplier&amp;industry=Retail</li>
            <li><span className="text-primary">GET</span> /connections</li>
            <li><span className="text-primary">GET</span> /inventory?low_stock=true</li>
            <li><span className="text-primary">GET</span> /products?search=…</li>
            <li><span className="text-primary">GET</span> /purchase-orders</li>
            <li><span className="text-primary">POST</span> /purchase-orders  {`{ supplier_org_id, items:[{product_id,quantity}], submit:true }`}</li>
            <li><span className="text-primary">GET</span> /deliveries/{`{id}`}</li>
            <li><span className="text-primary">GET</span> /restock</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
