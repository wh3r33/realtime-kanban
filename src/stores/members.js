import { defineStore } from "pinia";
import {
  createBoardInvitation,
  getCurrentUserBoardRole,
  listBoardInvitations,
  listBoardMembers,
  removeBoardMember,
  revokeBoardInvitation,
  updateMemberRole
} from "../services/memberRepository";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { useAuthStore } from "./auth";

const fallbackMember = {
  id: null,
  name: "Unassigned",
  email: "",
  initials: "--",
  color: "#56534d",
  role: "viewer",
  presence: "not connected",
  activity: "No activity"
};

export const useMembersStore = defineStore("members", {
  state: () => ({
    members: [],
    invitations: [],
    editingUsers: [],
    locks: [],
    presenceByUserId: {},
    presenceConnected: false,
    loading: false,
    errorMessage: "",
    setupRequired: !isSupabaseConfigured
  }),
  getters: {
    onlineMembers: (state) => state.members.filter((member) => state.presenceByUserId[member.id]),
    memberById: (state) => (memberId) => state.members.find((member) => member.id === memberId) || fallbackMember,
    lockForCard: (state) => (cardId) => state.locks.find((lock) => lock.cardId === cardId),
    editorForCard: (state) => (cardId) => state.editingUsers.find((presence) => presence.cardId === cardId),
    canManageMembers: () => useAuthStore().canManageWorkspace
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
      if (this.setupRequired || !boardId || !this.canManageMembers) {
        this.invitations = [];
        return;
      }
      const { data, error } = await listBoardInvitations(boardId);
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
      this.members = this.members.map((member) => ({
        ...member,
        presence: nextPresence[member.id] ? "online" : "offline",
        activity: nextPresence[member.id]?.cardId ? "Editing a card" : member.activity
      }));
    },
    setPresenceDisconnected() {
      this.presenceConnected = false;
      this.presenceByUserId = {};
      this.editingUsers = [];
      this.members = this.members.map((member) => ({ ...member, presence: "offline" }));
    },
    async createInvitation(boardId, email, role) {
      if (!this.canManageMembers) return { error: new Error("Only owners can invite members.") };
      const { data, error } = await createBoardInvitation(boardId, email, role);
      this.errorMessage = error?.message || "";
      if (!error && data) this.invitations = [data, ...this.invitations.filter((item) => item.id !== data.id)];
      return { invitation: data, error };
    },
    async revokeInvitation(invitationId) {
      if (!this.canManageMembers) return { error: new Error("Only owners can revoke invitations.") };
      const { data, error } = await revokeBoardInvitation(invitationId);
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
