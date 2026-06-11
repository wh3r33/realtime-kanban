import { defineStore } from "pinia";
import { createCard as insertCard, deleteCard as removeCardRow, moveCard as moveCardRow, updateCard as updateCardRow } from "../services/cardRepository";
import { subscribeToBoard } from "../services/realtimeService";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { useAuthStore } from "./auth";
import { useBoardsStore } from "./boards";
import { useMembersStore } from "./members";
import { useUiStore } from "./ui";

const clone = (value) => JSON.parse(JSON.stringify(value));
const sortCards = (items) => [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.title.localeCompare(b.title));
const canMutate = () => useAuthStore().canMutateCards;

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
      const subscription = subscribeToBoard(boardId, {
        onEvent: (event) => this.applyRemoteEvent(event),
        onDatabaseChange: async (event) => {
          this.realtime.lastEvent = event;
          const boardsStore = useBoardsStore();
          const uiStore = useUiStore();
          if (event.table === "cards") await this.loadCards(boardId);
          if (event.table === "columns") await boardsStore.loadColumns(boardId);
          if (event.table === "activity_logs") await uiStore.loadActivity(boardId);
          if (event.table === "board_members") await useMembersStore().loadMembers(boardId);
        }
      });
      this.realtime = {
        boardId,
        mode: subscription.mode,
        unsubscribe: subscription.unsubscribe,
        publish: subscription.publish,
        lastEvent: null
      };
      useUiStore().setSyncState(subscription.mode === "supabase" ? "synced" : "partial", subscription.mode === "supabase" ? "Realtime subscription active" : "Local tab sync only");
    },
    publish(event) {
      this.realtime.publish?.(event);
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
      this.pushHistory(createHistoryAction("create", null, data));
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
      this.pushHistory(createHistoryAction("edit", before, data));
      await useUiStore().loadActivity(data.boardId);
      return { card: data };
    },
    async deleteCard(cardId) {
      if (!this.assertCanMutate()) return { error: "viewer" };
      const before = this.cardById(cardId);
      const { data, error } = await removeCardRow(cardId);
      this.errorMessage = error?.message || "";
      if (error) return { error };
      this.removeCard(cardId);
      this.pushHistory(createHistoryAction("delete", before, null));
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
      await this.loadCards(task.boardId);
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
      const action = this.undoHistory.pop();
      if (!action) return null;
      this.redoHistory.push(action);
      return action;
    },
    async redoLastAction() {
      const action = this.redoHistory.pop();
      if (!action) return null;
      this.undoHistory.push(action);
      return action;
    },
    undoLastMove() {
      return this.undoLastAction();
    },
    redoLastMove() {
      return this.redoLastAction();
    }
  }
});
