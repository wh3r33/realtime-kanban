import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function mapRpcError(error: { message?: string } | null) {
  const message = error?.message || "Internal error";
  if (/invite_not_found_or_expired/i.test(message)) return { status: 404, message: "Invitation was not found or has expired." };
  if (/email_mismatch/i.test(message)) return { status: 403, message: "Sign in with the invited email address to accept this invitation." };
  if (/profile_not_found/i.test(message)) return { status: 400, message: "Authenticated profile was not found." };
  if (/already_member/i.test(message)) return { status: 409, message: "This user is already a board member." };
  if (/permission_denied|permission|rls|row-level/i.test(message)) return { status: 403, message: "You do not have permission to accept this invitation." };
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

    let body: { token?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Request body must be valid JSON" }, 400);
    }

    const token = String(body.token || "").trim();
    if (!token || token.length < 12) return json({ error: "A valid invitation token is required" }, 400);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false }
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    const user = authData?.user;
    if (authError || !user?.email) return json({ error: "Unauthenticated" }, 401);

    const { data: invite, error: inviteError } = await adminClient
      .from("board_invites")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (inviteError) return json({ error: inviteError.message }, 500);
    if (!invite) return json({ error: "Invitation not found" }, 404);
    if (invite.accepted_at) return json({ error: "Invitation has already been accepted" }, 409);
    if (invite.declined_at || invite.revoked_at) return json({ error: "Invitation was revoked or declined" }, 400);
    if (new Date(invite.expires_at).getTime() <= Date.now()) return json({ error: "Invitation has expired" }, 400);
    if (String(invite.email).toLowerCase() !== user.email.toLowerCase()) {
      return json({ error: "Sign in with the invited email address to accept this invitation." }, 403);
    }

    await adminClient.from("profiles").upsert({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email,
      avatar_url: user.user_metadata?.avatar_url || null
    });

    const { data: accepted, error: rpcError } = await userClient.rpc("accept_board_invite", {
      p_token: token
    });

    if (rpcError) {
      const mapped = mapRpcError(rpcError);
      return json({ error: mapped.message }, mapped.status);
    }

    const { data: member, error: memberError } = await adminClient
      .from("board_members")
      .select("board_id, user_id, role, invited_by, created_at, profiles(id, email, name, avatar_url)")
      .eq("board_id", invite.board_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError) return json({ error: memberError.message }, 500);

    return json({ status: "ok", invite: { ...invite, accepted_at: new Date().toISOString() }, board: accepted, member }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[accept-invite]", message);
    return json({ error: message }, 500);
  }
});
