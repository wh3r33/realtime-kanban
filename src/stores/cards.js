import { defineStore } from "pinia";
import {
  createCard as insertCard,
  deleteCard as removeCardRow,
  moveCard as moveCardRow,
  restoreCard as restoreCardRow,
  updateCard as updateCardRow
} from "../services/cardRepository";
import { subscribeToBoard } from "../services/realtimeService";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { useAuthStore } from "./auth";
import { useBoardsStore } from "./boards";
import { useMembersStore } from "./members";
import { useUiStore } from "./ui";

const clone = (value) => JSON.parse(JSON.stringify(value));
const sortCards = (items) => [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.title.localeCompare(b.title));
const canMutate = () => useAuthStore().canMutateCards;

function mapCardRow(row) {
  const boardsStore = useBoardsStore();
  const column = boardsStore.columnById(row.column_id);
  return {
    id: row.id,
    boardId: row.board_id,
    columnId: row.column_id,
    column: column?.title || row.columns?.title || row.column_id,
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

function createHistoryAction(type, before, after) {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    before: before ? clone(before) : null,
    after: after ? clone(after) : null,
    cardId: after?.id || before?.id,
    title: after?.title || before?.title || "Card"
  };
}

export const useCardsStore = defineStore("cards", {
  state: () => ({
    cards: [],
    comments: [],
    selectedCardId: null,
    undoHistory: [],
    redoHistory: [],
    movementError: null,
      conflict: null,
      seenRealtimeEvents: [],
      loading: false,
    errorMessage: "",
    realtime: {
      boardId: null,
      mode: "none",
      unsubscribe: null,
      lastEvent: null
    }
  }),
  getters: {
    selectedCard: (state) => state.cards.find((card) => card.id === state.selectedCardId),
    cardById: (state) => (cardId) => state.cards.find((card) => card.id === cardId),
    commentsFor: (state) => () => [],
    cardsForColumn: (state) => (boardId, columnId) => sortCards(state.cards.filter((card) => card.boardId === boardId && card.columnId === columnId))
  },
  actions: {
    async loadCards(boardId) {
      if (!isSupabaseConfigured || !boardId) {
        this.cards = [];
        return;
      }
      this.loading = true;
      const boardsStore = useBoardsStore();
      const { data, error } = await boardsStore.loadBoardCards(boardId);
      this.cards = data || [];
      this.errorMessage = error?.message || "";
      this.loading = false;
    },
    initializeRealtime(boardId) {
      if (!boardId) return;
      if (this.realtime.boardId === boardId && this.realtime.unsubscribe) return;
      this.realtime.unsubscribe?.();
      let subscription = null;
      subscription = subscribeToBoard(boardId, {
        onEvent: (event) => this.applyRemoteEvent(event),
        onDatabaseChange: (event) => {
          this.realtime.lastEvent = event;
          const boardsStore = useBoardsStore();
          const uiStore = useUiStore();
          if (this.hasSeenRealtimePayload(event)) return;
          if (event.table === "boards") boardsStore.applyBoardChange(event.payload);
          if (event.table === "cards") this.applyCardChange(event.payload);
          if (event.table === "columns") boardsStore.applyColumnChange(event.payload);
          if (event.table === "activity_logs") uiStore.applyActivityChange(event.payload);
          if (event.table === "board_members") useMembersStore().applyMemberChange(event.payload);
        },
        onPresenceSync: (state) => useMembersStore().applyPresenceState(state),
        onStatus: (status) => {
          if (status === "SUBSCRIBED") {
            useUiStore().setSyncState("synced", "Realtime subscription active");
            const authStore = useAuthStore();
            subscription?.track?.({
              userId: authStore.currentUserId,
              name: authStore.currentUserName,
              boardId,
              timestamp: new Date().toISOString()
            });
          } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
            useUiStore().setSyncState("partial", `Realtime ${status.toLowerCase().replace(/_/g, " ")}`);
            useMembersStore().setPresenceDisconnected();
          }
        }
      });
      this.realtime = {
        boardId,
        mode: subscription.mode,
        unsubscribe: subscription.unsubscribe,
        publish: subscription.publish,
        track: subscription.track,
        untrack: subscription.untrack,
        lastEvent: null
      };
      useUiStore().setSyncState(subscription.mode === "supabase" ? "synced" : "partial", subscription.mode === "supabase" ? "Realtime subscription active" : "Local tab sync only");
    },
    hasSeenRealtimePayload(event) {
      const payload = event.payload || {};
      const row = payload.new?.id || payload.old?.id || "row";
      const stamp = payload.new?.updated_at || payload.new?.created_at || payload.old?.updated_at || payload.commit_timestamp || Date.now();
      const key = `${event.table}:${payload.eventType}:${row}:${stamp}`;
      if (this.seenRealtimeEvents.includes(key)) return true;
      this.seenRealtimeEvents = [key, ...this.seenRealtimeEvents].slice(0, 120);
      return false;
    },
    publish(event) {
      this.realtime.publish?.(event);
    },
    trackPresence(patch = {}) {
      const authStore = useAuthStore();
      if (!this.realtime.track || !authStore.currentUserId) return;
      this.realtime.track({
        userId: authStore.currentUserId,
        name: authStore.currentUserName,
        boardId: this.realtime.boardId,
        timestamp: new Date().toISOString(),
        ...patch
      });
    },
    applyRemoteEvent(event) {
      this.realtime.lastEvent = event;
      if (event.type === "card:created" || event.type === "card:updated") this.upsertCard(event.card, { remote: true });
      if (event.type === "card:deleted") this.removeCard(event.cardId, { remote: true });
    },
    selectCard(cardId) {
      this.selectedCardId = cardId;
    },
    closeCard() {
      this.selectedCardId = null;
      this.conflict = null;
    },
    assertCanMutate() {
      return canMutate();
    },
    pushHistory(action) {
      this.undoHistory.push(action);
      this.redoHistory = [];
    },
    upsertCard(card, options = {}) {
      const nextCard = clone(card);
      const index = this.cards.findIndex((item) => item.id === nextCard.id);
      if (index >= 0) this.cards[index] = nextCard;
      else this.cards.push(nextCard);
      if (!options.remote) this.publish({ type: index >= 0 ? "card:updated" : "card:created", card: nextCard });
      return nextCard;
    },
    removeCard(cardId, options = {}) {
      const existing = this.cardById(cardId);
      if (!existing) return null;
      this.cards = this.cards.filter((card) => card.id !== cardId);
      if (this.selectedCardId === cardId) this.closeCard();
      if (!options.remote) this.publish({ type: "card:deleted", cardId });
      return existing;
    },
    applyCardChange(payload) {
      if (payload.eventType === "DELETE" || payload.new?.deleted_at) {
        this.removeCard(payload.old?.id || payload.new?.id, { remote: true });
        return;
      }
      this.upsertCard(mapCardRow(payload.new), { remote: true });
    },
    async createCard(payload) {
      if (!this.assertCanMutate()) return { error: "viewer" };
      const columnId = payload.columnId;
      if (!columnId) return { error: "missing-column" };
      const columnCards = this.cardsForColumn(payload.boardId, columnId);
      const { data, error } = await insertCard(payload.boardId, columnId, {
        title: payload.title.trim(),
        description: payload.description.trim(),
        assigneeId: payload.assigneeId,
        position: columnCards.length
      });
      this.errorMessage = error?.message || "";
      if (error) return { error };
      this.upsertCard(data);
      if (!payload.skipHistory) this.pushHistory(createHistoryAction("create", null, data));
      await useUiStore().loadActivity(payload.boardId);
      return { card: data };
    },
    async updateCard(cardId, patch, options = {}) {
      if (!this.assertCanMutate()) return { error: "viewer" };
      const existing = this.cardById(cardId);
      if (!existing) return { error: "missing" };
      if (options.expectedVersion && existing.version !== options.expectedVersion) {
        this.conflict = {
          cardId,
          mine: { ...clone(existing), ...clone(patch), version: options.expectedVersion },
          latest: clone(existing)
        };
        return { error: "conflict", conflict: this.conflict };
      }
      const before = clone(existing);
      const { data, error } = await updateCardRow(cardId, {
        title: patch.title?.trim() || existing.title,
        description: patch.description?.trim() ?? existing.description,
        assigneeId: patch.assigneeId,
        status: patch.status || existing.status,
        labels: patch.labels || existing.labels
      });
      this.errorMessage = error?.message || "";
      if (error) return { error };
      this.upsertCard(data);
      if (!options.skipHistory) this.pushHistory(createHistoryAction("edit", before, data));
      await useUiStore().loadActivity(data.boardId);
      return { card: data };
    },
    async deleteCard(cardId, options = {}) {
      if (!this.assertCanMutate()) return { error: "viewer" };
      const before = this.cardById(cardId);
      const { data, error } = await removeCardRow(cardId);
      this.errorMessage = error?.message || "";
      if (error) return { error };
      this.removeCard(cardId);
      if (!options.skipHistory) this.pushHistory(createHistoryAction("delete", before, data));
      await useUiStore().loadActivity(data.boardId);
      return { card: data };
    },
    simulateRemoteEdit() {
      return null;
    },
    keepMineConflict() {
      this.conflict = null;
      return null;
    },
    acceptLatestConflict() {
      this.conflict = null;
      return this.selectedCard;
    },
    addComment() {
      return { error: "not-implemented" };
    },
    updateComment() {
      return { error: "not-implemented" };
    },
    deleteComment() {
      return { error: "not-implemented" };
    },
    async moveTask(cardId, targetColumnId, toIndex = Number.POSITIVE_INFINITY) {
      if (!this.assertCanMutate()) return { error: "viewer" };
      const task = this.cardById(cardId);
      if (!task) return null;
      const before = clone(task);
      const fromColumnId = task.columnId;
      const fromPosition = task.position ?? 0;
      const targetCards = this.cardsForColumn(task.boardId, targetColumnId).filter((card) => card.id !== cardId);
      const nextIndex = Math.max(0, Math.min(toIndex, targetCards.length));
      if (fromColumnId === targetColumnId && fromPosition === nextIndex) return null;
      const { data, error } = await moveCardRow(cardId, targetColumnId, nextIndex);
      this.movementError = error?.message || null;
      if (error) return { error };
      this.upsertCard(data);
      this.pushHistory(createHistoryAction("move", before, data));
      await useUiStore().loadActivity(task.boardId);
      this.publish({ type: "card:updated", card: data });
      return {
        cardId,
        boardId: task.boardId,
        from: before.column,
        to: data.column,
        fromPosition,
        toPosition: nextIndex,
        title: task.title
      };
    },
    async undoLastAction() {
      if (!this.assertCanMutate()) return { error: "viewer" };
      const action = this.undoHistory[this.undoHistory.length - 1];
      if (!action) return null;
      const result = await this.applyHistoryAction(action, "undo");
      if (result?.error) return result;
      this.undoHistory.pop();
      this.redoHistory.push(action);
      return action;
    },
    async redoLastAction() {
      if (!this.assertCanMutate()) return { error: "viewer" };
      const action = this.redoHistory[this.redoHistory.length - 1];
      if (!action) return null;
      const result = await this.applyHistoryAction(action, "redo");
      if (result?.error) return result;
      this.redoHistory.pop();
      this.undoHistory.push(action);
      return action;
    },
    async applyHistoryAction(action, direction) {
      const isUndo = direction === "undo";
      if (action.type === "create") {
        const result = isUndo ? await this.deleteCard(action.cardId, { skipHistory: true }) : await this.restoreCard(action.cardId, { skipHistory: true });
        return result?.error ? result : { ok: true };
      }
      if (action.type === "delete") {
        const result = isUndo ? await this.restoreCard(action.cardId, { skipHistory: true }) : await this.deleteCard(action.cardId, { skipHistory: true });
        return result?.error ? result : { ok: true };
      }
      if (action.type === "edit") {
        const card = isUndo ? action.before : action.after;
        const result = await this.updateCard(
          action.cardId,
          {
            title: card.title,
            description: card.description,
            assigneeId: card.assigneeId,
            status: card.status,
            labels: card.labels
          },
          { skipHistory: true }
        );
        return result?.error ? result : { ok: true };
      }
      if (action.type === "move") {
        const card = isUndo ? action.before : action.after;
        const result = await moveCardRow(action.cardId, card.columnId, card.position ?? 0);
        if (result.error) return { error: result.error };
        this.upsertCard(result.data);
        await useUiStore().loadActivity(result.data.boardId);
        return { ok: true };
      }
      return { error: new Error("This action cannot be undone safely.") };
    },
    async restoreCard(cardId) {
      if (!this.assertCanMutate()) return { error: "viewer" };
      const { data, error } = await restoreCardRow(cardId);
      this.errorMessage = error?.message || "";
      if (error) return { error };
      this.upsertCard(data);
      await useUiStore().loadActivity(data.boardId);
      return { card: data };
    },
    undoLastMove() {
      return this.undoLastAction();
    },
    redoLastMove() {
      return this.redoLastAction();
    }
  }
});
