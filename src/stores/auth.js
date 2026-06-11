import { defineStore } from "pinia";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    currentUserId: "u-nn",
    session: { status: "authenticated", workspaceId: "workspace-main" },
    invitation: { activeInviteId: "invite-02", status: "pending" }
  })
});
