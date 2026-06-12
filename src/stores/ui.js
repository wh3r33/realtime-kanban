import { defineStore } from "pinia";
import { listBoardActivity } from "../services/activityRepository";
import { acceptPendingInvitation, declinePendingInvitation, listPendingInvitationsForCurrentUser } from "../services/memberRepository";

const savedTheme = () => {
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem("realtime-kanban:theme") || "light";
};

function activityTitle(action = "") {
  if (action === "invite_created") return "Invite Created";
  if (action === "invite_accepted") return "Invite Accepted";
  if (action === "invite_declined") return "Invite Declined";
  if (action === "invite_revoked") return "Invite Revoked";
  return action.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function activityBody(row) {
  if (row.action === "invite_created") return `Invitation sent to ${row.new_data?.email || "a teammate"}`;
  if (row.action === "invite_accepted") return `${row.new_data?.email || "A teammate"} accepted the invitation`;
  if (row.action === "invite_declined") return `${row.new_data?.email || "A teammate"} declined the invitation`;
  if (row.action === "invite_revoked") return `Invitation revoked for ${row.old_data?.email || "a teammate"}`;
  return row.new_data?.title || row.new_data?.description || row.entity_type || "";
}

export const useUiStore = defineStore("ui", {
  state: () => ({
    syncState: "idle",
    syncText: "Realtime not connected",
    lastChanged: "No changes loaded",
    activityEvents: [],
    notifications: [],
    pendingInvitations: [],
    toasts: [],
    theme: savedTheme(),
    isLoading: false,
    errorMessage: ""
  }),
  getters: {
    unreadNotifications: (state) => [
      ...state.pendingInvitations.map((invitation) => ({ id: invitation.id, type: "invite", unread: true })),
      ...state.notifications.filter((notification) => notification.unread)
    ]
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
    async loadPendingInvitations() {
      const { data, error } = await listPendingInvitationsForCurrentUser();
      this.pendingInvitations = data || [];
      this.errorMessage = error?.message || "";
      return { invitations: this.pendingInvitations, error };
    },
    async acceptInvitation(invitationId) {
      const { data, error } = await acceptPendingInvitation(invitationId);
      this.errorMessage = error?.message || "";
      if (error) return { error };
      this.pendingInvitations = this.pendingInvitations.filter((invitation) => invitation.id !== invitationId);
      const { useBoardsStore } = await import("./boards");
      const boardsStore = useBoardsStore();
      await boardsStore.loadBoards();
      if (data?.boardId) boardsStore.selectBoard(data.boardId);
      return { invitation: data };
    },
    async declineInvitation(invitationId) {
      const { data, error } = await declinePendingInvitation(invitationId);
      this.errorMessage = error?.message || "";
      if (error) return { error };
      this.pendingInvitations = this.pendingInvitations.filter((invitation) => invitation.id !== invitationId);
      return { invitation: data };
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
    applyActivityChange(payload) {
      if (payload.eventType === "DELETE") {
        this.activityEvents = this.activityEvents.filter((event) => event.id !== payload.old.id);
        return;
      }
      const row = payload.new;
      const event = {
        id: row.id,
        boardId: row.board_id,
        actorId: row.user_id,
        type: row.action,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        oldData: row.old_data,
        newData: row.new_data,
        title: activityTitle(row.action),
        body: activityBody(row),
        createdAt: row.created_at ? new Date(row.created_at).toLocaleString() : ""
      };
      this.activityEvents = [event, ...this.activityEvents.filter((item) => item.id !== event.id)].slice(0, 50);
      this.lastChanged = event.title;
    },
    setTheme(theme) {
      this.theme = theme;
      if (typeof document !== "undefined") document.documentElement.dataset.theme = theme;
      if (typeof window !== "undefined") window.localStorage.setItem("realtime-kanban:theme", theme);
    },
    resetWorkspace() {
      this.syncState = "idle";
      this.syncText = "Realtime not connected";
      this.lastChanged = "No changes loaded";
      this.activityEvents = [];
      this.notifications = [];
      this.pendingInvitations = [];
      this.toasts = [];
      this.isLoading = false;
      this.errorMessage = "";
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
