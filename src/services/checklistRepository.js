import {
  isMissingSupabaseSchemaError,
  isSupabaseSetupError,
  missingSupabaseEnvMessage,
  supabase,
  supabaseSetupError,
  warnSupabaseError
} from "./supabaseClient";
import { getCurrentUser } from "./supabaseClient";
import { createActivityLog } from "./activityRepository";
import { isOptionalTableAvailable, markOptionalTableAvailable, markOptionalTableMissing, optionalMigrationError } from "./optionalTables";

const CHECKLIST_TABLE = "card_checklist_items";

function requireClient() {
  if (!supabase) return { error: new Error(missingSupabaseEnvMessage) };
  return { client: supabase };
}

function mapChecklistItem(row) {
  return {
    id: row.id,
    cardId: row.card_id,
    title: row.title,
    isDone: Boolean(row.is_done),
    position: row.position ?? 0,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listChecklistItemsForBoard(boardId) {
  const { client, error } = requireClient();
  if (error) return { data: [], error };
  if (!isOptionalTableAvailable(CHECKLIST_TABLE)) return { data: [], error: null };
  const { data, error: selectError } = await client
    .from(CHECKLIST_TABLE)
    .select("*, cards!inner(board_id)")
    .eq("cards.board_id", boardId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  warnSupabaseError("card checklist select failed", selectError);
  if (isMissingSupabaseSchemaError(selectError)) {
    markOptionalTableMissing(CHECKLIST_TABLE);
    console.warn("[Supabase] Optional table card_checklist_items is unavailable; continuing without card checklist items.");
    return { data: [], error: null };
  }
  if (!selectError) markOptionalTableAvailable(CHECKLIST_TABLE);
  return {
    data: (data || []).map(mapChecklistItem),
    error: isSupabaseSetupError(selectError) ? supabaseSetupError("Checklist items could not be loaded from Supabase") : selectError
  };
}

export async function insertChecklistItems(cardId, titles) {
  const { client, error } = requireClient();
  if (error) return { data: [], skipped: [], error };
  const cleanTitles = titles.map((title) => String(title).trim()).filter(Boolean);
  if (!cardId || !cleanTitles.length) return { data: [], skipped: [], error: null };
  if (!isOptionalTableAvailable(CHECKLIST_TABLE)) return { data: [], skipped: cleanTitles, error: optionalMigrationError() };

  const existingResult = await client.from(CHECKLIST_TABLE).select("title, position").eq("card_id", cardId);
  warnSupabaseError("card checklist existing lookup failed", existingResult.error);
  if (isMissingSupabaseSchemaError(existingResult.error)) {
    markOptionalTableMissing(CHECKLIST_TABLE);
    return { data: [], skipped: cleanTitles, error: optionalMigrationError() };
  }
  if (existingResult.error) {
    return {
      data: [],
      skipped: [],
      error: isSupabaseSetupError(existingResult.error) ? supabaseSetupError("Checklist items could not be checked before insert") : existingResult.error
    };
  }

  const existingTitles = new Set((existingResult.data || []).map((item) => item.title.trim().toLowerCase()));
  const uniqueTitles = [];
  const skipped = [];
  for (const title of cleanTitles) {
    const key = title.toLowerCase();
    if (existingTitles.has(key)) {
      skipped.push(title);
      continue;
    }
    existingTitles.add(key);
    uniqueTitles.push(title);
  }

  if (!uniqueTitles.length) return { data: [], skipped, error: null };

  const maxPosition = (existingResult.data || []).reduce((max, item) => Math.max(max, item.position ?? 0), -1);
  const { data: user } = await getCurrentUser();
  const rows = uniqueTitles.map((title, index) => ({
    card_id: cardId,
    title,
    is_done: false,
    position: maxPosition + index + 1,
    created_by: user?.id || null
  }));

  markOptionalTableAvailable(CHECKLIST_TABLE);

  const { data, error: insertError } = await client.from(CHECKLIST_TABLE).insert(rows).select("*");
  warnSupabaseError("card checklist insert failed", insertError);
  if (isMissingSupabaseSchemaError(insertError)) {
    markOptionalTableMissing(CHECKLIST_TABLE);
    return { data: [], skipped, error: optionalMigrationError() };
  }
  if (!insertError) markOptionalTableAvailable(CHECKLIST_TABLE);
  if (!insertError && data?.length) {
    const card = await client.from("cards").select("board_id, title").eq("id", cardId).maybeSingle();
    if (card.data?.board_id) {
      await createActivityLog(card.data.board_id, "checklist_saved", "card_checklist_items", cardId, null, {
        card_id: cardId,
        card_title: card.data.title,
        items: data
      });
    }
  }
  return {
    data: (data || []).map(mapChecklistItem),
    skipped,
    error: isSupabaseSetupError(insertError) ? supabaseSetupError("Checklist items could not be saved in Supabase") : insertError
  };
}

export async function updateChecklistItem(itemId, patch) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  if (!isOptionalTableAvailable(CHECKLIST_TABLE)) return { data: null, error: optionalMigrationError() };
  const payload = {};
  if ("isDone" in patch) payload.is_done = patch.isDone;
  if ("title" in patch) payload.title = patch.title;
  if ("position" in patch) payload.position = patch.position;

  const { data: before } = await client.from(CHECKLIST_TABLE).select("*, cards(board_id, title)").eq("id", itemId).maybeSingle();
  const { data, error: updateError } = await client.from(CHECKLIST_TABLE).update(payload).eq("id", itemId).select("*, cards(board_id, title)").maybeSingle();
  warnSupabaseError("card checklist update failed", updateError);
  if (isMissingSupabaseSchemaError(updateError)) {
    markOptionalTableMissing(CHECKLIST_TABLE);
    return { data: null, error: optionalMigrationError() };
  }
  if (!updateError) markOptionalTableAvailable(CHECKLIST_TABLE);
  if (!updateError && data?.cards?.board_id) {
    await createActivityLog(data.cards.board_id, "checklist_toggled", "card_checklist_item", itemId, before, data);
  }
  return {
    data: data ? mapChecklistItem(data) : null,
    error: isSupabaseSetupError(updateError) ? supabaseSetupError("Checklist item could not be updated in Supabase") : updateError
  };
}
