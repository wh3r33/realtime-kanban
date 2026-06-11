import { getCurrentProfile, getCurrentUser, isSupabaseSetupError, missingSupabaseEnvMessage, supabase, supabaseSetupError, warnSupabaseError } from "./supabaseClient";
import { createActivityLog } from "./activityRepository";

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
    history: [],
    updatedAt: row.updated_at ? new Date(row.updated_at).toLocaleString() : "",
    version: row.version || 1,
    createdAt: row.created_at,
    deletedAt: row.deleted_at || null
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

  return { data: (data || []).map(mapBoard), error: isSupabaseSetupError(queryError) ? boardsRlsError() : queryError };
}

export async function createBoard(title, description = "") {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data: user, error: userError } = await getCurrentUser();
  if (userError || !user) return { data: null, error: userError || new Error("No authenticated Supabase user.") };

  const { data: board, error: boardError } = await client
    .from("boards")
    .insert({ title, description, owner_id: user.id })
    .select()
    .single();
  warnSupabaseError("boards insert failed", boardError);
  if (boardError) return { data: null, error: isSupabaseSetupError(boardError) ? supabaseSetupError("Board could not be created in Supabase") : boardError };

  const { error: memberError } = await client
    .from("board_members")
    .upsert(
      {
        board_id: board.id,
        user_id: user.id,
        role: "owner"
      },
      {
        onConflict: "board_id,user_id"
      }
    );
  warnSupabaseError("board_members owner insert failed", memberError);
  if (memberError) {
    return {
      data: null,
      error: isSupabaseSetupError(memberError)
        ? supabaseSetupError("Board was created, but owner membership could not be created in Supabase")
        : new Error(`Board was created, but owner membership could not be created. ${memberError.message}`)
    };
  }

  const columnsResult = await createDefaultColumns(board.id);
  if (columnsResult.error) return { data: null, error: columnsResult.error };
  await createActivityLog(board.id, "board_created", "board", board.id, null, { title, description });

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
    .select("*, columns(title)")
    .eq("board_id", boardId)
    .is("deleted_at", null)
    .order("position", { ascending: true });
  warnSupabaseError("cards list failed", queryError);
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

export { getCurrentProfile, getCurrentUser };
