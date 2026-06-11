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
    try {
      mode = "supabase";
      supabaseChannel = supabase
        .channel(channelName)
        .on("presence", { event: "sync" }, () => handlers.onPresenceSync?.(supabaseChannel.presenceState()))
        .on("presence", { event: "join" }, ({ key, newPresences }) => handlers.onPresenceJoin?.({ key, presences: newPresences }))
        .on("presence", { event: "leave" }, ({ key, leftPresences }) => handlers.onPresenceLeave?.({ key, presences: leftPresences }))
        .on("postgres_changes", { event: "*", schema: "public", table: "boards", filter: `id=eq.${boardId}` }, (payload) =>
          handlers.onDatabaseChange?.({ table: "boards", payload })
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "cards", filter: `board_id=eq.${boardId}` }, (payload) =>
          handlers.onDatabaseChange?.({ table: "cards", payload })
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "card_checklist_items" }, (payload) =>
          handlers.onDatabaseChange?.({ table: "card_checklist_items", payload })
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "card_comments" }, (payload) =>
          handlers.onDatabaseChange?.({ table: "card_comments", payload })
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
        .subscribe((status, error) => {
          if (error) console.warn("[Supabase] realtime subscription warning", error);
          if (status === "SUBSCRIBED" && mode === "reconnecting") handlers.onReconnect?.();
          if (status === "SUBSCRIBED") mode = "supabase";
          if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) mode = "reconnecting";
          handlers.onStatus?.(status);
        });
    } catch (error) {
      console.warn("[Supabase] realtime subscription unavailable; falling back to local tab sync.", error);
      mode = "broadcast";
      supabaseChannel = null;
      handlers.onStatus?.("CHANNEL_ERROR");
    }
  }

  return {
    mode,
    track(presence) {
      return supabaseChannel?.track({
        ...presence,
        tabId,
        online_at: new Date().toISOString()
      });
    },
    untrack() {
      return supabaseChannel?.untrack();
    },
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
