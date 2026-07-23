import { supabase } from "@/integrations/supabase/client";

// Organization type is now free-form text — these are the recommended starter set
// but additional types can be created without a database change.
export const ORG_TYPES = [
  "supplier", "buyer", "manufacturer", "distributor", "warehouse",
  "retailer", "wholesaler", "logistics", "transport", "government",
] as const;
export type OrgType = (typeof ORG_TYPES)[number] | string;

export const ORG_TYPE_LABELS: Record<string, string> = {
  supplier: "Supplier", buyer: "Buyer", manufacturer: "Manufacturer",
  distributor: "Distributor", warehouse: "Warehouse", retailer: "Retailer",
  wholesaler: "Wholesaler", logistics: "Logistics Company",
  transport: "Transport Company", government: "Government Department",
  // legacy types still supported
  clinic: "Clinic", hospital: "Hospital", pharmacy: "Pharmacy",
};

export const INDUSTRIES = [
  "Healthcare", "Retail", "Construction", "Agriculture", "Manufacturing",
  "Government", "Technology", "Food Distribution", "Wholesale", "Logistics", "Other",
] as const;

export type AppRole =
  | "super_admin" | "support_admin" | "compliance_admin" | "org_admin"
  | "supplier_admin" | "warehouse_manager" | "delivery_manager" | "supplier_staff"
  | "clinic_admin" | "hospital_admin" | "pharmacist" | "inventory_manager" | "procurement_officer";

export const ASSIGNABLE_ROLES: AppRole[] = [
  "org_admin", "warehouse_manager", "delivery_manager",
  "inventory_manager", "procurement_officer", "supplier_staff",
];

export const ORG_STATUSES = ["pending", "verified", "suspended", "archived"] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];

export const PO_STATUSES = ["draft", "submitted", "under_review", "approved", "processing", "dispatched", "delivered", "cancelled"] as const;
export const DELIVERY_STATUSES = ["pending", "processing", "packed", "in_transit", "delivered", "delayed", "cancelled"] as const;
export type PoStatus = (typeof PO_STATUSES)[number];
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-accent text-accent-foreground",
  under_review: "bg-warning/15 text-warning-foreground",
  approved: "bg-primary/15 text-primary",
  processing: "bg-primary/15 text-primary",
  dispatched: "bg-primary/20 text-primary",
  delivered: "bg-success/20 text-success",
  cancelled: "bg-destructive/15 text-destructive",
  pending: "bg-warning/15 text-warning-foreground",
  packed: "bg-accent text-accent-foreground",
  in_transit: "bg-primary/15 text-primary",
  delayed: "bg-warning/15 text-warning-foreground",
  verified: "bg-success/20 text-success",
  suspended: "bg-destructive/15 text-destructive",
  archived: "bg-muted text-muted-foreground",
  approved_join: "bg-success/20 text-success",
  rejected: "bg-destructive/15 text-destructive",
};

export async function fetchCurrentContext() {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return { user: null, profile: null, memberships: [] as any[], currentOrg: null, currentRoles: [] as AppRole[] };

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("memberships").select("*, organization:organizations(*)").eq("user_id", user.id),
  ]);

  const currentOrgId = profile?.current_org_id ?? memberships?.[0]?.org_id ?? null;
  const currentOrg = memberships?.find((m: any) => m.org_id === currentOrgId)?.organization ?? null;
  const currentRoles = memberships?.filter((m: any) => m.org_id === currentOrgId).map((m: any) => m.role as AppRole) ?? [];

  return { user, profile, memberships: memberships ?? [], currentOrg, currentRoles };
}

export type CreateOrgInput = {
  name: string;
  type: string;
  ownership?: string;
  industry?: string;
  description?: string;
  registration_number?: string;
  tax_number?: string;
  country?: string;
  province?: string;
  city?: string;
  address?: string;
  phone?: string;
  business_email?: string;
  website?: string;
  logo_url?: string;
};

export async function createOrganization(input: CreateOrgInput) {
  const { data, error } = await supabase.rpc("create_organization_with_admin", {
    _name: input.name,
    _type: input.type,
    _industry: input.industry ?? undefined,
    _registration_number: input.registration_number ?? undefined,
    _tax_number: input.tax_number ?? undefined,
    _country: input.country ?? undefined,
    _province: input.province ?? undefined,
    _city: input.city ?? undefined,
    _address: input.address ?? undefined,
    _phone: input.phone ?? undefined,
    _business_email: input.business_email ?? undefined,
    _website: input.website ?? undefined,
    _logo_url: input.logo_url ?? undefined,
  });
  if (error) throw error;
  // Persist ownership/description (not covered by the RPC) directly.
  const orgId = typeof data === "string" ? data : (data as any)?.id ?? (data as any)?.org_id;
  if (orgId && (input.ownership || input.description)) {
    await supabase.from("organizations").update({
      ownership: input.ownership ?? null,
      description: input.description ?? null,
    }).eq("id", orgId);
  }
  return data;
}

export async function updateOrganizationSettings(orgId: string, patch: Partial<CreateOrgInput & { currency: string; timezone: string; language: string }>) {
  const { data, error } = await supabase.rpc("update_organization_settings", {
    _org_id: orgId,
    _name: patch.name ?? undefined,
    _type: patch.type ?? undefined,
    _industry: patch.industry ?? undefined,
    _registration_number: patch.registration_number ?? undefined,
    _tax_number: patch.tax_number ?? undefined,
    _country: patch.country ?? undefined,
    _province: patch.province ?? undefined,
    _city: patch.city ?? undefined,
    _address: patch.address ?? undefined,
    _phone: patch.phone ?? undefined,
    _business_email: patch.business_email ?? undefined,
    _website: patch.website ?? undefined,
    _logo_url: patch.logo_url ?? undefined,
    _currency: patch.currency ?? undefined,
    _timezone: patch.timezone ?? undefined,
    _language: patch.language ?? undefined,
  });
  if (error) throw error;
  // Ownership and description aren't covered by the RPC — persist them directly.
  if (patch.ownership !== undefined || patch.description !== undefined) {
    const extras: Record<string, any> = {};
    if (patch.ownership !== undefined) extras.ownership = patch.ownership || null;
    if (patch.description !== undefined) extras.description = patch.description || null;
    const { error: e2 } = await supabase.from("organizations").update(extras as any).eq("id", orgId);
    if (e2) throw e2;
  }
  return data;
}

export async function requestJoinByCode(code: string, message?: string) {
  const { data, error } = await supabase.rpc("request_join_by_code", {
    _code: code, _message: message ?? undefined,
  });
  if (error) throw error;
  return data;
}

export async function decideJoinRequest(requestId: string, approve: boolean, role: AppRole = "org_admin") {
  const { data, error } = await supabase.rpc("decide_join_request", {
    _request_id: requestId, _approve: approve, _role: role,
  });
  if (error) throw error;
  return data;
}

export async function switchOrg(orgId: string) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return;
  await supabase.from("profiles").update({ current_org_id: orgId }).eq("id", userRes.user.id);
}

export function logAudit(orgId: string, action: string, entity?: string, entityId?: string, metadata?: any) {
  supabase.auth.getUser().then(({ data }) => {
    if (!data.user) return;
    supabase.from("audit_logs").insert({
      org_id: orgId, user_id: data.user.id, action, entity, entity_id: entityId, metadata,
    });
  });
}

export function generateInvitationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function invitationUrl(token: string): string {
  return `${window.location.origin}/accept-invitation?token=${encodeURIComponent(token)}`;
}
