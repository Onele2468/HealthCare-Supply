import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/shell";
import { fetchCurrentContext, updateOrganizationSettings, STATUS_TONE } from "@/lib/api";
import { BUSINESS_TYPES, OWNERSHIP_OPTIONS, INDUSTRY_OPTIONS } from "@/lib/org-config";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const CURRENCIES = ["ZAR", "USD", "EUR", "GBP", "NGN", "KES", "AUD", "CAD"];

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Smart Supply" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });
  const org = ctx?.currentOrg;
  const isAdmin = ctx?.currentRoles?.includes("org_admin") || ctx?.currentRoles?.includes("super_admin");
  const [form, setForm] = useState<any>({});
  useEffect(() => { if (org) setForm({ ...org }); }, [org?.id]);

  if (!org) return <AppShell><div className="p-8">Select an organization first.</div></AppShell>;

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: typeof e === "string" ? e : e.target.value });
  const save = async () => {
    try {
      await updateOrganizationSettings(org.id, form);
      toast.success("Settings saved");
      qc.invalidateQueries();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <AppShell>
      <div className="p-8 max-w-5xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage organization, team, security and preferences.</p>
          </div>
          <div className="text-right text-xs">
            <div>Org ID: <span className="font-mono">{org.id.slice(0, 8)}…</span></div>
            <div>Org Code: <span className="font-mono font-medium">{org.code}</span></div>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded ${STATUS_TONE[org.status] ?? "bg-muted"}`}>{org.status}</span>
          </div>
        </div>

        <Tabs defaultValue="general" className="mt-6">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="organization">Organization</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card className="p-6 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Organization name</Label><Input value={form.name ?? ""} onChange={set("name")} disabled={!isAdmin} /></div>
                <div className="col-span-2"><Label>Logo URL</Label><Input value={form.logo_url ?? ""} onChange={set("logo_url")} disabled={!isAdmin} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.type ?? ""} onValueChange={set("type")} disabled={!isAdmin}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BUSINESS_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ownership / sector</Label>
                  <Select value={form.ownership ?? "private"} onValueChange={set("ownership")} disabled={!isAdmin}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{OWNERSHIP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Industry</Label>
                  <Select value={form.industry ?? ""} onValueChange={set("industry")} disabled={!isAdmin}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{INDUSTRY_OPTIONS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Currency</Label>
                  <Select value={form.currency ?? "ZAR"} onValueChange={set("currency")} disabled={!isAdmin}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>Description</Label><Input value={form.description ?? ""} onChange={set("description")} disabled={!isAdmin} /></div>
                <div><Label>Registration number</Label><Input value={form.registration_number ?? ""} onChange={set("registration_number")} disabled={!isAdmin} /></div>
                <div><Label>Tax number</Label><Input value={form.tax_number ?? ""} onChange={set("tax_number")} disabled={!isAdmin} /></div>
                <div><Label>Phone</Label><Input value={form.phone ?? ""} onChange={set("phone")} disabled={!isAdmin} /></div>
                <div><Label>Business email</Label><Input value={form.business_email ?? ""} onChange={set("business_email")} disabled={!isAdmin} /></div>
                <div className="col-span-2"><Label>Website</Label><Input value={form.website ?? ""} onChange={set("website")} disabled={!isAdmin} /></div>
                <div className="col-span-2"><Label>Address</Label><Input value={form.address ?? ""} onChange={set("address")} disabled={!isAdmin} /></div>
                <div><Label>City</Label><Input value={form.city ?? ""} onChange={set("city")} disabled={!isAdmin} /></div>
                <div><Label>Province / State</Label><Input value={form.province ?? ""} onChange={set("province")} disabled={!isAdmin} /></div>
                <div><Label>Country</Label><Input value={form.country ?? ""} onChange={set("country")} disabled={!isAdmin} /></div>
                <div><Label>Time zone</Label><Input value={form.timezone ?? ""} onChange={set("timezone")} disabled={!isAdmin} placeholder="Africa/Johannesburg" /></div>
                <div><Label>Language</Label><Input value={form.language ?? ""} onChange={set("language")} disabled={!isAdmin} placeholder="en" /></div>
              </div>
              {isAdmin && <div className="mt-4 flex justify-end"><Button onClick={save}>Save changes</Button></div>}
            </Card>
          </TabsContent>

          <TabsContent value="organization">
            <Card className="p-6 mt-4 space-y-3 text-sm">
              <Row label="Organization ID" value={<span className="font-mono">{org.id}</span>} />
              <Row label="Organization Code" value={<span className="font-mono font-medium">{org.code}</span>} />
              <Row label="Verification Status" value={<span className={`px-2 py-0.5 rounded ${STATUS_TONE[org.status] ?? "bg-muted"}`}>{org.status}</span>} />
              <Row label="Created" value={new Date(org.created_at).toLocaleString()} />
            </Card>
          </TabsContent>

          <TabsContent value="preferences">
            <Card className="p-6 mt-4 text-sm text-muted-foreground">
              Theme, date / time / number format and default warehouse preferences will appear here.
            </Card>
          </TabsContent>

          <TabsContent value="data">
            <Card className="p-6 mt-4 text-sm text-muted-foreground">
              Export, backup, restore and delete-organization controls will appear here.
              For now, use the Reports module to export CSVs.
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b last:border-0 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
