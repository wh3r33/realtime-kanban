import { isSupabaseConfigured, isSupabaseSetupError, missingSupabaseEnvMessage, supabase, supabaseSetupError, warnSupabaseError } from "./supabaseClient";
import { createActivityLog } from "./activityRepository";
import { getCurrentUser } from "./supabaseClient";

function requireClient() {
  if (!supabase) return { error: new Error(missingSupabaseEnvMessage) };
  return { client: supabase };
}

function mapCard(row) {
  return {
    id: row.id,
    boardId: row.board_id,
    columnId: row.column_id,
    column: row.columns?.title || row.column_id,
    title: row.title,
    description: row.description || "",
    assigneeId: row.assigned_to,
    createdBy: row.created_by,
    position: row.position ?? 0,
    status: row.status || "active",
    labels: row.labels || [],
    history: [],
    updatedAt: row.updated_at ? new Date(row.updated_at).toLocaleString() : "",
    version: row.version || 1,
    createdAt: row.created_at,
    deletedAt: row.deleted_at || null
  };
}

function normalizePayload(payload) {
  const next = {};
  if ("title" in payload) next.title = payload.title;
  if ("description" in payload) next.description = payload.description;
  if ("assignedTo" in payload) next.assigned_to = payload.assignedTo;
  if ("assigneeId" in payload) next.assigned_to = payload.assigneeId;
  if ("status" in payload) next.status = payload.status;
  if ("labels" in payload) next.labels = payload.labels;
  if ("position" in payload) next.position = payload.position;
  if ("columnId" in payload) next.column_id = payload.columnId;
  return next;
}

export async function createCard(boardId, columnId, payload) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data: user, error: userError } = await getCurrentUser();
  if (userError || !user) return { data: null, error: userError || new Error("No authenticated Supabase user.") };
  const { count } = await client.from("cards").select("id", { count: "exact", head: true }).eq("board_id", boardId).eq("column_id", columnId).is("deleted_at", null);
  const row = {
    board_id: boardId,
    column_id: columnId,
    title: payload.title,
    description: payload.description || "",
    assigned_to: payload.assigneeId || payload.assignedTo || null,
    created_by: user.id,
    position: payload.position ?? count ?? 0,
    status: payload.status || "active",
    labels: payload.labels || []
  };
  const { data, error: insertError } = await client.from("cards").insert(row).select("*, columns(title)").single();
  warnSupabaseError("cards insert failed", insertError);
  if (!insertError && data) await createActivityLog(boardId, "card_created", "card", data.id, null, data);
  return { data: data ? mapCard(data) : null, error: isSupabaseSetupError(insertError) ? supabaseSetupError("Card could not be created in Supabase") : insertError };
}

export async function updateCard(cardId, payload) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data: before, error: beforeError } = await client.from("cards").select("*").eq("id", cardId).maybeSingle();
  warnSupabaseError("card lookup before update failed", beforeError);
  if (beforeError || !before) return { data: null, error: isSupabaseSetupError(beforeError) ? supabaseSetupError("Card could not be loaded from Supabase before update") : beforeError || new Error("Card was not found.") };
  const patch = normalizePayload(payload);
  const { data, error: updateError } = await client.from("cards").update(patch).eq("id", cardId).select("*, columns(title)").maybeSingle();
  warnSupabaseError("cards update failed", updateError);
  if (!updateError && !data) return { data: null, error: new Error("Card update returned no row.") };
  if (!updateError && data) await createActivityLog(data.board_id, "card_updated", "card", cardId, before, data);
  return { data: data ? mapCard(data) : null, error: isSupabaseSetupError(updateError) ? supabaseSetupError("Card could not be updated in Supabase") : updateError };
}

export async function deleteCard(cardId) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data: before, error: beforeError } = await client.from("cards").select("*").eq("id", cardId).maybeSingle();
  warnSupabaseError("card lookup before delete failed", beforeError);
  if (beforeError || !before) return { data: null, error: isSupabaseSetupError(beforeError) ? supabaseSetupError("Card could not be loaded from Supabase before delete") : beforeError || new Error("Card was not found.") };
  const { data, error: deleteError } = await client
    .from("cards")
    .update({ deleted_at: new Date().toISOString(), status: "deleted" })
    .eq("id", cardId)
    .select("*, columns(title)")
    .maybeSingle();
  warnSupabaseError("cards delete failed", deleteError);
  if (!deleteError && data) await createActivityLog(before.board_id, "card_deleted", "card", cardId, before, data);
  return { data: data ? mapCard(data) : mapCard(before), error: isSupabaseSetupError(deleteError) ? supabaseSetupError("Card could not be deleted from Supabase") : deleteError };
}

export async function moveCard(cardId, columnId, position) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data: moved, error: rpcError } = await client.rpc("move_card_safely", {
    move_card_id: cardId,
    target_column_id: columnId,
    target_position: position
  });
  warnSupabaseError("cards move rpc failed", rpcError);
  if (rpcError || !moved) return { data: null, error: isSupabaseSetupError(rpcError) ? supabaseSetupError("Card could not be moved in Supabase") : rpcError || new Error("Card move returned no row.") };
  const { data, error: reloadError } = await client.from("cards").select("*, columns(title)").eq("id", cardId).maybeSingle();
  warnSupabaseError("cards move reload failed", reloadError);
  return { data: data ? mapCard(data) : mapCard(moved), error: isSupabaseSetupError(reloadError) ? supabaseSetupError("Moved card could not be reloaded from Supabase") : reloadError };
}

export async function restoreCard(cardId) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data: restored, error: rpcError } = await client.rpc("restore_card", { restore_card_id: cardId });
  warnSupabaseError("cards restore rpc failed", rpcError);
  if (rpcError || !restored) return { data: null, error: isSupabaseSetupError(rpcError) ? supabaseSetupError("Card could not be restored in Supabase") : rpcError || new Error("Card restore returned no row.") };
  const { data, error: reloadError } = await client.from("cards").select("*, columns(title)").eq("id", cardId).maybeSingle();
  warnSupabaseError("cards restore reload failed", reloadError);
  return { data: data ? mapCard(data) : mapCard(restored), error: isSupabaseSetupError(reloadError) ? supabaseSetupError("Restored card could not be reloaded from Supabase") : reloadError };
}

export async function persistCardMovement(movement) {
  if (!isSupabaseConfigured) return { error: new Error(missingSupabaseEnvMessage) };
  return moveCard(movement.cardId, movement.toColumnId, movement.toPosition);
}
