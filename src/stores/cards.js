import { defineStore } from "pinia";
import {
  createCard as insertCard,
  deleteCard as removeCardRow,
  moveCard as moveCardRow,
  restoreCard as restoreCardRow,
  undoLastBoardAction,
  updateCard as updateCardRow
} from "../services/cardRepository";
import { insertChecklistItems, listChecklistItemsForBoard, updateChecklistItem } from "../services/checklistRepository";
import {
  createComment as insertComment,
  deleteComment as removeCommentRow,
  listCommentsForBoard,
  updateComment as updateCommentRow
} from "../services/commentRepository";
import { subscribeToBoard } from "../services/realtimeService";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { useAuthStore } from "./auth";
import { useBoardsStore } from "./boards";
import { useMembersStore } from "./members";
import { useUiStore } from "./ui";

const clone = (value) => JSON.parse(JSON.stringify(value));
const sortCards = (items) => [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.title.localeCompare(b.title));
const canMutate = () => useAuthStore().canMutateCards;
const offlineError = () => new Error("Нет соединения. Действие поставлено в очередь и будет повторено после восстановления сети.");

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
    aiPriority: row.ai_priority ?? null,
    aiPriorityReason: row.ai_priority_reason || "",
    history: [],
    updatedAt: row.updated_at ? new Date(row.updated_at).toLocaleString() : "",
    version: row.version || 1,
    createdAt: row.created_at,
    deletedAt: row.status === "deleted" ? row.updated_at : null
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
    checklistItemsByCardId: {},
    selectedCardId: null,
    undoHistory: [],
    redoHistory: [],
    movementError: null,
    conflict: null,
    seenRealtimeEvents: [],
    loading: false,
    errorMessage: "",
    offline: {
      isOnline: true,
      queue: [],
      syncing: false
    },
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
    checklistForCard: (state) => (cardId) => state.checklistItemsByCardId[cardId] || [],
    checklistSummaryForCard: (state) => (cardId) => {
      const items = state.checklistItemsByCardId[cardId] || [];
      return {
        total: items.length,
        completed: items.filter((item) => item.isDone).length,
        open: items.filter((item) => !item.isDone)
      };
    },
    commentsFor: (state) => (cardId) => state.comments.filter((comment) => comment.cardId === cardId),
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
      if (!error) await this.loadChecklistItems(boardId);
      if (!error) await this.loadComments(boardId);
      this.loading = false;
    },
    setOnlineStatus(isOnline) {
      this.offline.isOnline = isOnline;
      if (isOnline) this.flushOfflineQueue();
    },
    enqueueOffline(action) {
      this.offline.queue.push({
        id: `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: new Date().toISOString(),
        ...action
      });
      this.errorMessage = offlineError().message;
    },
    async flushOfflineQueue() {
      if (this.offline.syncing || !this.offline.isOnline || !this.offline.queue.length) return;
      this.offline.syncing = true;
      const queue = [...this.offline.queue];
      this.offline.queue = [];
      for (const action of queue) {
        let result = null;
        if (action.type === "create") result = await this.createCard(action.payload, { ...action.options, fromQueue: true });
        if (action.type === "update") result = await this.updateCard(action.cardId, action.patch, { ...action.options, fromQueue: true });
        if (action.type === "move") result = await this.moveTask(action.cardId, action.targetColumnId, action.toIndex, { ...action.options, fromQueue: true });
        if (action.type === "delete") result = await this.deleteCard(action.cardId, { ...action.options, fromQueue: true });
        if (result?.error) this.offline.queue.push(action);
      }
      this.offline.syncing = false;
    },
    async loadChecklistItems(boardId = useBoardsStore().selectedBoardId) {
      if (!isSupabaseConfigured || !boardId) {
        this.checklistItemsByCardId = {};
        return { items: [] };
      }
      const { data, error } = await listChecklistItemsForBoard(boardId);
      this.errorMessage = error?.message || "";
      if (error) return { error };
      this.checklistItemsByCardId = (data || []).reduce((groups, item) => {
        groups[item.cardId] = [...(groups[item.cardId] || []), item].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        return groups;
      }, {});
      return { items: data || [] };
    },
    async loadComments(boardId = useBoardsStore().selectedBoardId) {
      if (!isSupabaseConfigured || !boardId) {
        this.comments = [];
        return { comments: [] };
      }
      const { data, error } = await listCommentsForBoard(boardId);
      this.errorMessage = error?.message || "";
      if (error) return { error };
      this.comments = data || [];
      return { comments: data || [] };
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
          if (event.table === "card_checklist_items") this.loadChecklistItems(boardId);
          if (event.table === "card_comments") this.applyCommentChange(event.payload);
          if (event.table === "columns") boardsStore.applyColumnChange(event.payload);
          if (event.table === "activity_logs") uiStore.applyActivityChange(event.payload);
          if (event.table === "board_members") useMembersStore().applyMemberChange(event.payload);
        },
        onPresenceSync: (state) => useMembersStore().applyPresenceState(state),
        onReconnect: async () => {
          await this.loadCards(boardId);
          await useUiStore().loadActivity(boardId);
          await useMembersStore().loadMembers(boardId);
        },
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
          } else if (status === "RECONNECTING") {
            useUiStore().setSyncState("partial", "Realtime переподключается");
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
    replaceCards(nextCards) {
      const byId = new Map(nextCards.map((card) => [card.id, card]));
      this.cards = [...byId.values()];
    },
    normalizeColumnPositions(boardId, columnId) {
      const ordered = this.cardsForColumn(boardId, columnId);
      this.cards = this.cards.map((card) => {
        const index = ordered.findIndex((item) => item.id === card.id);
        return index >= 0 ? { ...card, position: index } : card;
      });
    },
    applyConflict(cardId, remote, mine = null) {
      if (remote) this.upsertCard(remote, { remote: true });
      this.conflict = {
        cardId,
        mine: mine ? clone(mine) : null,
        latest: remote ? clone(remote) : null,
        message: "Конфликт версии: карточка уже изменена другим пользователем. Загружена последняя версия."
      };
      this.errorMessage = this.conflict.message;
    },
    applyCardChange(payload) {
      if (payload.eventType === "DELETE" || payload.new?.status === "deleted") {
        this.removeCard(payload.old?.id || payload.new?.id, { remote: true });
        return;
      }
      this.upsertCard(mapCardRow(payload.new), { remote: true });
    },
    applyCommentChange(payload) {
      if (payload.eventType === "DELETE") {
        this.comments = this.comments.filter((comment) => comment.id !== payload.old.id);
        return;
      }
      const row = payload.new;
      const comment = {
        id: row.id,
        cardId: row.card_id,
        authorId: row.user_id,
        authorName: "User",
        body: row.body,
        createdAt: row.created_at ? new Date(row.created_at).toLocaleString() : "",
        updatedAt: row.updated_at ? new Date(row.updated_at).toLocaleString() : ""
      };
      this.comments = [comment, ...this.comments.filter((item) => item.id !== comment.id)].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    },
    async createCard(payload, options = {}) {
      if (!this.assertCanMutate()) return { error: "viewer" };
      const columnId = payload.columnId;
      if (!columnId) return { error: "missing-column" };
      const snapshot = clone(this.cards);
      const columnCards = this.cardsForColumn(payload.boardId, columnId);
      const optimisticCard = {
        id: `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        boardId: payload.boardId,
        columnId,
        column: useBoardsStore().columnById(columnId)?.title || columnId,
        title: payload.title.trim(),
        description: payload.description.trim(),
        assigneeId: payload.assigneeId || null,
        createdBy: useAuthStore().currentUserId,
        position: columnCards.length,
        status: "active",
        labels: payload.labels || [],
        history: [],
        updatedAt: "Сохраняется...",
        version: 1,
        pending: true
      };
      this.upsertCard(optimisticCard, { remote: true });
      if (!this.offline.isOnline && !options.fromQueue) {
        this.enqueueOffline({ type: "create", payload, options });
        return { card: optimisticCard, queued: true };
      }
      const { data, error } = await insertCard(payload.boardId, columnId, {
        title: payload.title.trim(),
        description: payload.description.trim(),
        assigneeId: payload.assigneeId,
        position: columnCards.length,
        labels: payload.labels || []
      });
      this.errorMessage = error?.message || "";
      if (error) {
        this.cards = snapshot;
        return { error };
      }
      this.removeCard(optimisticCard.id, { remote: true });
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
      const optimistic = {
        ...existing,
        title: patch.title?.trim() || existing.title,
        description: patch.description?.trim() ?? existing.description,
        assigneeId: patch.assigneeId,
        status: patch.status || existing.status,
        labels: patch.labels || existing.labels,
        version: existing.version + 1,
        pending: true,
        updatedAt: "Сохраняется..."
      };
      this.upsertCard(optimistic, { remote: true });
      if (!this.offline.isOnline && !options.fromQueue) {
        this.enqueueOffline({ type: "update", cardId, patch, options: { ...options, expectedVersion: existing.version } });
        return { card: optimistic, queued: true };
      }
      const { data, error, conflict, remote } = await updateCardRow(cardId, {
        title: patch.title?.trim() || existing.title,
        description: patch.description?.trim() ?? existing.description,
        assigneeId: patch.assigneeId,
        status: patch.status || existing.status,
        labels: patch.labels || existing.labels
      }, options.expectedVersion || existing.version);
      this.errorMessage = error?.message || "";
      if (conflict) {
        this.applyConflict(cardId, remote, optimistic);
        return { error: "conflict", conflict: this.conflict };
      }
      if (error) {
        this.upsertCard(before, { remote: true });
        this.errorMessage = `Ошибка сохранения карточки: ${error.message || error}`;
        return { error };
      }
      this.upsertCard(data);
      if (!options.skipHistory) this.pushHistory(createHistoryAction("edit", before, data));
      await useUiStore().loadActivity(data.boardId);
      return { card: data };
    },
    async saveChecklistItemsToCard(cardId, titles) {
      if (!this.assertCanMutate()) return { error: "viewer" };
      if (!cardId || !this.cardById(cardId)) return { error: "missing-card" };
      const { data, skipped, error } = await insertChecklistItems(cardId, titles);
      this.errorMessage = error?.message || "";
      if (error) return { error };
      if (data?.length) {
        this.checklistItemsByCardId = {
          ...this.checklistItemsByCardId,
          [cardId]: [...(this.checklistItemsByCardId[cardId] || []), ...data].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        };
      }
      return { items: data || [], skipped: skipped || [] };
    },
    async toggleChecklistItem(itemId, isDone) {
      if (!this.assertCanMutate()) return { error: "viewer" };
      const { data, error } = await updateChecklistItem(itemId, { isDone });
      this.errorMessage = error?.message || "";
      if (error) return { error };
      if (data) {
        const items = this.checklistItemsByCardId[data.cardId] || [];
        this.checklistItemsByCardId = {
          ...this.checklistItemsByCardId,
          [data.cardId]: items.map((item) => (item.id === data.id ? data : item)).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        };
      }
      return { item: data };
    },
    async deleteCard(cardId, options = {}) {
      if (!this.assertCanMutate()) return { error: "viewer" };
      const before = this.cardById(cardId);
      if (!before) return { error: "missing" };
      const snapshot = clone(this.cards);
      this.removeCard(cardId, { remote: true });
      if (!this.offline.isOnline && !options.fromQueue) {
        this.enqueueOffline({ type: "delete", cardId, options: { ...options, expectedVersion: before.version } });
        if (!options.skipHistory) this.pushHistory(createHistoryAction("delete", before, before));
        return { card: before, queued: true };
      }
      const { data, error, warning, restorable, conflict, remote } = await removeCardRow(cardId, options.expectedVersion || before.version);
      this.errorMessage = error?.message || warning || "";
      if (conflict) {
        this.cards = snapshot;
        this.applyConflict(cardId, remote, before);
        return { error: "conflict", conflict: this.conflict };
      }
      if (error) {
        this.cards = snapshot;
        this.errorMessage = `Ошибка удаления карточки: ${error.message || error}`;
        return { error };
      }
      if (!options.skipHistory && restorable !== false) this.pushHistory(createHistoryAction("delete", before, data));
      await useUiStore().loadActivity(data.boardId);
      return { card: data, warning };
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
    async addComment(cardId, body) {
      if (!this.assertCanMutate()) return { error: "viewer" };
      if (!body?.trim()) return { error: "empty" };
      const { data, error } = await insertComment(cardId, body);
      this.errorMessage = error?.message || "";
      if (error) return { error };
      this.comments = [...this.comments.filter((comment) => comment.id !== data.id), data];
      await useUiStore().loadActivity(this.cardById(cardId)?.boardId);
      return { comment: data };
    },
    async updateComment(commentId, body) {
      if (!this.assertCanMutate()) return { error: "viewer" };
      const { data, error } = await updateCommentRow(commentId, body);
      this.errorMessage = error?.message || "";
      if (error) return { error };
      this.comments = this.comments.map((comment) => (comment.id === data.id ? data : comment));
      await useUiStore().loadActivity(this.cardById(data.cardId)?.boardId);
      return { comment: data };
    },
    async deleteComment(commentId) {
      if (!this.assertCanMutate()) return { error: "viewer" };
      const existing = this.comments.find((comment) => comment.id === commentId);
      const { data, error } = await removeCommentRow(commentId);
      this.errorMessage = error?.message || "";
      if (error) return { error };
      this.comments = this.comments.filter((comment) => comment.id !== commentId);
      await useUiStore().loadActivity(this.cardById(existing?.cardId || data?.cardId)?.boardId);
      return { comment: data };
    },
    async moveTask(cardId, targetColumnId, toIndex = Number.POSITIVE_INFINITY, options = {}) {
      if (!this.assertCanMutate()) return { error: "viewer" };
      const task = this.cardById(cardId);
      if (!task) return null;
      const snapshot = clone(this.cards);
      const before = clone(task);
      const fromColumnId = task.columnId;
      const fromPosition = task.position ?? 0;
      const targetCards = this.cardsForColumn(task.boardId, targetColumnId).filter((card) => card.id !== cardId);
      const nextIndex = Math.max(0, Math.min(toIndex, targetCards.length));
      if (fromColumnId === targetColumnId && fromPosition === nextIndex) return null;
      const targetColumn = useBoardsStore().columnById(targetColumnId);
      const withoutMoved = this.cards.filter((card) => card.id !== cardId);
      const moved = {
        ...task,
        columnId: targetColumnId,
        column: targetColumn?.title || targetColumnId,
        position: nextIndex,
        version: task.version + 1,
        pending: true,
        updatedAt: "Сохраняется..."
      };
      const nextCards = [];
      for (const card of withoutMoved) {
        if (card.boardId === task.boardId && card.columnId === targetColumnId && card.position >= nextIndex) nextCards.push({ ...card, position: card.position + 1 });
        else if (card.boardId === task.boardId && card.columnId === fromColumnId && card.position > fromPosition) nextCards.push({ ...card, position: card.position - 1 });
        else nextCards.push(card);
      }
      nextCards.push(moved);
      this.replaceCards(nextCards);
      this.normalizeColumnPositions(task.boardId, fromColumnId);
      this.normalizeColumnPositions(task.boardId, targetColumnId);
      if (!this.offline.isOnline && !options.fromQueue) {
        this.enqueueOffline({ type: "move", cardId, targetColumnId, toIndex: nextIndex, options: { ...options, expectedVersion: task.version } });
        this.pushHistory(createHistoryAction("move", before, moved));
        return {
          cardId,
          boardId: task.boardId,
          from: before.column,
          to: moved.column,
          fromPosition,
          toPosition: nextIndex,
          title: task.title,
          queued: true
        };
      }
      const { data, error, conflict, remote } = await moveCardRow(cardId, targetColumnId, nextIndex, options.expectedVersion || task.version);
      this.movementError = error?.message || null;
      if (conflict) {
        this.cards = snapshot;
        this.applyConflict(cardId, remote, moved);
        return { error: "conflict", conflict: this.conflict };
      }
      if (error) {
        this.cards = snapshot;
        this.errorMessage = `Ошибка перемещения карточки: ${error.message || error}`;
        return { error };
      }
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
      const boardId = useBoardsStore().selectedBoardId;
      if (!boardId) return { error: new Error("No board selected.") };
      const { data, error } = await undoLastBoardAction(boardId);
      this.errorMessage = error?.message || "";
      if (error) return { error };
      await this.loadCards(boardId);
      await useUiStore().loadActivity(boardId);
      this.undoHistory.pop();
      this.redoHistory = [];
      return data;
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
          { skipHistory: true, expectedVersion: this.cardById(action.cardId)?.version }
        );
        return result?.error ? result : { ok: true };
      }
      if (action.type === "move") {
        const card = isUndo ? action.before : action.after;
        const current = this.cardById(action.cardId);
        const result = await moveCardRow(action.cardId, card.columnId, card.position ?? 0, current?.version);
        if (result.error) return { error: result.error };
        this.upsertCard(result.data);
        await useUiStore().loadActivity(result.data.boardId);
        return { ok: true };
      }
      return { error: new Error("This action cannot be undone safely.") };
    },
    async restoreCard(cardId) {
      if (!this.assertCanMutate()) return { error: "viewer" };
      const current = this.cardById(cardId);
      const { data, error, conflict, remote } = await restoreCardRow(cardId, current?.version);
      this.errorMessage = error?.message || "";
      if (conflict) {
        this.applyConflict(cardId, remote, current);
        return { error: "conflict", conflict: this.conflict };
      }
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
