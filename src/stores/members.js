import { defineStore } from "pinia";
import { editingUsers, locks, members } from "../data/mockData";

export const useMembersStore = defineStore("members", {
  state: () => ({
    members,
    editingUsers,
    locks
  }),
  getters: {
    onlineMembers: (state) => state.members.filter((member) => member.presence === "online"),
    memberById: (state) => (memberId) => state.members.find((member) => member.id === memberId) || state.members[0],
    lockForCard: (state) => (cardId) => state.locks.find((lock) => lock.cardId === cardId),
    editorForCard: (state) => (cardId) => state.editingUsers.find((presence) => presence.cardId === cardId)
  }
});
