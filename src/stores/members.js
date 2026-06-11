import { defineStore } from "pinia";
import { getCurrentUserBoardRole, listBoardMembers } from "../services/memberRepository";
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
    editingUsers: [],
    locks: [],
    presenceConnected: false,
    loading: false,
    errorMessage: "",
    setupRequired: !isSupabaseConfigured
  }),
  getters: {
    onlineMembers: () => [],
    memberById: (state) => (memberId) => state.members.find((member) => member.id === memberId) || fallbackMember,
    lockForCard: (state) => (cardId) => state.locks.find((lock) => lock.cardId === cardId),
    editorForCard: (state) => (cardId) => state.editingUsers.find((presence) => presence.cardId === cardId)
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
    }
  }
});
