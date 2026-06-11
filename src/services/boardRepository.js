import { getCurrentProfile, getCurrentUser, isMissingSupabaseSchemaError, isSupabaseSetupError, missingSupabaseEnvMessage, supabase, supabaseSetupError, warnSupabaseError } from "./supabaseClient";

const DEFAULT_COLUMNS = ["Todo", "In Progress", "Review", "Done"];

function requireClient() {
  if (!supabase) return { error: new Error(missingSupabaseEnvMessage) };
  return { client: supabase };
}

function boardsRlsError() {
  return supabaseSetupError("Boards could not be loaded from Supabase");
}

function mapBoard(row) {
  return {
    id: row.id,
    name: row.title,
    title: row.title,
    summary: row.description || "",
    description: row.description || "",
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cards: row.cards?.[0]?.count ?? row.cards_count ?? 0,
    members: row.board_members?.[0]?.count ?? row.members_count ?? 0,
    activity: row.activity_logs?.[0]?.count ?? row.activity_count ?? 0,
    columns: row.columns?.[0]?.count ?? row.columns_count ?? 0,
    updated: row.updated_at ? new Date(row.updated_at).toLocaleString() : "No activity yet"
  };
}

function mapColumn(row) {
  return {
    id: row.id,
    boardId: row.board_id,
    name: row.title,
    title: row.title,
    position: row.position ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
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
    aiPriority: row.ai_priority ?? null,
    aiPriorityReason: row.ai_priority_reason || "",
    history: [],
    updatedAt: row.updated_at ? new Date(row.updated_at).toLocaleString() : "",
    version: row.version || 1,
    createdAt: row.created_at,
    deletedAt: row.status === "deleted" ? row.updated_at : null
  };
}

export async function listBoardsForCurrentUser() {
  const { client, error } = requireClient();
  if (error) return { data: [], error };
  const { data: user, error: userError } = await getCurrentUser();
  if (userError || !user) return { data: [], error: userError || new Error("No authenticated Supabase user.") };

  const { data, error: queryError } = await client
    .from("boards")
    .select("*, board_members!inner(role), cards(count), columns(count), activity_logs(count)")
    .eq("board_members.user_id", user.id)
    .order("updated_at", { ascending: false });
  warnSupabaseError("boards list failed", queryError);
  if (isMissingSupabaseSchemaError(queryError)) {
    console.warn("[Supabase] board aggregate relations are unavailable; loading boards with legacy membership query.");
    const memberships = await client.from("board_members").select("board_id, role").eq("user_id", user.id);
    warnSupabaseError("legacy board memberships list failed", memberships.error);
    if (memberships.error) return { data: [], error: isSupabaseSetupError(memberships.error) ? boardsRlsError() : memberships.error };
    const boardIds = (memberships.data || []).map((row) => row.board_id).filter(Boolean);
    if (!boardIds.length) return { data: [], error: null };
    const boards = await client.from("boards").select("*").in("id", boardIds).order("updated_at", { ascending: false });
    warnSupabaseError("legacy boards list failed", boards.error);
    return { data: (boards.data || []).map(mapBoard), error: isSupabaseSetupError(boards.error) ? boardsRlsError() : boards.error };
  }

  return { data: (data || []).map(mapBoard), error: isSupabaseSetupError(queryError) ? boardsRlsError() : queryError };
}

export async function createBoard(title, description = "") {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data: board, error: boardError } = await client.rpc("create_board", {
    p_title: title,
    p_description: description || null
  });
  warnSupabaseError("create_board rpc failed", boardError);
  if (boardError) return { data: null, error: isSupabaseSetupError(boardError) ? supabaseSetupError("Board could not be created in Supabase") : boardError };

  return { data: mapBoard(board), error: null };
}

export async function getBoard(boardId) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data, error: queryError } = await client.from("boards").select("*").eq("id", boardId).maybeSingle();
  warnSupabaseError("board lookup failed", queryError);
  return { data: data ? mapBoard(data) : null, error: isSupabaseSetupError(queryError) ? supabaseSetupError("Board could not be loaded from Supabase") : queryError };
}

export async function getBoardColumns(boardId) {
  const { client, error } = requireClient();
  if (error) return { data: [], error };
  const { data, error: queryError } = await client.from("columns").select("*").eq("board_id", boardId).order("position", { ascending: true });
  warnSupabaseError("columns list failed", queryError);
  return { data: (data || []).map(mapColumn), error: isSupabaseSetupError(queryError) ? supabaseSetupError("Columns could not be loaded from Supabase") : queryError };
}

export async function getBoardCards(boardId) {
  const { client, error } = requireClient();
  if (error) return { data: [], error };
  const { data, error: queryError } = await client
    .from("cards")
    .select("*")
    .eq("board_id", boardId)
    .eq("status", "active")
    .order("position", { ascending: true });
  warnSupabaseError("cards list failed", queryError);
  if (isMissingSupabaseSchemaError(queryError)) {
    return { data: [], error: supabaseSetupError("Cards could not be loaded from Supabase") };
  }
  return { data: (data || []).map(mapCard), error: isSupabaseSetupError(queryError) ? supabaseSetupError("Cards could not be loaded from Supabase") : queryError };
}

export async function createDefaultColumns(boardId) {
  const { client, error } = requireClient();
  if (error) return { data: [], error };
  const { data: existing, error: existingError } = await client.from("columns").select("*").eq("board_id", boardId);
  warnSupabaseError("default columns lookup failed", existingError);
  if (existingError) return { data: [], error: isSupabaseSetupError(existingError) ? supabaseSetupError("Default columns could not be checked in Supabase") : existingError };

  const existingTitles = new Set((existing || []).map((column) => column.title));
  const rows = DEFAULT_COLUMNS.map((title, position) => ({ board_id: boardId, title, position })).filter((column) => !existingTitles.has(column.title));
  if (rows.length) {
    const { error: upsertError } = await client.from("columns").upsert(rows, { onConflict: "board_id,title" });
    warnSupabaseError("default columns upsert failed", upsertError);
    if (upsertError) return { data: [], error: isSupabaseSetupError(upsertError) ? supabaseSetupError("Default columns could not be created in Supabase") : upsertError };
    await createActivityLog(boardId, "default_columns_created", "columns", boardId, null, { titles: rows.map((row) => row.title) });
  }

  const { data, error: queryError } = await client.from("columns").select("*").eq("board_id", boardId).order("position", { ascending: true });
  warnSupabaseError("default columns reload failed", queryError);
  return { data: (data || []).map(mapColumn), error: isSupabaseSetupError(queryError) ? supabaseSetupError("Default columns could not be reloaded from Supabase") : queryError };
}

export async function deleteBoard(boardId) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data, error: deleteError } = await client.from("boards").delete().eq("id", boardId).select("id, title").maybeSingle();
  warnSupabaseError("board delete failed", deleteError);
  return {
    data: data ? { id: data.id, title: data.title } : null,
    error: isSupabaseSetupError(deleteError) ? supabaseSetupError("Board could not be deleted in Supabase") : deleteError
  };
}

export async function transferBoardOwnership(boardId, newOwnerId) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data: currentUser, error: userError } = await getCurrentUser();
  if (userError || !currentUser) return { data: null, error: userError || new Error("No authenticated Supabase user.") };
  if (!boardId || !newOwnerId) return { data: null, error: new Error("Board and target member are required.") };
  if (currentUser.id === newOwnerId) return { data: null, error: new Error("Choose another member as the new owner.") };

  const { data: memberRow, error: memberLookupError } = await client
    .from("board_members")
    .select("role")
    .eq("board_id", boardId)
    .eq("user_id", newOwnerId)
    .maybeSingle();
  warnSupabaseError("board ownership transfer member lookup failed", memberLookupError);
  if (memberLookupError) return { data: null, error: isSupabaseSetupError(memberLookupError) ? supabaseSetupError("Board ownership could not be transferred in Supabase") : memberLookupError };
  if (!memberRow) return { data: null, error: new Error("The selected member is not part of this board.") };

  const previousOwnerRole = memberRow.role || "viewer";

  const targetRoleUpdate = await client.from("board_members").update({ role: "owner" }).eq("board_id", boardId).eq("user_id", newOwnerId).select("board_id, user_id, role").maybeSingle();
  warnSupabaseError("board ownership transfer target update failed", targetRoleUpdate.error);
  if (targetRoleUpdate.error) {
    return {
      data: null,
      error: isSupabaseSetupError(targetRoleUpdate.error) ? supabaseSetupError("Board ownership could not be transferred in Supabase") : targetRoleUpdate.error
    };
  }

  const boardOwnerUpdate = await client.from("boards").update({ owner_id: newOwnerId }).eq("id", boardId).select("id, title, owner_id").maybeSingle();
  warnSupabaseError("board ownership transfer board update failed", boardOwnerUpdate.error);
  if (boardOwnerUpdate.error) {
    await client.from("board_members").update({ role: previousOwnerRole }).eq("board_id", boardId).eq("user_id", newOwnerId);
    return {
      data: null,
      error: isSupabaseSetupError(boardOwnerUpdate.error) ? supabaseSetupError("Board ownership could not be transferred in Supabase") : boardOwnerUpdate.error
    };
  }

  const currentOwnerRoleUpdate = await client.from("board_members").update({ role: "editor" }).eq("board_id", boardId).eq("user_id", currentUser.id).select("board_id, user_id, role").maybeSingle();
  warnSupabaseError("board ownership transfer current owner update failed", currentOwnerRoleUpdate.error);
  if (currentOwnerRoleUpdate.error) {
    await client.from("boards").update({ owner_id: currentUser.id }).eq("id", boardId);
    await client.from("board_members").update({ role: previousOwnerRole }).eq("board_id", boardId).eq("user_id", newOwnerId);
    return {
      data: null,
      error: isSupabaseSetupError(currentOwnerRoleUpdate.error) ? supabaseSetupError("Board ownership could not be transferred in Supabase") : currentOwnerRoleUpdate.error
    };
  }

  return {
    data: { boardId, ownerId: newOwnerId, previousOwnerId: currentUser.id },
    error: null
  };
}

export { getCurrentProfile, getCurrentUser };
