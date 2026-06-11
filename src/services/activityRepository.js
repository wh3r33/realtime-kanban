import { getCurrentUser, isSupabaseSetupError, missingSupabaseEnvMessage, supabase, supabaseSetupError, warnSupabaseError } from "./supabaseClient";

function requireClient() {
  if (!supabase) return { error: new Error(missingSupabaseEnvMessage) };
  return { client: supabase };
}

function titleFor(action = "") {
  return action.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
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
    body: row.new_data?.title || row.new_data?.description || row.entity_type || "",
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
  return { data: data ? mapActivity(data) : null, error: isSupabaseSetupError(insertError) ? supabaseSetupError("Activity log could not be created in Supabase") : insertError };
}
