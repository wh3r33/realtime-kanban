import { createActivityLog } from "./activityRepository";
import { getCurrentUser, isMissingSupabaseSchemaError, isSupabaseSetupError, missingSupabaseEnvMessage, supabase, supabaseSetupError, warnSupabaseError } from "./supabaseClient";
import { isOptionalTableAvailable, markOptionalTableAvailable, markOptionalTableMissing, optionalMigrationError } from "./optionalTables";

const COMMENTS_TABLE = "card_comments";

function requireClient() {
  if (!supabase) return { error: new Error(missingSupabaseEnvMessage) };
  return { client: supabase };
}

function mapComment(row) {
  const user = row.profiles || {};
  return {
    id: row.id,
    cardId: row.card_id,
    authorId: row.user_id,
    authorName: user.name || user.email || "User",
    body: row.body,
    createdAt: row.created_at ? new Date(row.created_at).toLocaleString() : "",
    updatedAt: row.updated_at ? new Date(row.updated_at).toLocaleString() : ""
  };
}

export async function listCommentsForBoard(boardId) {
  const { client, error } = requireClient();
  if (error) return { data: [], error };
  if (!isOptionalTableAvailable(COMMENTS_TABLE)) return { data: [], error: null };
  const { data, error: selectError } = await client
    .from(COMMENTS_TABLE)
    .select("*, cards!inner(board_id), profiles:profiles!card_comments_user_id_fkey(id, email, name)")
    .eq("cards.board_id", boardId)
    .order("created_at", { ascending: true });
  warnSupabaseError("card comments list failed", selectError);
  if (isMissingSupabaseSchemaError(selectError)) {
    markOptionalTableMissing(COMMENTS_TABLE);
    console.warn("[Supabase] Optional table card_comments is unavailable; continuing without card comments.");
    return { data: [], error: null };
  }
  if (!selectError) markOptionalTableAvailable(COMMENTS_TABLE);
  return {
    data: (data || []).map(mapComment),
    error: isSupabaseSetupError(selectError) ? supabaseSetupError("Комментарии не загружены из Supabase") : selectError
  };
}

export async function createComment(cardId, body) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  if (!isOptionalTableAvailable(COMMENTS_TABLE)) return { data: null, error: optionalMigrationError() };
  const { data: user, error: userError } = await getCurrentUser();
  if (userError || !user) return { data: null, error: userError || new Error("No authenticated Supabase user.") };

  const { data, error: insertError } = await client
    .from(COMMENTS_TABLE)
    .insert({ card_id: cardId, body: body.trim(), user_id: user.id })
    .select("*, cards(board_id, title), profiles:profiles!card_comments_user_id_fkey(id, email, name)")
    .single();
  warnSupabaseError("card comment insert failed", insertError);
  if (isMissingSupabaseSchemaError(insertError)) {
    markOptionalTableMissing(COMMENTS_TABLE);
    return { data: null, error: optionalMigrationError() };
  }
  if (!insertError) markOptionalTableAvailable(COMMENTS_TABLE);
  if (!insertError && data?.cards?.board_id) {
    await createActivityLog(data.cards.board_id, "comment_created", "card_comment", data.id, null, data);
  }
  return {
    data: data ? mapComment(data) : null,
    error: isSupabaseSetupError(insertError) ? supabaseSetupError("Комментарий не сохранён в Supabase") : insertError
  };
}

export async function updateComment(commentId, body) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  if (!isOptionalTableAvailable(COMMENTS_TABLE)) return { data: null, error: optionalMigrationError() };
  const { data: before } = await client.from(COMMENTS_TABLE).select("*, cards(board_id, title)").eq("id", commentId).maybeSingle();
  const { data, error: updateError } = await client
    .from(COMMENTS_TABLE)
    .update({ body: body.trim() })
    .eq("id", commentId)
    .select("*, cards(board_id, title), profiles:profiles!card_comments_user_id_fkey(id, email, name)")
    .maybeSingle();
  warnSupabaseError("card comment update failed", updateError);
  if (isMissingSupabaseSchemaError(updateError)) {
    markOptionalTableMissing(COMMENTS_TABLE);
    return { data: null, error: optionalMigrationError() };
  }
  if (!updateError) markOptionalTableAvailable(COMMENTS_TABLE);
  if (!updateError && data?.cards?.board_id) {
    await createActivityLog(data.cards.board_id, "comment_updated", "card_comment", data.id, before, data);
  }
  return {
    data: data ? mapComment(data) : null,
    error: isSupabaseSetupError(updateError) ? supabaseSetupError("Комментарий не обновлён в Supabase") : updateError
  };
}

export async function deleteComment(commentId) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  if (!isOptionalTableAvailable(COMMENTS_TABLE)) return { data: null, error: optionalMigrationError() };
  const { data: before } = await client.from(COMMENTS_TABLE).select("*, cards(board_id, title)").eq("id", commentId).maybeSingle();
  const { data, error: deleteError } = await client.from(COMMENTS_TABLE).delete().eq("id", commentId).select("*").maybeSingle();
  warnSupabaseError("card comment delete failed", deleteError);
  if (isMissingSupabaseSchemaError(deleteError)) {
    markOptionalTableMissing(COMMENTS_TABLE);
    return { data: null, error: optionalMigrationError() };
  }
  if (!deleteError) markOptionalTableAvailable(COMMENTS_TABLE);
  if (!deleteError && before?.cards?.board_id) {
    await createActivityLog(before.cards.board_id, "comment_deleted", "card_comment", commentId, before, null);
  }
  return {
    data: data ? mapComment(data) : before ? mapComment(before) : null,
    error: isSupabaseSetupError(deleteError) ? supabaseSetupError("Комментарий не удалён из Supabase") : deleteError
  };
}
