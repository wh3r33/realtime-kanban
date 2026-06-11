import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedRoles = new Set(["viewer", "editor"]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function mapRpcError(error: { message?: string; code?: string } | null) {
  const message = error?.message || "Internal error";
  if (/permission_denied|permission|rls|row-level/i.test(message)) return { status: 403, message: "You do not have permission to invite members to this board." };
  if (/invalid_role/i.test(message)) return { status: 400, message: "Role must be viewer or editor." };
  if (error?.code === "23505" || /duplicate|unique/i.test(message)) return { status: 409, message: "A pending invite already exists for this email." };
  if (/invalid input syntax for type uuid/i.test(message)) return { status: 400, message: "board_id must be a valid UUID." };
  return { status: 500, message };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = env("SUPABASE_URL");
    const anonKey = env("SUPABASE_ANON_KEY");
    const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization") || "";

    if (!authorization.toLowerCase().startsWith("bearer ")) {
      return json({ error: "Missing Authorization bearer token" }, 401);
    }

    let body: { board_id?: string; email?: string; role?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Request body must be valid JSON" }, 400);
    }

    const boardId = String(body.board_id || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "").trim();

    if (!boardId) return json({ error: "board_id is required" }, 400);
    if (!emailPattern.test(email)) return json({ error: "A valid email is required" }, 400);
    if (!allowedRoles.has(role)) return json({ error: "Role must be viewer or editor" }, 400);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false }
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    const user = authData?.user;
    if (authError || !user) return json({ error: "Unauthenticated" }, 401);

    const { data: membership, error: membershipError } = await userClient
      .from("board_members")
      .select("role")
      .eq("board_id", boardId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      const mapped = mapRpcError(membershipError);
      return json({ error: mapped.message }, mapped.status === 500 ? 403 : mapped.status);
    }
    if (membership?.role !== "owner") return json({ error: "Only board owners can invite members." }, 403);

    const { data: existing, error: duplicateLookupError } = await adminClient
      .from("board_invites")
      .select("*")
      .eq("board_id", boardId)
      .eq("email", email)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (duplicateLookupError) return json({ error: duplicateLookupError.message }, 500);
    if (existing) return json({ invite: existing, duplicate: true }, 200);

    const { data: invite, error: rpcError } = await userClient.rpc("create_board_invite", {
      p_board_id: boardId,
      p_email: email,
      p_role: role
    });

    if (rpcError) {
      const mapped = mapRpcError(rpcError);
      return json({ error: mapped.message }, mapped.status);
    }

    await adminClient.from("activity_logs").insert({
      board_id: boardId,
      user_id: user.id,
      action: "invite_created",
      entity_type: "board_invite",
      entity_id: invite.id,
      old_data: null,
      new_data: invite
    });

    return json({ invite, duplicate: false }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[invite-user]", message);
    return json({ error: message }, 500);
  }
});
