import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, LogOut, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentContext, switchOrg } from "@/lib/api";
import { getNavForType, getRoleLabel } from "@/lib/org-config";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: ctx, isLoading } = useQuery({ queryKey: ["ctx"], queryFn: fetchCurrentContext });

  // If the user is signed in but has no organization, send them to onboarding.
  useEffect(() => {
    if (!isLoading && ctx?.user && !ctx.currentOrg && pathname !== "/onboarding") {
      router.navigate({ to: "/onboarding", replace: true });
    }
  }, [isLoading, ctx?.user, ctx?.currentOrg, pathname, router]);

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  const handleSwitchOrg = async (orgId: string) => {
    await switchOrg(orgId);
    qc.invalidateQueries();
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col sticky top-0 h-screen self-start max-h-screen overflow-y-auto">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-[image:var(--gradient-primary)] grid place-items-center text-primary-foreground font-bold">S</div>
            <div>
              <div className="font-semibold leading-tight">Smart Supply</div>
              <div className="text-[11px] text-sidebar-foreground/60">Powering procurement, inventory &amp; supply chains</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {getNavForType(ctx?.currentOrg?.type).map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to} to={n.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                }`}
              >
                <n.icon className="size-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border text-xs text-sidebar-foreground/60">
          v1.0 · Production
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <header className="h-14 shrink-0 border-b bg-card flex items-center justify-between px-6 sticky top-0 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 -ml-3">
                <Building2 className="size-4 text-primary" />
                <span className="font-medium">
                  {ctx?.currentOrg?.name ?? "No organization"}
                </span>
                {ctx?.currentOrg && (
                  <span className="text-xs text-muted-foreground">
                    · {getRoleLabel(ctx.currentOrg.type)}
                  </span>
                )}
                <ChevronDown className="size-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Switch organization</DropdownMenuLabel>
              {ctx?.memberships?.map((m: any) => (
                <DropdownMenuItem key={m.id} onClick={() => handleSwitchOrg(m.org_id)}>
                  <div className="flex flex-col">
                    <span className="font-medium">{m.organization?.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {getRoleLabel(m.organization?.type)} · {m.role.replace(/_/g, " ")}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/organization">+ Create or join organization</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {ctx?.profile?.full_name ?? ctx?.user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="size-4 mr-1.5" /> Sign out
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

