<script setup>
import { computed } from "vue";
import UserAvatar from "./UserAvatar.vue";
import { useBoardsStore } from "../stores/boards";
import { useCardsStore } from "../stores/cards";
import { useAuthStore } from "../stores/auth";
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";
import { t } from "../services/localization";
import notificationNoneIcon from "../assets/img/notification-none.svg";
import notificationIcon from "../assets/img/notification.svg";

const authStore = useAuthStore();
const boardsStore = useBoardsStore();
const cardsStore = useCardsStore();
const membersStore = useMembersStore();
const uiStore = useUiStore();
const boardBasePath = computed(() => (boardsStore.selectedBoard ? `/boards/${boardsStore.selectedBoard.id}` : "/boards"));
const onlineLabel = computed(() =>
  membersStore.presenceConnected ? `${membersStore.onlineMembers.length} ${t("members.online")}` : membersStore.presenceMessage
);
const hasUnreadNotifications = computed(() => uiStore.unreadNotifications.length > 0);
const notificationButtonIcon = computed(() => (hasUnreadNotifications.value ? notificationIcon : notificationNoneIcon));

async function undo() {
  const action = await cardsStore.undoLastAction();
  if (action?.error) {
    uiStore.showToast(action.error.message || t("common.undo"));
    return;
  }
  uiStore.showToast(action ? `${action.title} reverted` : t("common.undo"));
  if (action) uiStore.addActivity("card_updated", "Action reverted", `${authStore.currentUserName} reverted ${action.title}.`);
}

async function redo() {
  const action = await cardsStore.redoLastAction();
  if (action?.error) {
    uiStore.showToast(action.error.message || t("common.redo"));
    return;
  }
  uiStore.showToast(action ? `${action.title} redone` : t("common.redo"));
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
      <RouterLink to="/boards" active-class="active">{{ t("nav.boards") }}</RouterLink>
      <RouterLink :to="boardBasePath" active-class="active">{{ t("nav.board") }}</RouterLink>
      <RouterLink :to="`${boardBasePath}/activity`" active-class="active">{{ t("nav.activity") }}</RouterLink>
      <RouterLink :to="`${boardBasePath}/members`" active-class="active">{{ t("nav.members") }}</RouterLink>
      <RouterLink :to="`${boardBasePath}/settings`" active-class="active">{{ t("nav.settings") }}</RouterLink>
    </nav>

    <div class="top-actions">
      <button class="ghost-button" type="button" :disabled="!cardsStore.undoHistory.length" @click="undo">{{ t("common.undo") }}</button>
      <button class="ghost-button" type="button" :disabled="!cardsStore.redoHistory.length" @click="redo">{{ t("common.redo") }}</button>
      <RouterLink class="icon-button notification-button" to="/bonus/notifications" :aria-label="t('common.unreadNotifications', { count: uiStore.unreadNotifications.length })" :title="t('common.unreadNotifications', { count: uiStore.unreadNotifications.length })">
        <img class="notification-icon" :src="notificationButtonIcon" alt="" aria-hidden="true" />
        <span v-if="hasUnreadNotifications" class="notification-dot"></span>
      </RouterLink>
      <RouterLink class="profile-button" to="/profile" :title="`${authStore.currentUserName || t('nav.profile')} · ${authStore.currentRole}`" :aria-label="`${authStore.currentUserName || t('nav.profile')} · ${authStore.currentRole}`">
        <UserAvatar class="profile-button-avatar" :src="authStore.profile?.avatar_url || ''" :name="authStore.currentUserName" :initials="authStore.currentUserName.slice(0, 2).toUpperCase()" fill />
      </RouterLink>
    </div>
  </header>
</template>

<style scoped>
.notification-button {
  flex: 0 0 auto;
}

.notification-icon {
  display: block;
  width: 20px;
  height: 20px;
  object-fit: contain;
  pointer-events: none;
}
</style>
