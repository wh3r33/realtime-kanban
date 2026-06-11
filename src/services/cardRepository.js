import { isSupabaseConfigured, supabase } from "./supabaseClient";

const MOVEMENT_STORAGE_KEY = "realtime-kanban:card-movements";

function readLocalMovements() {
  try {
    return JSON.parse(window.localStorage.getItem(MOVEMENT_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export async function persistCardMovement(movement) {
  if (isSupabaseConfigured && supabase) {
    return supabase.from("card_movements").insert({
      card_id: movement.cardId,
      board_id: movement.boardId,
      from_column: movement.fromColumn,
      to_column: movement.toColumn,
      from_position: movement.fromPosition,
      to_position: movement.toPosition,
      actor_id: movement.actorId,
      created_at: movement.createdAt
    });
  }

  if (typeof window === "undefined") return { error: null };
  const movements = readLocalMovements();
  movements.unshift(movement);
  window.localStorage.setItem(MOVEMENT_STORAGE_KEY, JSON.stringify(movements.slice(0, 50)));
  return { error: null };
}
