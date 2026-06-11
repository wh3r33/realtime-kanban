import { defineStore } from "pinia";
import { activityEvents, notifications } from "../data/mockData";

const savedTheme = () => {
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem("realtime-kanban:theme") || "light";
};

export const useUiStore = defineStore("ui", {
  state: () => ({
    syncState: "synced",
    syncText: "Synced · heartbeat just now",
    lastChanged: "Last change just now",
    activityEvents: JSON.parse(JSON.stringify(activityEvents)),
    notifications: JSON.parse(JSON.stringify(notifications)),
    toasts: [],
    theme: savedTheme(),
    isLoading: false,
    errorMessage: ""
  }),
  getters: {
    unreadNotifications: (state) => state.notifications.filter((notification) => notification.unread)
  },
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
    },
    setTheme(theme) {
      this.theme = theme;
      if (typeof document !== "undefined") document.documentElement.dataset.theme = theme;
      if (typeof window !== "undefined") window.localStorage.setItem("realtime-kanban:theme", theme);
    },
    toggleTheme() {
      this.setTheme(this.theme === "dark" ? "light" : "dark");
    },
    markNotificationRead(notificationId) {
      const notification = this.notifications.find((item) => item.id === notificationId);
      if (notification) notification.unread = false;
    },
    clearError() {
      this.errorMessage = "";
    }
  }
});
