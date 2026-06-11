<script setup>
import { computed } from "vue";
import UserAvatar from "./UserAvatar.vue";
import { useBoardsStore } from "../stores/boards";
import { useCardsStore } from "../stores/cards";
import { useAuthStore } from "../stores/auth";
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";

const authStore = useAuthStore();
const boardsStore = useBoardsStore();
const cardsStore = useCardsStore();
const membersStore = useMembersStore();
const uiStore = useUiStore();
const boardBasePath = computed(() => (boardsStore.selectedBoard ? `/boards/${boardsStore.selectedBoard.id}` : "/boards"));
const onlineLabel = computed(() => (membersStore.presenceConnected ? `${membersStore.onlineMembers.length} online` : membersStore.presenceMessage));

async function undo() {
  const action = await cardsStore.undoLastAction();
  if (action?.error) {
    uiStore.showToast(action.error.message || "Undo failed");
    return;
  }
  uiStore.showToast(action ? `${action.title} reverted` : "Nothing to undo");
  if (action) uiStore.addActivity("card_updated", "Action reverted", `${authStore.currentUserName} reverted ${action.title}.`);
}

async function redo() {
  const action = await cardsStore.redoLastAction();
  if (action?.error) {
    uiStore.showToast(action.error.message || "Redo failed");
    return;
  }
  uiStore.showToast(action ? `${action.title} redone` : "Nothing to redo");
  if (action) uiStore.addActivity("card_updated", "Action redone", `${authStore.currentUserName} redid ${action.title}.`);
}
</script>

<template>
  <header class="topbar glass" data-component="TopBar">
    <div class="presence-cluster" data-component="PresenceCluster">
      <span class="online-signal"></span>
      <span>{{ onlineLabel }}</span>
    </div>

    <nav class="nav-capsule" data-nav>
      <RouterLink to="/boards" active-class="active">Boards</RouterLink>
      <RouterLink :to="boardBasePath" active-class="active">Board</RouterLink>
      <RouterLink :to="`${boardBasePath}/activity`" active-class="active">Activity</RouterLink>
      <RouterLink :to="`${boardBasePath}/members`" active-class="active">Members</RouterLink>
      <RouterLink :to="`${boardBasePath}/settings`" active-class="active">Settings</RouterLink>
    </nav>

    <div class="top-actions">
      <button class="ghost-button" type="button" :disabled="!cardsStore.undoHistory.length" @click="undo">Undo</button>
      <button class="ghost-button" type="button" :disabled="!cardsStore.redoHistory.length" @click="redo">Redo</button>
      <button class="ghost-button" type="button" :disabled="!membersStore.invitationsSupported" @click="uiStore.showToast(membersStore.invitationsSupported ? 'Open Members to create an invite' : 'Invites require database migration.')">Invite</button>
      <RouterLink class="icon-button" to="/bonus/notifications" :aria-label="`${uiStore.unreadNotifications.length} unread notifications`">
        <span v-if="uiStore.unreadNotifications.length" class="notification-dot"></span>
      </RouterLink>
      <RouterLink class="profile-button" to="/profile" :title="`${authStore.currentUserName} · ${authStore.currentRole}`" :aria-label="`${authStore.currentUserName || 'Profile'} · ${authStore.currentRole}`">
        <UserAvatar class="profile-button-avatar" :src="authStore.profile?.avatar_url || ''" :name="authStore.currentUserName" :initials="authStore.currentUserName.slice(0, 2).toUpperCase()" fill />
      </RouterLink>
    </div>
  </header>
</template>
