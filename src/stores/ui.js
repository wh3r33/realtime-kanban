import { defineStore } from "pinia";
import { listBoardActivity } from "../services/activityRepository";

const savedTheme = () => {
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem("realtime-kanban:theme") || "light";
};

export const useUiStore = defineStore("ui", {
  state: () => ({
    syncState: "idle",
    syncText: "Realtime not connected",
    lastChanged: "No changes loaded",
    activityEvents: [],
    notifications: [],
    toasts: [],
    theme: savedTheme(),
    isLoading: false,
    errorMessage: ""
  }),
  getters: {
    unreadNotifications: (state) => state.notifications.filter((notification) => notification.unread)
  },
  actions: {
    async loadActivity(boardId) {
      if (!boardId) {
        this.activityEvents = [];
        return;
      }
      const { data, error } = await listBoardActivity(boardId);
      this.activityEvents = data || [];
      this.errorMessage = error?.message || "";
    },
    addActivity() {
      this.lastChanged = "Activity will update after Supabase writes complete";
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
      this.syncText = detail || `${state.charAt(0).toUpperCase()}${state.slice(1)}`;
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
