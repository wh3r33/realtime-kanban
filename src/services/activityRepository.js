import { getCurrentUser, isMissingSupabaseSchemaError, isSupabaseSetupError, missingSupabaseEnvMessage, supabase, supabaseSetupError, warnSupabaseError } from "./supabaseClient";

function requireClient() {
  if (!supabase) return { error: new Error(missingSupabaseEnvMessage) };
  return { client: supabase };
}

function titleFor(action = "") {
  if (action === "invite_created") return "Invite Created";
  if (action === "invite_accepted") return "Invite Accepted";
  if (action === "invite_declined") return "Invite Declined";
  if (action === "invite_revoked") return "Invite Revoked";
  return action.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function bodyFor(row) {
  if (row.action === "invite_created") return `Invitation sent to ${row.new_data?.email || "a teammate"}`;
  if (row.action === "invite_accepted") return `${row.new_data?.email || "A teammate"} accepted the invitation`;
  if (row.action === "invite_declined") return `${row.new_data?.email || "A teammate"} declined the invitation`;
  if (row.action === "invite_revoked") return `Invitation revoked for ${row.old_data?.email || "a teammate"}`;
  return row.new_data?.title || row.new_data?.description || row.entity_type || "";
}

function mapActivity(row) {
  return {
    id: row.id,
    boardId: row.board_id,
    actorId: row.user_id,
    type: row.action,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    oldData: row.old_data,
    newData: row.new_data,
    title: titleFor(row.action),
    body: bodyFor(row),
    createdAt: row.created_at ? new Date(row.created_at).toLocaleString() : ""
  };
}

export async function listBoardActivity(boardId) {
  const { client, error } = requireClient();
  if (error) return { data: [], error };
  const { data, error: queryError } = await client
    .from("activity_logs")
    .select("*")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false })
    .limit(50);
  warnSupabaseError("activity list failed", queryError);
  if (isMissingSupabaseSchemaError(queryError)) return { data: [], error: null };
  return { data: (data || []).map(mapActivity), error: isSupabaseSetupError(queryError) ? supabaseSetupError("Activity logs could not be loaded from Supabase") : queryError };
}

export async function createActivityLog(boardId, action, entityType, entityId, oldData = null, newData = null) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data: user, error: userError } = await getCurrentUser();
  if (userError || !user) {
    const authError = userError || new Error("No authenticated Supabase user.");
    warnSupabaseError("activity insert skipped because auth is missing", authError);
    return { data: null, error: authError };
  }
  const { data, error: insertError } = await client
    .from("activity_logs")
    .insert({
      board_id: boardId,
      user_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_data: oldData,
      new_data: newData
    })
    .select()
    .single();
  warnSupabaseError("activity insert failed", insertError);
  if (isMissingSupabaseSchemaError(insertError)) return { data: null, error: null };
  return { data: data ? mapActivity(data) : null, error: isSupabaseSetupError(insertError) ? supabaseSetupError("Activity log could not be created in Supabase") : insertError };
}
