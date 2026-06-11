import { getCurrentUser, isMissingSupabaseSchemaError, isSupabaseSetupError, migrationRequiredError, missingSupabaseEnvMessage, supabase, supabaseSetupError, warnSupabaseError } from "./supabaseClient";
import { createActivityLog } from "./activityRepository";

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
  const profile = row.profiles || {};
  const name = profile.name || profile.email || row.user_id || "Unknown user";
  return {
    id: row.user_id,
    boardId: row.board_id,
    name,
    email: profile.email || "",
    avatarUrl: profile.avatar_url || "",
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
    acceptedAt: row.accepted_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at
  };
}

function logBoardMembersError(context, error) {
  if (!error) return;
  const details = [error.message, error.details, error.hint].filter(Boolean).join(" ");
  console.warn(`[Supabase] ${context}: ${details || "unknown error"}${error.code ? ` (code ${error.code})` : ""}${error.status ? ` (status ${error.status})` : ""}`);
}

export async function listBoardMembers(boardId) {
  const { client, error } = requireClient();
  if (error) return { data: [], error };
  const { data, error: queryError } = await client
    .from("board_members")
    .select("board_id, user_id, role, created_at, profiles:profiles!board_members_user_id_fkey(id, email, name, avatar_url)")
    .eq("board_id", boardId)
    .order("created_at", { ascending: true });
  warnSupabaseError("board members list failed", queryError);
  logBoardMembersError("board members list failed", queryError);
  if (queryError) {
    console.warn("[Supabase] Loading board member rows without embedded profile details.");
    const fallback = await client
      .from("board_members")
      .select("board_id, user_id, role, created_at")
      .eq("board_id", boardId)
      .order("created_at", { ascending: true });
    warnSupabaseError("board members fallback list failed", fallback.error);
    logBoardMembersError("board members fallback list failed", fallback.error);
    if (fallback.error) return { data: [], error: isSupabaseSetupError(fallback.error) ? supabaseSetupError("Board members could not be loaded from Supabase") : fallback.error };

    const rows = fallback.data || [];
    const userIds = rows.map((row) => row.user_id).filter(Boolean);
    let profilesById = {};
    if (userIds.length) {
      const profiles = await client.from("profiles").select("id, email, name, avatar_url").in("id", userIds);
      warnSupabaseError("board member profile fallback failed", profiles.error);
      logBoardMembersError("board member profile fallback failed", profiles.error);
      if (!isMissingSupabaseSchemaError(profiles.error) && !profiles.error) {
        profilesById = Object.fromEntries((profiles.data || []).map((profile) => [profile.id, profile]));
      }
    }
    return { data: rows.map((row) => mapMember({ ...row, profiles: profilesById[row.user_id] || null })), error: null };
  }
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
  const { data, error: queryError } = await client.from("board_invites").select("*").eq("board_id", boardId).is("accepted_at", null).order("created_at", { ascending: false });
  warnSupabaseError("board invitations list failed", queryError);
  if (isMissingSupabaseSchemaError(queryError)) return { data: [], error: migrationRequiredError("Invites") };
  return { data: (data || []).map(mapInvitation), error: isSupabaseSetupError(queryError) ? supabaseSetupError("Board invitations could not be loaded from Supabase") : queryError };
}

export async function createBoardInvitation(boardId, email, role = "viewer") {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const cleanEmail = email.trim().toLowerCase();
  const { data, error: invokeError } = await client.functions.invoke("invite-user", {
    body: { board_id: boardId, email: cleanEmail, role }
  });
  warnSupabaseError("invite-user function failed", invokeError);
  if (isMissingSupabaseSchemaError(invokeError)) return { data: null, error: migrationRequiredError("Invites") };
  return {
    data: data?.invite ? mapInvitation(data.invite) : null,
    error: isSupabaseSetupError(invokeError) ? supabaseSetupError("Board invitation could not be created in Supabase") : invokeError,
    duplicate: Boolean(data?.duplicate)
  };
}

export async function revokeBoardInvitation(invitationId) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data, error: updateError } = await client.from("board_invites").delete().eq("id", invitationId).select().maybeSingle();
  warnSupabaseError("board invitation revoke failed", updateError);
  if (isMissingSupabaseSchemaError(updateError)) return { data: null, error: migrationRequiredError("Invites") };
  if (!updateError && data) await createActivityLog(data.board_id, "invite_revoked", "board_invite", data.id, data, null);
  return { data: data ? mapInvitation(data) : null, error: isSupabaseSetupError(updateError) ? supabaseSetupError("Board invitation could not be revoked in Supabase") : updateError };
}

export async function acceptInvitation(token) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data, error: rpcError } = await client.functions.invoke("accept-invite", { body: { token } });
  warnSupabaseError("accept-invite function failed", rpcError);
  if (isMissingSupabaseSchemaError(rpcError)) return { data: null, error: migrationRequiredError("Invites") };
  return {
    data: data?.board ? { boardId: data.board.board_id, role: data.board.role, member: data.member } : null,
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
    .select("board_id, user_id, role, created_at, profiles:profiles!board_members_user_id_fkey(id, email, name, avatar_url)")
    .maybeSingle();
  warnSupabaseError("board member role update failed", updateError);
  if (isMissingSupabaseSchemaError(updateError)) {
    const fallback = await client
      .from("board_members")
      .update({ role })
      .eq("board_id", boardId)
      .eq("user_id", userId)
      .select("board_id, user_id, role, created_at")
      .maybeSingle();
    warnSupabaseError("board member role fallback update failed", fallback.error);
    return { data: fallback.data ? mapMember(fallback.data) : null, error: isSupabaseSetupError(fallback.error) ? supabaseSetupError("Board member role could not be updated in Supabase") : fallback.error };
  }
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
    .select("board_id, user_id, role, created_at, profiles:profiles!board_members_user_id_fkey(id, email, name, avatar_url)")
    .maybeSingle();
  warnSupabaseError("board member remove failed", deleteError);
  if (isMissingSupabaseSchemaError(deleteError)) {
    const fallback = await client
      .from("board_members")
      .delete()
      .eq("board_id", boardId)
      .eq("user_id", userId)
      .select("board_id, user_id, role, created_at")
      .maybeSingle();
    warnSupabaseError("board member remove fallback failed", fallback.error);
    return { data: fallback.data ? mapMember(fallback.data) : null, error: isSupabaseSetupError(fallback.error) ? supabaseSetupError("Board member could not be removed in Supabase") : fallback.error };
  }
  return { data: data ? mapMember(data) : null, error: isSupabaseSetupError(deleteError) ? supabaseSetupError("Board member could not be removed in Supabase") : deleteError };
}
