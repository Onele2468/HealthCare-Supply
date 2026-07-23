import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentContext } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, KeyRound, LogOut } from "lucide-react";
import { CreateOrgDialog, JoinByCodeDialog } from "./organization";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome to Smart Supply" }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const { data: ctx } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });

  // Once they belong to an organization, send them to the dashboard.
  useEffect(() => {
    if (ctx?.currentOrg) navigate({ to: "/dashboard", replace: true });
  }, [ctx?.currentOrg, navigate]);

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); };

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-md bg-[image:var(--gradient-primary)] grid place-items-center text-primary-foreground font-bold">S</div>
          <span className="font-semibold">Smart Supply</span>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="size-4 mr-1.5" /> Sign out</Button>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome to Smart Supply</h1>
        <p className="text-muted-foreground mt-2">
          To continue, create a new organization or join an existing one. You need to belong
          to at least one organization to access the platform.
        </p>

        <div className="grid md:grid-cols-2 gap-4 mt-8">
          <Card className="p-6">
            <div className="size-10 rounded-md bg-primary/10 text-primary grid place-items-center mb-4">
              <Building2 className="size-5" />
            </div>
            <h2 className="font-semibold">Create organization</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Set up a new workspace for your company. You'll be its administrator.
            </p>
            <div className="mt-4">
              <CreateOrgDialog minimal redirectToDashboard trigger={<Button className="w-full">Create organization</Button>} />
            </div>
          </Card>

          <Card className="p-6">
            <div className="size-10 rounded-md bg-accent text-accent-foreground grid place-items-center mb-4">
              <KeyRound className="size-5" />
            </div>
            <h2 className="font-semibold">Join existing organization</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your organization code (e.g. <span className="font-mono">SUP-4F8X91</span>) to
              request access. The admin will approve your request.
            </p>
            <div className="mt-4">
              <JoinByCodeDialog trigger={<Button variant="outline" className="w-full">Join by code</Button>} />
            </div>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground mt-8">
          If you've been invited by email, open the invitation link from your inbox instead.
        </p>
      </div>
    </div>
  );
}
