import { defineStore } from "pinia";
import { watch } from "vue";
import {
  createBoardInvitation,
  getCurrentUserBoardRole,
  listBoardInvitations,
  listBoardMembers,
  removeBoardMember,
  revokeBoardInvitation,
  updateMemberRole
} from "../services/memberRepository";
import { language, t } from "../services/localization";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { useAuthStore } from "./auth";

const fallbackMember = {
  id: null,
  name: "Unassigned",
  email: "",
  avatarUrl: "",
  initials: "--",
  color: "#56534d",
  role: "viewer",
  presence: "not connected",
  activity: "No activity"
};

function presenceMessageForStatus(status) {
  if (status === "connecting") return t("members.presenceConnecting");
  if (status === "online") return t("members.presenceLive");
  if (status === "error") return t("members.presenceUnavailable");
  return t("members.presenceOffline");
}

export const useMembersStore = defineStore("members", {
  state: () => ({
    members: [],
    invitations: [],
    editingUsers: [],
    locks: [],
    presenceByUserId: {},
    presenceConnected: false,
    presenceStatus: "offline",
    presenceMessage: presenceMessageForStatus("offline"),
    loading: false,
    errorMessage: "",
    invitationsSupported: true,
    setupRequired: !isSupabaseConfigured
  }),
  getters: {
    onlineMembers: (state) => state.members.filter((member) => state.presenceByUserId[member.id]),
    memberById: (state) => (memberId) => state.members.find((member) => member.id === memberId) || fallbackMember,
    lockForCard: (state) => (cardId) => state.locks.find((lock) => lock.cardId === cardId),
    editorForCard: (state) => (cardId) => state.editingUsers.find((presence) => presence.cardId === cardId),
    canManageMembers: () => useAuthStore().canManageWorkspace,
    canInviteMembers: () => useAuthStore().canInviteMembers
  },
  actions: {
    async loadMembers(boardId) {
      if (this.setupRequired || !boardId) return;
      this.loading = true;
      const { data, error } = await listBoardMembers(boardId);
      this.members = data || [];
      this.errorMessage = error?.message || "";
      const roleResult = await getCurrentUserBoardRole(boardId);
      if (!roleResult.error) useAuthStore().setBoardRole(roleResult.data);
      this.loading = false;
    },
    async loadInvitations(boardId) {
      if (this.setupRequired || !boardId || !this.canInviteMembers) {
        this.invitations = [];
        return;
      }
      const { data, error } = await listBoardInvitations(boardId);
      if (error?.code === "MIGRATION_REQUIRED") {
        this.invitationsSupported = false;
        this.invitations = [];
        this.errorMessage = error.message;
        return;
      }
      this.invitationsSupported = true;
      this.invitations = data || [];
      this.errorMessage = error?.message || "";
    },
    applyMemberChange(payload) {
      if (payload.eventType === "DELETE") {
        this.members = this.members.filter((member) => member.id !== payload.old.user_id);
        return;
      }
      const row = payload.new;
      const existing = this.members.find((member) => member.id === row.user_id);
      const member = {
        ...(existing || fallbackMember),
        id: row.user_id,
        boardId: row.board_id,
        role: row.role,
        joinedAt: row.created_at,
        avatarUrl: row.profiles?.avatar_url || existing?.avatarUrl || "",
        presence: this.presenceByUserId[row.user_id] ? "online" : "offline"
      };
      const index = this.members.findIndex((item) => item.id === member.id);
      if (index >= 0) this.members[index] = member;
      else this.members.push(member);
    },
    applyPresenceState(state) {
      const nextPresence = {};
      const editing = [];
      for (const presences of Object.values(state || {})) {
        for (const presence of presences) {
          if (!presence.userId) continue;
          nextPresence[presence.userId] = presence;
          if (presence.cardId) {
            editing.push({
              cardId: presence.cardId,
              userId: presence.userId,
              field: presence.field || presence.mode || "card",
              mode: presence.mode || "editing",
              timestamp: presence.timestamp || presence.online_at
            });
          }
        }
      }
      this.presenceByUserId = nextPresence;
      this.editingUsers = editing;
      this.presenceConnected = true;
      this.presenceStatus = "online";
      this.presenceMessage = t("members.presenceLive");
      this.members = this.members.map((member) => ({
        ...member,
        presence: nextPresence[member.id] ? "online" : "offline",
        activity: nextPresence[member.id]?.cardId ? "Editing a card" : member.activity
      }));
    },
    resetWorkspace() {
      this.members = [];
      this.invitations = [];
      this.editingUsers = [];
      this.locks = [];
      this.presenceByUserId = {};
      this.presenceConnected = false;
      this.presenceStatus = "offline";
      this.presenceMessage = t("members.presenceOffline");
      this.loading = false;
      this.errorMessage = "";
      this.invitationsSupported = true;
    },
    setPresenceDisconnected() {
      this.presenceConnected = false;
      this.presenceStatus = "offline";
      this.presenceMessage = presenceMessageForStatus("offline");
      this.presenceByUserId = {};
      this.editingUsers = [];
      this.members = this.members.map((member) => ({ ...member, presence: "offline" }));
    },
    setPresenceConnecting(message = presenceMessageForStatus("connecting")) {
      this.presenceConnected = false;
      this.presenceStatus = "connecting";
      this.presenceMessage = message;
    },
    setPresenceConnected(message = presenceMessageForStatus("online")) {
      this.presenceConnected = true;
      this.presenceStatus = "online";
      this.presenceMessage = message;
    },
    setPresenceFailed(message = presenceMessageForStatus("error")) {
      this.presenceConnected = false;
      this.presenceStatus = "error";
      this.presenceMessage = message;
      this.presenceByUserId = {};
      this.editingUsers = [];
      this.members = this.members.map((member) => ({ ...member, presence: "offline" }));
    },
    async createInvitation(boardId, email, role) {
      if (!this.canInviteMembers) return { error: new Error("Only owners and editors can invite members.") };
      if (!this.invitationsSupported) return { error: new Error("Invites require database migration.") };
      const { data, error, duplicate } = await createBoardInvitation(boardId, email, role);
      if (error?.code === "MIGRATION_REQUIRED") this.invitationsSupported = false;
      this.errorMessage = error?.message || "";
      if (!error && data) this.invitations = [data, ...this.invitations.filter((item) => item.id !== data.id)];
      return { invitation: data, error, duplicate };
    },
    async revokeInvitation(invitationId) {
      if (!this.canInviteMembers) return { error: new Error("Only owners and editors can revoke invitations.") };
      if (!this.invitationsSupported) return { error: new Error("Invites require database migration.") };
      const { data, error } = await revokeBoardInvitation(invitationId);
      if (error?.code === "MIGRATION_REQUIRED") this.invitationsSupported = false;
      this.errorMessage = error?.message || "";
      if (!error) this.invitations = this.invitations.filter((item) => item.id !== invitationId);
      return { invitation: data, error };
    },
    async changeRole(boardId, userId, role) {
      if (!this.canManageMembers) return { error: new Error("Only owners can change member roles.") };
      const { data, error } = await updateMemberRole(boardId, userId, role);
      this.errorMessage = error?.message || "";
      if (!error && data) this.applyMemberChange({ eventType: "UPDATE", new: { board_id: data.boardId, user_id: data.id, role: data.role, created_at: data.joinedAt } });
      return { member: data, error };
    },
    async removeMember(boardId, userId) {
      if (!this.canManageMembers) return { error: new Error("Only owners can remove members.") };
      const { data, error } = await removeBoardMember(boardId, userId);
      this.errorMessage = error?.message || "";
      if (!error) this.members = this.members.filter((member) => member.id !== userId);
      return { member: data, error };
    }
  }
});

watch(language, () => {
  const store = useMembersStore();
  store.presenceMessage = presenceMessageForStatus(store.presenceStatus);
});
