<script setup>
import { computed } from "vue";
import { useBoardsStore } from "../stores/boards";
import { useCardsStore } from "../stores/cards";
import { useAuthStore } from "../stores/auth";
import { useUiStore } from "../stores/ui";

const authStore = useAuthStore();
const boardsStore = useBoardsStore();
const cardsStore = useCardsStore();
const uiStore = useUiStore();
const boardBasePath = computed(() => (boardsStore.selectedBoard ? `/boards/${boardsStore.selectedBoard.id}` : "/boards"));

async function undo() {
  const action = await cardsStore.undoLastAction();
  uiStore.showToast(action ? `${action.title} reverted` : "Nothing to undo");
  if (action) uiStore.addActivity("card_updated", "Action reverted", `${authStore.currentUserName} reverted ${action.title}.`);
}

async function redo() {
  const action = await cardsStore.redoLastAction();
  uiStore.showToast(action ? `${action.title} redone` : "Nothing to redo");
  if (action) uiStore.addActivity("card_updated", "Action redone", `${authStore.currentUserName} redid ${action.title}.`);
}
</script>

<template>
  <header class="topbar glass" data-component="TopBar">
    <div class="presence-cluster" data-component="PresenceCluster">
      <span class="online-signal"></span>
      <span>Presence not connected</span>
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
      <button class="ghost-button" type="button" @click="uiStore.toggleTheme">{{ uiStore.theme === "dark" ? "Light" : "Dark" }}</button>
      <button class="ghost-button" type="button" @click="uiStore.showToast('Invitations are not connected yet')">Invite</button>
      <RouterLink class="icon-button" to="/bonus/notifications" :aria-label="`${uiStore.unreadNotifications.length} unread notifications`">
        <span v-if="uiStore.unreadNotifications.length" class="notification-dot"></span>
      </RouterLink>
      <RouterLink class="profile-button" to="/profile" :title="`${authStore.currentUserName} · ${authStore.currentRole}`">
        {{ authStore.currentUserName.slice(0, 2).toUpperCase() }}
      </RouterLink>
    </div>
  </header>
</template>
