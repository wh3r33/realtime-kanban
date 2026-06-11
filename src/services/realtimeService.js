import { isSupabaseConfigured, supabase } from "./supabaseClient";

const CHANNEL_PREFIX = "realtime-kanban";
const tabId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `tab-${Date.now()}`;

function normalizeEvent(event) {
  return {
    ...event,
    id: event.id || `event-${Date.now()}`,
    sourceId: event.sourceId || tabId,
    createdAt: event.createdAt || new Date().toISOString()
  };
}

export function subscribeToBoard(boardId, handlers = {}) {
  const channelName = `${CHANNEL_PREFIX}:${boardId}`;
  let broadcastChannel = null;
  let supabaseChannel = null;
  let mode = "broadcast";

  if (typeof BroadcastChannel !== "undefined") {
    broadcastChannel = new BroadcastChannel(channelName);
    broadcastChannel.onmessage = ({ data }) => {
      if (!data || data.sourceId === tabId) return;
      handlers.onEvent?.(data);
    };
  }

  if (isSupabaseConfigured && supabase) {
    mode = "supabase";
    supabaseChannel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "cards", filter: `board_id=eq.${boardId}` }, (payload) =>
        handlers.onDatabaseChange?.({ table: "cards", payload })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "columns", filter: `board_id=eq.${boardId}` }, (payload) =>
        handlers.onDatabaseChange?.({ table: "columns", payload })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs", filter: `board_id=eq.${boardId}` }, (payload) =>
        handlers.onDatabaseChange?.({ table: "activity_logs", payload })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "board_members", filter: `board_id=eq.${boardId}` }, (payload) =>
        handlers.onDatabaseChange?.({ table: "board_members", payload })
      )
      .subscribe();
  }

  return {
    mode,
    publish(event) {
      const payload = normalizeEvent(event);
      broadcastChannel?.postMessage(payload);
      return payload;
    },
    unsubscribe() {
      broadcastChannel?.close();
      if (supabaseChannel && supabase) supabase.removeChannel(supabaseChannel);
    }
  };
}
