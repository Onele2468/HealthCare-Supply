import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentContext, logAudit, generateInvitationToken, invitationUrl, STATUS_TONE } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, RefreshCcw, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/invitations")({
  head: () => ({ meta: [{ title: "Invitations — Smart Supply" }] }),
  component: InvitationsPage,
});

type Inv = {
  id: string; email: string; role: string; status: string;
  token_hash: string; expires_at: string; created_at: string; accepted_at: string | null;
};

function InvitationsPage() {
  const qc = useQueryClient();
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });
  const orgId = ctx?.currentOrg?.id;

  const { data: invitations, isLoading } = useQuery({
    queryKey: ["invitations", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations").select("*")
        .eq("org_id", orgId!).order("created_at", { ascending: false });
      if (error) throw error;
      // mark expired client-side for display (DB also has trigger via accept fn)
      const now = Date.now();
      return (data ?? []).map((i: any) => ({
        ...i,
        status: i.status === "pending" && new Date(i.expires_at).getTime() < now ? "expired" : i.status,
      })) as Inv[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["invitations", orgId] });

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(invitationUrl(token));
    toast.success("Invitation link copied");
  };

  const cancel = async (inv: Inv) => {
    const { error } = await supabase.from("invitations").update({ status: "revoked" }).eq("id", inv.id);
    if (error) return toast.error(error.message);
    logAudit(orgId!, "invitation.revoked", "invitation", inv.id);
    toast.success("Invitation revoked");
    refresh();
  };

  const resend = async (inv: Inv) => {
    const token = generateInvitationToken();
    const { error } = await supabase.from("invitations").update({
      token_hash: token,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: "pending",
    }).eq("id", inv.id);
    if (error) return toast.error(error.message);
    logAudit(orgId!, "invitation.resent", "invitation", inv.id);
    navigator.clipboard.writeText(invitationUrl(token));
    toast.success("New invitation link copied to clipboard");
    refresh();
  };

  if (!orgId) {
    return (
      <AppShell>
        <div className="p-8"><p className="text-sm text-muted-foreground">Select an organization first.</p></div>
      </AppShell>
    );
  }

  const groups = (["pending", "accepted", "expired", "revoked"] as const).map((s) => ({
    status: s,
    items: (invitations ?? []).filter((i) => i.status === s),
  }));

  return (
    <AppShell>
      <div className="p-8 max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Invitations</h1>
            <p className="text-sm text-muted-foreground">Track and manage team invitations for {ctx?.currentOrg?.name}.</p>
          </div>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground mt-6">Loading…</p>}

        {groups.map((g) => (
          <Card key={g.status} className="mt-6 p-0 overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_TONE[g.status] ?? "bg-muted"}`}>{g.status}</span>
                <span className="text-sm text-muted-foreground">{g.items.length} invitation{g.items.length === 1 ? "" : "s"}</span>
              </div>
            </div>
            {g.items.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No {g.status} invitations.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>{g.status === "accepted" ? "Accepted" : "Expires"}</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.email}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{i.role.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(i.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(g.status === "accepted" ? (i.accepted_at ?? i.created_at) : i.expires_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {i.status === "pending" && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => copyLink(i.token_hash)}><Copy className="size-3.5 mr-1" />Copy link</Button>
                              <Button size="sm" variant="outline" onClick={() => cancel(i)}><XCircle className="size-3.5 mr-1" />Cancel</Button>
                            </>
                          )}
                          {(i.status === "expired" || i.status === "revoked") && (
                            <Button size="sm" variant="outline" onClick={() => resend(i)}><RefreshCcw className="size-3.5 mr-1" />Resend</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
