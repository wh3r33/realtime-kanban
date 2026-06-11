import { defineStore } from "pinia";
import { cards, comments } from "../data/mockData";
import { persistCardMovement } from "../services/cardRepository";

const nowLabel = () => "just now";
const clone = (value) => JSON.parse(JSON.stringify(value));
const sortCards = (items) => [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.title.localeCompare(b.title));

export const useCardsStore = defineStore("cards", {
  state: () => ({
    cards: clone(cards),
    comments: clone(comments),
    selectedCardId: null,
    undoHistory: [],
    redoHistory: [],
    movementError: null
  }),
  getters: {
    selectedCard: (state) => state.cards.find((card) => card.id === state.selectedCardId),
    cardById: (state) => (cardId) => state.cards.find((card) => card.id === cardId),
    commentsFor: (state) => (cardId) => state.comments.filter((comment) => comment.cardId === cardId),
    cardsForColumn: (state) => (boardId, column) => sortCards(state.cards.filter((card) => card.boardId === boardId && card.column === column))
  },
  actions: {
    selectCard(cardId) {
      this.selectedCardId = cardId;
    },
    closeCard() {
      this.selectedCardId = null;
    },
    async moveTask(cardId, targetColumn, toIndex = Number.POSITIVE_INFINITY, actorName = "NN User", actorId = "u-nn") {
      const task = this.cardById(cardId);
      if (!task) return null;
      const fromColumn = task.column;
      const fromPosition = task.position ?? 0;
      const targetCards = this.cardsForColumn(task.boardId, targetColumn).filter((card) => card.id !== cardId);
      const nextIndex = Math.max(0, Math.min(toIndex, targetCards.length));
      if (fromColumn === targetColumn && fromPosition === nextIndex) return null;
      const action = {
        id: `move-${Date.now()}`,
        cardId,
        boardId: task.boardId,
        from: fromColumn,
        to: targetColumn,
        fromPosition,
        toPosition: nextIndex,
        title: task.title
      };
      this.undoHistory.push(action);
      this.redoHistory = [];
      this.applyMove(task, targetColumn, nextIndex, "move", actorName);
      await this.persistMovement(action, actorId);
      return action;
    },
    applyMove(task, targetColumn, toIndex, mode, actorName) {
      const targetCards = this.cardsForColumn(task.boardId, targetColumn).filter((card) => card.id !== task.id);
      const nextIndex = Math.max(0, Math.min(toIndex, targetCards.length));
      targetCards.splice(nextIndex, 0, task);
      task.column = targetColumn;
      task.status = task.status === "locked" ? "live" : task.status;
      task.labels = Array.from(new Set(["LIVE", ...(task.labels || []).filter((badge) => badge !== "LOCKED")]));
      task.updatedAt = nowLabel();
      task.history.unshift(`${mode === "redo" ? "Redone" : mode === "undo" ? "Reverted" : "Moved"} to ${targetColumn} by ${actorName}`);
      targetCards.forEach((card, index) => {
        card.position = index;
      });
    },
    async persistMovement(action, actorId) {
      const { error } = await persistCardMovement({
        cardId: action.cardId,
        boardId: action.boardId,
        fromColumn: action.from,
        toColumn: action.to,
        fromPosition: action.fromPosition,
        toPosition: action.toPosition,
        actorId,
        createdAt: new Date().toISOString()
      });
      this.movementError = error?.message || null;
    },
    async undoLastMove(actorName = "NN User") {
      const action = this.undoHistory.pop();
      if (!action) return null;
      const task = this.cardById(action.cardId);
      if (!task) return null;
      this.applyMove(task, action.from, action.fromPosition, "undo", actorName);
      this.redoHistory.push(action);
      await this.persistMovement({ ...action, from: action.to, to: action.from, fromPosition: action.toPosition, toPosition: action.fromPosition }, "u-nn");
      return action;
    },
    async redoLastMove(actorName = "NN User") {
      const action = this.redoHistory.pop();
      if (!action) return null;
      const task = this.cardById(action.cardId);
      if (!task) return null;
      this.applyMove(task, action.to, action.toPosition, "redo", actorName);
      this.undoHistory.push(action);
      await this.persistMovement(action, "u-nn");
      return action;
    }
  }
});
