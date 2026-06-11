import { getCurrentUser, isSupabaseSetupError, missingSupabaseEnvMessage, supabase, supabaseSetupError, warnSupabaseError } from "./supabaseClient";

function requireClient() {
  if (!supabase) return { error: new Error(missingSupabaseEnvMessage) };
  return { client: supabase };
}

function initialsFor(nameOrEmail = "") {
  const source = nameOrEmail.trim();
  if (!source) return "US";
  const parts = source.split(/\s+/).slice(0, 2);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.map((part) => part[0]).join("").toUpperCase();
}

function mapMember(row) {
  const profile = row.users || {};
  const name = profile.name || profile.email || "Unknown user";
  return {
    id: row.user_id,
    boardId: row.board_id,
    name,
    email: profile.email || "",
    initials: initialsFor(name),
    color: "#2855FF",
    role: row.role,
    presence: "not connected",
    activity: "No recent activity",
    joinedAt: row.created_at
  };
}

function mapInvitation(row) {
  return {
    id: row.id,
    boardId: row.board_id,
    email: row.email,
    role: row.role,
    token: row.token,
    invitedBy: row.invited_by,
    acceptedBy: row.accepted_by,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at
  };
}

export async function listBoardMembers(boardId) {
  const { client, error } = requireClient();
  if (error) return { data: [], error };
  const { data, error: queryError } = await client
    .from("board_members")
    .select("board_id, user_id, role, created_at, users(id, email, name, avatar_url)")
    .eq("board_id", boardId)
    .order("created_at", { ascending: true });
  warnSupabaseError("board members list failed", queryError);
  return { data: (data || []).map(mapMember), error: isSupabaseSetupError(queryError) ? supabaseSetupError("Board members could not be loaded from Supabase") : queryError };
}

export async function getCurrentUserBoardRole(boardId) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data: user, error: userError } = await getCurrentUser();
  if (userError || !user) return { data: null, error: userError || new Error("No authenticated Supabase user.") };
  const { data, error: queryError } = await client
    .from("board_members")
    .select("role")
    .eq("board_id", boardId)
    .eq("user_id", user.id)
    .maybeSingle();
  warnSupabaseError("current user board role lookup failed", queryError);
  return { data: data?.role || null, error: isSupabaseSetupError(queryError) ? supabaseSetupError("Current board role could not be loaded from Supabase") : queryError };
}

export async function listBoardInvitations(boardId) {
  const { client, error } = requireClient();
  if (error) return { data: [], error };
  const { data, error: queryError } = await client.from("board_invitations").select("*").eq("board_id", boardId).is("revoked_at", null).is("accepted_at", null).order("created_at", { ascending: false });
  warnSupabaseError("board invitations list failed", queryError);
  return { data: (data || []).map(mapInvitation), error: isSupabaseSetupError(queryError) ? supabaseSetupError("Board invitations could not be loaded from Supabase") : queryError };
}

export async function createBoardInvitation(boardId, email, role = "viewer") {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data: user, error: userError } = await getCurrentUser();
  if (userError || !user) return { data: null, error: userError || new Error("No authenticated Supabase user.") };
  const { data, error: insertError } = await client
    .from("board_invitations")
    .insert({ board_id: boardId, email: email.trim().toLowerCase(), role, invited_by: user.id })
    .select()
    .single();
  warnSupabaseError("board invitation create failed", insertError);
  return { data: data ? mapInvitation(data) : null, error: isSupabaseSetupError(insertError) ? supabaseSetupError("Board invitation could not be created in Supabase") : insertError };
}

export async function revokeBoardInvitation(invitationId) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data, error: updateError } = await client.from("board_invitations").update({ revoked_at: new Date().toISOString() }).eq("id", invitationId).select().maybeSingle();
  warnSupabaseError("board invitation revoke failed", updateError);
  return { data: data ? mapInvitation(data) : null, error: isSupabaseSetupError(updateError) ? supabaseSetupError("Board invitation could not be revoked in Supabase") : updateError };
}

export async function acceptInvitation(token) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data, error: rpcError } = await client.rpc("accept_board_invitation", { invite_token: token });
  warnSupabaseError("board invitation accept failed", rpcError);
  return {
    data: data ? { boardId: data.board_id, userId: data.user_id, role: data.role } : null,
    error: isSupabaseSetupError(rpcError) ? supabaseSetupError("Board invitation could not be accepted in Supabase") : rpcError
  };
}

export async function updateMemberRole(boardId, userId, role) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data, error: updateError } = await client
    .from("board_members")
    .update({ role })
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .select("board_id, user_id, role, created_at, users(id, email, name, avatar_url)")
    .maybeSingle();
  warnSupabaseError("board member role update failed", updateError);
  return { data: data ? mapMember(data) : null, error: isSupabaseSetupError(updateError) ? supabaseSetupError("Board member role could not be updated in Supabase") : updateError };
}

export async function removeBoardMember(boardId, userId) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data, error: deleteError } = await client
    .from("board_members")
    .delete()
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .select("board_id, user_id, role, created_at, users(id, email, name, avatar_url)")
    .maybeSingle();
  warnSupabaseError("board member remove failed", deleteError);
  return { data: data ? mapMember(data) : null, error: isSupabaseSetupError(deleteError) ? supabaseSetupError("Board member could not be removed in Supabase") : deleteError };
}
