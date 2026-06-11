import { defineStore } from "pinia";
import { cards, comments } from "../data/mockData";

const nowLabel = () => "just now";

export const useCardsStore = defineStore("cards", {
  state: () => ({
    cards,
    comments,
    selectedCardId: null,
    undoHistory: [],
    redoHistory: []
  }),
  getters: {
    selectedCard: (state) => state.cards.find((card) => card.id === state.selectedCardId),
    cardById: (state) => (cardId) => state.cards.find((card) => card.id === cardId),
    commentsFor: (state) => (cardId) => state.comments.filter((comment) => comment.cardId === cardId)
  },
  actions: {
    selectCard(cardId) {
      this.selectedCardId = cardId;
    },
    closeCard() {
      this.selectedCardId = null;
    },
    moveTask(cardId, targetColumn, actorName = "NN User") {
      const task = this.cardById(cardId);
      if (!task || task.column === targetColumn) return null;
      const action = { id: `move-${Date.now()}`, cardId, from: task.column, to: targetColumn, title: task.title };
      this.undoHistory.push(action);
      this.redoHistory = [];
      this.applyMove(task, targetColumn, "move", actorName);
      return action;
    },
    applyMove(task, targetColumn, mode, actorName) {
      task.column = targetColumn;
      task.status = task.status === "locked" ? "live" : task.status;
      task.labels = Array.from(new Set(["LIVE", ...(task.labels || []).filter((badge) => badge !== "LOCKED")]));
      task.updatedAt = nowLabel();
      task.history.unshift(`${mode === "redo" ? "Redone" : mode === "undo" ? "Reverted" : "Moved"} to ${targetColumn} by ${actorName}`);
    },
    undoLastMove(actorName = "NN User") {
      const action = this.undoHistory.pop();
      if (!action) return null;
      const task = this.cardById(action.cardId);
      if (!task) return null;
      this.applyMove(task, action.from, "undo", actorName);
      this.redoHistory.push(action);
      return action;
    },
    redoLastMove(actorName = "NN User") {
      const action = this.redoHistory.pop();
      if (!action) return null;
      const task = this.cardById(action.cardId);
      if (!task) return null;
      this.applyMove(task, action.to, "redo", actorName);
      this.undoHistory.push(action);
      return action;
    }
  }
});
