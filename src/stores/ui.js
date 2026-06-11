import { defineStore } from "pinia";
import { activityEvents } from "../data/mockData";

export const useUiStore = defineStore("ui", {
  state: () => ({
    syncState: "synced",
    syncText: "Synced · heartbeat just now",
    lastChanged: "Last change just now",
    activityEvents,
    toasts: []
  }),
  actions: {
    addActivity(type, title, body, actorId = "u-nn") {
      this.activityEvents.unshift({
        id: `evt-${Date.now()}`,
        type,
        actorId,
        title,
        body,
        createdAt: "just now"
      });
      this.activityEvents = this.activityEvents.slice(0, 20);
      this.lastChanged = "Last change just now";
    },
    showToast(message) {
      const toast = { id: `toast-${Date.now()}`, message };
      this.toasts.push(toast);
      window.setTimeout(() => {
        this.toasts = this.toasts.filter((item) => item.id !== toast.id);
      }, 3200);
    },
    setSyncState(state, detail) {
      this.syncState = state;
      this.syncText = detail || `${state.charAt(0).toUpperCase()}${state.slice(1)} · just now`;
    }
  }
});
