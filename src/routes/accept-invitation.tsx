import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, CheckCircle2, AlertTriangle } from "lucide-react";

type Search = { token?: string };

export const Route = createFileRoute("/accept-invitation")({
  validateSearch: (s: Record<string, unknown>): Search => ({ token: typeof s.token === "string" ? s.token : undefined }),
  head: () => ({ meta: [{ title: "Accept invitation — Smart Supply" }] }),
  component: AcceptInvitationPage,
});

type InvitationInfo = {
  id: string; org_id: string; org_name: string; email: string;
  role: string; status: string; expires_at: string;
};

function AcceptInvitationPage() {
  const { token } = useSearch({ from: "/accept-invitation" });
  const navigate = useNavigate();
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!token) { setLoadError("Missing invitation token."); return; }
    supabase.rpc("get_invitation_by_token", { _token_hash: token }).then(({ data, error }) => {
      if (error) { setLoadError(error.message); return; }
      const row = (data ?? [])[0];
      if (!row) { setLoadError("This invitation link is invalid."); return; }
      setInfo(row as InvitationInfo);
    });
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, [token]);

  const expired = info && (info.status === "expired" || new Date(info.expires_at).getTime() < Date.now());
  const usable = info && info.status === "pending" && !expired;
  const emailMatch = info && userEmail && info.email.toLowerCase() === userEmail.toLowerCase();

  const accept = async () => {
    if (!token) return;
    setWorking(true);
    const { error } = await supabase.rpc("accept_invitation", { _token_hash: token });
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Invitation accepted");
    navigate({ to: "/dashboard", replace: true });
  };

  const goToAuth = () => {
    const redirect = encodeURIComponent(`/accept-invitation?token=${encodeURIComponent(token ?? "")}`);
    navigate({ to: "/auth", search: { redirect, email: info?.email } as any });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-muted/30 p-6">
      <Card className="w-full max-w-md p-8">
        <div className="size-12 rounded-full bg-primary/10 grid place-items-center mb-4">
          <Mail className="size-6 text-primary" />
        </div>

        {loadError ? (
          <>
            <h1 className="text-xl font-semibold">Invitation unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground flex items-start gap-2">
              <AlertTriangle className="size-4 mt-0.5 text-warning-foreground" /> {loadError}
            </p>
            <Button asChild className="mt-6 w-full"><Link to="/">Go home</Link></Button>
          </>
        ) : !info ? (
          <p className="text-sm text-muted-foreground">Loading invitation…</p>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Join {info.org_name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You've been invited as <span className="font-medium text-foreground capitalize">{info.role.replace(/_/g, " ")}</span>.
            </p>

            <div className="mt-5 rounded-md border bg-muted/40 p-3 text-sm">
              <div className="text-muted-foreground text-xs">Invitation sent to</div>
              <div className="font-medium">{info.email}</div>
            </div>

            {!usable && (
              <p className="mt-4 text-sm text-warning-foreground flex items-center gap-2">
                <AlertTriangle className="size-4" /> This invitation is {expired ? "expired" : info.status}.
              </p>
            )}

            {usable && !userEmail && (
              <>
                <p className="mt-5 text-sm text-muted-foreground">
                  Sign in or create your Smart Supply account with <span className="font-medium text-foreground">{info.email}</span> to accept.
                </p>
                <Button onClick={goToAuth} className="mt-4 w-full">Continue</Button>
              </>
            )}

            {usable && userEmail && !emailMatch && (
              <>
                <p className="mt-5 text-sm text-destructive">
                  You're signed in as {userEmail}. Sign out and sign back in with {info.email} to accept this invitation.
                </p>
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={async () => { await supabase.auth.signOut(); setUserEmail(null); }}
                >
                  Sign out
                </Button>
              </>
            )}

            {usable && emailMatch && (
              <Button onClick={accept} disabled={working} className="mt-6 w-full">
                <CheckCircle2 className="size-4 mr-1.5" />
                {working ? "Accepting…" : `Join ${info.org_name}`}
              </Button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
