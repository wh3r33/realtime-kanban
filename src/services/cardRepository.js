import {
  isMissingSupabaseSchemaError,
  isSupabaseConfigured,
  isSupabaseSetupError,
  migrationRequiredError,
  missingSupabaseEnvMessage,
  supabase,
  supabaseSetupError,
  warnSupabaseError
} from "./supabaseClient";
import { getCurrentUser } from "./supabaseClient";

function requireClient() {
  if (!supabase) return { error: new Error(missingSupabaseEnvMessage) };
  return { client: supabase };
}

function mapCard(row) {
  if (!row) return null;
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
    aiPriority: row.ai_priority ?? null,
    aiPriorityReason: row.ai_priority_reason || "",
    history: [],
    updatedAt: row.updated_at ? new Date(row.updated_at).toLocaleString() : "",
    version: row.version || 1,
    createdAt: row.created_at,
    deletedAt: row.status === "deleted" ? row.updated_at : null
  };
}

export function mapCardRecord(row) {
  return mapCard(row);
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
  let count = 0;
  const countResult = await client.from("cards").select("id", { count: "exact", head: true }).eq("board_id", boardId).eq("column_id", columnId).eq("status", "active");
  warnSupabaseError("cards count failed", countResult.error);
  count = countResult.count ?? 0;
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
  return { data: data ? mapCard(data) : null, error: isSupabaseSetupError(insertError) ? supabaseSetupError("Card could not be created in Supabase") : insertError };
}

async function reloadCard(client, cardId) {
  const { data, error } = await client.from("cards").select("*, columns(title)").eq("id", cardId).maybeSingle();
  warnSupabaseError("card conflict reload failed", error);
  return { data: data ? mapCard(data) : null, error };
}

function conflictResult(remote) {
  const error = new Error("Конфликт версии: карточка уже изменена другим пользователем.");
  error.code = "CARD_VERSION_CONFLICT";
  return { data: null, error, conflict: true, remote };
}

export async function updateCard(cardId, payload, expectedVersion) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data: before, error: beforeError } = await client.from("cards").select("*").eq("id", cardId).maybeSingle();
  warnSupabaseError("card lookup before update failed", beforeError);
  if (beforeError || !before) return { data: null, error: isSupabaseSetupError(beforeError) ? supabaseSetupError("Card could not be loaded from Supabase before update") : beforeError || new Error("Card was not found.") };
  const patch = normalizePayload(payload);
  patch.updated_by = (await getCurrentUser()).data?.id || null;
  patch.version = (before.version || 1) + 1;
  let query = client.from("cards").update(patch).eq("id", cardId);
  if (expectedVersion) query = query.eq("version", expectedVersion);
  const { data, error: updateError } = await query.select("*, columns(title)").maybeSingle();
  warnSupabaseError("cards update failed", updateError);
  if (!updateError && !data) {
    const latest = await reloadCard(client, cardId);
    return conflictResult(latest.data);
  }
  return { data: data ? mapCard(data) : null, error: isSupabaseSetupError(updateError) ? supabaseSetupError("Card could not be updated in Supabase") : updateError };
}

export async function deleteCard(cardId, expectedVersion) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data: before, error: beforeError } = await client.from("cards").select("*").eq("id", cardId).maybeSingle();
  warnSupabaseError("card lookup before delete failed", beforeError);
  if (beforeError || !before) return { data: null, error: isSupabaseSetupError(beforeError) ? supabaseSetupError("Card could not be loaded from Supabase before delete") : beforeError || new Error("Card was not found.") };
  let query = client
    .from("cards")
    .update({ status: "deleted", updated_by: (await getCurrentUser()).data?.id || null, version: (before.version || 1) + 1 })
    .eq("id", cardId);
  if (expectedVersion) query = query.eq("version", expectedVersion);
  const { data, error: deleteError } = await query
    .select("*, columns(title)")
    .maybeSingle();
  warnSupabaseError("cards delete failed", deleteError);
  if (isMissingSupabaseSchemaError(deleteError)) {
    return { data: null, error: supabaseSetupError("Card could not be deleted in Supabase") };
  }
  if (!deleteError && !data) {
    const latest = await reloadCard(client, cardId);
    return conflictResult(latest.data);
  }
  return { data: data ? mapCard(data) : mapCard(before), error: isSupabaseSetupError(deleteError) ? supabaseSetupError("Card could not be deleted from Supabase") : deleteError, restorable: true };
}

export async function moveCard(cardId, columnId, position, expectedVersion) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data: moved, error: rpcError } = await client.rpc("move_card", {
    p_card_id: cardId,
    p_target_column_id: columnId,
    p_new_position: position,
    p_expected_version: expectedVersion || null
  });
  warnSupabaseError("cards move rpc failed", rpcError);
  if (/version_conflict|version conflict|конфликт/i.test(rpcError?.message || "")) {
    const latest = await reloadCard(client, cardId);
    return conflictResult(latest.data);
  }
  if (isMissingSupabaseSchemaError(rpcError)) {
    return { data: null, error: migrationRequiredError("Card move RPC") };
  }
  if (rpcError || !moved) return { data: null, error: isSupabaseSetupError(rpcError) ? supabaseSetupError("Card could not be moved in Supabase") : rpcError || new Error("Card move returned no row.") };
  const { data, error: reloadError } = await client.from("cards").select("*, columns(title)").eq("id", cardId).maybeSingle();
  warnSupabaseError("cards move reload failed", reloadError);
  return { data: data ? mapCard(data) : mapCard(moved), error: isSupabaseSetupError(reloadError) ? supabaseSetupError("Moved card could not be reloaded from Supabase") : reloadError };
}

export async function restoreCard(cardId, expectedVersion) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data: before, error: beforeError } = await client.from("cards").select("*").eq("id", cardId).maybeSingle();
  warnSupabaseError("card lookup before restore failed", beforeError);
  if (beforeError || !before) return { data: null, error: isSupabaseSetupError(beforeError) ? supabaseSetupError("Card could not be loaded from Supabase before restore") : beforeError || new Error("Card was not found.") };
  if (expectedVersion && before.version !== expectedVersion) {
    const latest = await reloadCard(client, cardId);
    return conflictResult(latest.data);
  }
  const { data: restored, error: restoreError } = await client
    .from("cards")
    .update({ status: "active", updated_by: (await getCurrentUser()).data?.id || null, version: (before.version || 1) + 1 })
    .eq("id", cardId)
    .select("*, columns(title)")
    .maybeSingle();
  warnSupabaseError("cards restore failed", restoreError);
  if (restoreError || !restored) return { data: null, error: isSupabaseSetupError(restoreError) ? supabaseSetupError("Card could not be restored in Supabase") : restoreError || new Error("Card restore returned no row.") };
  const { data, error: reloadError } = await client.from("cards").select("*, columns(title)").eq("id", cardId).maybeSingle();
  warnSupabaseError("cards restore reload failed", reloadError);
  return { data: data ? mapCard(data) : mapCard(restored), error: isSupabaseSetupError(reloadError) ? supabaseSetupError("Restored card could not be reloaded from Supabase") : reloadError };
}

export async function persistCardMovement(movement) {
  if (!isSupabaseConfigured) return { error: new Error(missingSupabaseEnvMessage) };
  return moveCard(movement.cardId, movement.toColumnId, movement.toPosition);
}

export async function undoLastBoardAction(boardId) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data, error: rpcError } = await client.rpc("undo_last_action", { p_board_id: boardId });
  warnSupabaseError("undo_last_action rpc failed", rpcError);
  if (isMissingSupabaseSchemaError(rpcError)) return { data: null, error: migrationRequiredError("Undo RPC") };
  return {
    data,
    error: isSupabaseSetupError(rpcError) ? supabaseSetupError("Undo could not be performed in Supabase") : rpcError
  };
}
