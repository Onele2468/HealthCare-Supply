// Server-only helpers for /api/public/v1/*. Never import from client modules.
import { createHash, randomBytes } from "crypto";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
  "Access-Control-Max-Age": "86400",
};

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...extra },
  });
}

export function preflight() {
  return new Response(null, { status: 204, headers: CORS });
}

export function hashKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateKey() {
  const raw = "ssk_live_" + randomBytes(24).toString("base64url");
  return { raw, prefix: raw.slice(0, 12), hash: hashKey(raw) };
}

export type ApiCaller = {
  orgId: string;
  keyId: string;
  scopes: string[];
};

export async function authenticate(request: Request): Promise<
  | { ok: true; caller: ApiCaller; admin: Awaited<ReturnType<typeof loadAdmin>> }
  | { ok: false; response: Response }
> {
  const header = request.headers.get("authorization") || "";
  const xkey = request.headers.get("x-api-key") || "";
  const raw = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : xkey.trim();
  if (!raw) return { ok: false, response: json({ error: "Missing API key" }, 401) };

  const admin = await loadAdmin();
  const { data, error } = await admin
    .from("api_keys")
    .select("id, org_id, scopes, revoked_at")
    .eq("key_hash", hashKey(raw))
    .maybeSingle();

  if (error || !data || data.revoked_at) {
    return { ok: false, response: json({ error: "Invalid API key" }, 401) };
  }

  // best-effort touch; ignore error
  admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {});

  return { ok: true, caller: { orgId: data.org_id, keyId: data.id, scopes: data.scopes }, admin };
}

export function requireScope(caller: ApiCaller, scope: string) {
  return caller.scopes.includes(scope)
    ? null
    : json({ error: `Missing scope: ${scope}` }, 403);
}

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
