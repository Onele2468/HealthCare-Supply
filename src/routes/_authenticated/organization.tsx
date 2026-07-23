import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/shell";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchCurrentContext, ORG_TYPE_LABELS,
  createOrganization, requestJoinByCode, decideJoinRequest,
  generateInvitationToken, invitationUrl, logAudit, ASSIGNABLE_ROLES,
  type CreateOrgInput, type AppRole, STATUS_TONE,
} from "@/lib/api";
import { BUSINESS_TYPES, OWNERSHIP_OPTIONS, INDUSTRY_OPTIONS } from "@/lib/org-config";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Mail, Copy, KeyRound, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/organization")({
  head: () => ({ meta: [{ title: "Organization — Smart Supply" }] }),
  component: OrganizationPage,
});

function OrganizationPage() {
  const qc = useQueryClient();
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });
  const orgId = ctx?.currentOrg?.id;
  const isAdmin = ctx?.currentRoles?.includes("org_admin") || ctx?.currentRoles?.includes("super_admin");

  const { data: members } = useQuery({
    queryKey: ["members", orgId], enabled: !!orgId,
    queryFn: async () => (await supabase.from("memberships").select("*").eq("org_id", orgId!)).data ?? [],
  });

  const { data: joinRequests } = useQuery({
    queryKey: ["join-requests", orgId], enabled: !!orgId,
    queryFn: async () => (await supabase.from("join_requests").select("*").eq("org_id", orgId!).eq("status", "pending").order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <AppShell>
      <div className="p-8 max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
          <p className="text-sm text-muted-foreground">Manage your organizations, members and join requests.</p>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Your organizations</h2>
            <div className="flex gap-2">
              <JoinByCodeDialog />
              <CreateOrgDialog />
            </div>
          </div>
          <div className="mt-3 divide-y">
            {ctx?.memberships?.map((m: any) => (
              <div key={m.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{m.organization?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {ORG_TYPE_LABELS[m.organization?.type] ?? m.organization?.type} ·
                    {" "}{m.role.replace(/_/g, " ")} ·
                    {" "}<span className="font-mono">{m.organization?.code}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded ${STATUS_TONE[m.organization?.status] ?? "bg-muted"}`}>
                    {m.organization?.status}
                  </span>
                  {m.org_id === orgId && <span className="text-xs text-primary font-medium">Active</span>}
                </div>
              </div>
            ))}
            {!ctx?.memberships?.length && <p className="text-sm text-muted-foreground py-2">You haven't joined any organizations yet.</p>}
          </div>
        </Card>

        {ctx?.currentOrg && (
          <>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Team members — {ctx.currentOrg.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Org code: <span className="font-mono">{ctx.currentOrg.code}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/invitations"><Mail className="size-4 mr-1.5" /> Manage invitations</Link>
                  </Button>
                  {isAdmin && <InviteByEmail orgId={ctx.currentOrg.id} />}
                </div>
              </div>
              <div className="mt-3 divide-y">
                {members?.map((m: any) => (
                  <div key={m.id} className="py-3 flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{m.user_id.slice(0, 8)}…</span>
                    <span className="text-muted-foreground">{m.role.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            </Card>

            {isAdmin && (
              <Card className="p-6">
                <h2 className="font-semibold">Pending join requests</h2>
                <p className="text-xs text-muted-foreground">Users who entered your organization code.</p>
                <div className="mt-3 divide-y">
                  {!joinRequests?.length && <p className="text-sm text-muted-foreground py-2">No pending requests.</p>}
                  {joinRequests?.map((r: any) => (
                    <JoinRequestRow key={r.id} req={r} onDone={() => qc.invalidateQueries({ queryKey: ["join-requests", orgId] })} />
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function JoinRequestRow({ req, onDone }: { req: any; onDone: () => void }) {
  const [role, setRole] = useState<AppRole>("procurement_officer");
  const decide = async (approve: boolean) => {
    try { await decideJoinRequest(req.id, approve, role); toast.success(approve ? "Approved" : "Rejected"); onDone(); }
    catch (e: any) { toast.error(e.message); }
  };
  return (
    <div className="py-3 flex items-center justify-between text-sm gap-3">
      <span className="font-mono text-xs text-muted-foreground flex-1">{req.user_id.slice(0, 8)}…</span>
      <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
        <SelectContent>{ASSIGNABLE_ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
      </Select>
      <Button size="sm" onClick={() => decide(true)}><Check className="size-4 mr-1" /> Approve</Button>
      <Button size="sm" variant="outline" onClick={() => decide(false)}><X className="size-4 mr-1" /> Reject</Button>
    </div>
  );
}

const WEBSITE_RE = /^https:\/\/[^\s]+\.[^\s]+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;

export function CreateOrgDialog({ trigger, minimal = false, redirectToDashboard = false }: { trigger?: React.ReactNode; minimal?: boolean; redirectToDashboard?: boolean } = {}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const initial: CreateOrgInput = { name: "", type: "buyer", ownership: "private", industry: "Other" };
  const [form, setForm] = useState<CreateOrgInput>(initial);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof CreateOrgInput) => (e: any) => setForm({ ...form, [k]: typeof e === "string" ? e : e.target.value });

  const errors: Partial<Record<keyof CreateOrgInput, string>> = {};
  if (!form.name.trim()) errors.name = "Required";
  if (!form.type) errors.type = "Required";
  if (form.business_email && !EMAIL_RE.test(form.business_email)) errors.business_email = "Enter a valid email";
  if (form.phone && !PHONE_RE.test(form.phone)) errors.phone = "Use digits, spaces and + only";
  if (form.website && !WEBSITE_RE.test(form.website)) errors.website = "Must start with https://";
  const hasErrors = Object.keys(errors).length > 0;

  const submit = async () => {
    if (hasErrors) return;
    setBusy(true);
    try {
      const org = await createOrganization(form);
      toast.success("Organization created successfully.");
      setOpen(false); setForm(initial);
      await qc.invalidateQueries();
      if (redirectToDashboard) navigate({ to: "/dashboard", replace: true });
    } catch (e: any) {
      console.error("createOrganization failed:", e);
      toast.error("Unable to create your organization.", { description: "Please try again or contact your administrator if the problem continues." });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}>
      <DialogTrigger asChild>{trigger ?? <Button><Building2 className="size-4 mr-1.5" /> Create organization</Button>}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Create organization</DialogTitle>
          <DialogDescription>
            {minimal
              ? "Just the essentials to get started. You can complete your company profile later in Settings."
              : "Set up a workspace for your company."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-3">
            <Field className="col-span-2" label="Organization name" required error={errors.name}>
              <Input value={form.name} onChange={set("name")} placeholder="Acme Pharmaceuticals" />
            </Field>
            <Field label="Organization type" required error={errors.type}>
              <Select value={form.type} onValueChange={set("type")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BUSINESS_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Ownership / sector">
              <Select value={form.ownership ?? "private"} onValueChange={set("ownership")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{OWNERSHIP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Industry" required>
              <Select value={form.industry} onValueChange={set("industry")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{INDUSTRY_OPTIONS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
              </Select>
            </Field>

            {!minimal && (
              <>
                <Field label="Registration number"><Input value={form.registration_number ?? ""} onChange={set("registration_number")} /></Field>
                <Field label="Tax number"><Input value={form.tax_number ?? ""} onChange={set("tax_number")} /></Field>
                <Field label="Country"><Input value={form.country ?? ""} onChange={set("country")} /></Field>
                <Field label="Province / State"><Input value={form.province ?? ""} onChange={set("province")} /></Field>
                <Field label="City"><Input value={form.city ?? ""} onChange={set("city")} /></Field>
                <Field className="col-span-2" label="Physical address"><Input value={form.address ?? ""} onChange={set("address")} /></Field>
                <Field label="Business email" error={errors.business_email}><Input type="email" value={form.business_email ?? ""} onChange={set("business_email")} placeholder="hello@acme.com" /></Field>
                <Field label="Phone" error={errors.phone}><Input value={form.phone ?? ""} onChange={set("phone")} placeholder="+27 82 123 4567" /></Field>
                <Field className="col-span-2" label="Website" error={errors.website}><Input value={form.website ?? ""} onChange={set("website")} placeholder="https://acme.com" /></Field>
                <Field className="col-span-2" label="Logo URL"><Input value={form.logo_url ?? ""} onChange={set("logo_url")} placeholder="https://…/logo.png" /></Field>
                <Field className="col-span-2" label="Business description"><Textarea rows={3} value={form.description ?? ""} onChange={set("description")} placeholder="What does your organization do?" /></Field>
              </>
            )}
          </div>
          {minimal && (
            <p className="text-xs text-muted-foreground mt-4">
              Registration number, tax number, address, phone, website, and logo can be added later in <span className="font-medium text-foreground">Settings → General</span>.
            </p>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t shrink-0 bg-background">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || hasErrors}>{busy ? "Creating…" : "Create organization"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, error, children, className }: { label: string; required?: boolean; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}


export function JoinByCodeDialog({ trigger }: { trigger?: React.ReactNode } = {}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      await requestJoinByCode(code, message);
      toast.success("Request sent to the organization admin.");
      setOpen(false); setCode(""); setMessage("");
      qc.invalidateQueries({ queryKey: ["my-join-requests"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button variant="outline"><KeyRound className="size-4 mr-1.5" /> Join by code</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Request to join an organization</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Organization code</Label>
            <Input placeholder="SUP-4F8X91" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono" />
          </div>
          <div>
            <Label>Message (optional)</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell the admin who you are…" />
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={busy || !code}>Send request</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteByEmail({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("procurement_officer");
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const send = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    const token = generateInvitationToken();
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase.from("invitations").insert({
      org_id: orgId, email: cleanEmail, role, token_hash: token, invited_by: userRes.user!.id,
    });
    if (error) {
      toast.error(error.message.includes("invitations_unique_pending") ? "An invitation is already pending for this email." : error.message);
      return;
    }
    logAudit(orgId, "invitation.sent", "invitation", undefined, { email: cleanEmail, role });
    setCreatedLink(invitationUrl(token));
    qc.invalidateQueries({ queryKey: ["invitations"] });
    toast.success("Invitation created");
  };

  const reset = () => { setOpen(false); setEmail(""); setCreatedLink(null); };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : reset())}>
      <DialogTrigger asChild><Button size="sm"><Mail className="size-4 mr-1.5" /> Invite by email</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite a team member</DialogTitle></DialogHeader>
        {!createdLink ? (
          <>
            <div className="space-y-3 py-2">
              <div><Label>Email address</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" /></div>
              <div>
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ASSIGNABLE_ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={send} disabled={!email}>Send invitation</Button></DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Share this secure link with <span className="font-medium text-foreground">{email}</span>. It expires in 7 days.
              </p>
              <div className="flex gap-2">
                <Input readOnly value={createdLink} className="font-mono text-xs" />
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(createdLink); toast.success("Link copied"); }}>
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
            <DialogFooter><Button onClick={reset}>Done</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
