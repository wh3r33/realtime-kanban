<script setup>
import { onMounted } from "vue";
import { useUiStore } from "../stores/ui";
import { t } from "../services/localization";

const uiStore = useUiStore();

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "";
}

async function acceptInvite(invitation) {
  const result = await uiStore.acceptInvitation(invitation.id);
  uiStore.showToast(result.error ? result.error.message : t("messages.inviteAccepted", { board: invitation.boardName }));
}

async function declineInvite(invitation) {
  const result = await uiStore.declineInvitation(invitation.id);
  uiStore.showToast(result.error ? result.error.message : t("messages.inviteDeclined", { board: invitation.boardName }));
}

onMounted(() => {
  uiStore.loadPendingInvitations();
});
</script>

<template>
  <section class="page-header">
    <div class="header-line">
      <p class="kicker">{{ t("notifications.title") }}</p>
      <div class="board-meta">
        <span class="status-badge live">{{ t("notifications.unread", { count: uiStore.unreadNotifications.length }) }}</span>
        <span class="status-badge synced">{{ t("notifications.connected") }}</span>
      </div>
    </div>
    <h1>{{ t("notifications.heading") }}</h1>
    <p>{{ t("notifications.body") }}</p>
  </section>

  <section class="notification-list">
    <article v-for="invitation in uiStore.pendingInvitations" :key="invitation.id" class="notification invite unread">
      <div>
        <strong>{{ t("notifications.boardInvite", { board: invitation.boardName }) }}</strong>
        <p>{{ t("notifications.invitedBy", { inviter: invitation.inviterName, email: invitation.inviterEmail || invitation.inviterName }) }}</p>
        <p>{{ t("notifications.invitedRole", { role: invitation.role }) }}</p>
        <time>{{ formatDate(invitation.createdAt) }}</time>
      </div>
      <div class="notification-actions">
        <button class="button primary" type="button" @click="acceptInvite(invitation)">{{ t("notifications.accept") }}</button>
        <button class="button secondary" type="button" @click="declineInvite(invitation)">{{ t("notifications.decline") }}</button>
      </div>
    </article>

    <article
      v-for="notification in uiStore.notifications"
      :key="notification.id"
      class="notification"
      :class="[notification.type, { unread: notification.unread }]"
      tabindex="0"
      @click="uiStore.markNotificationRead(notification.id)"
      @keydown.enter.prevent="uiStore.markNotificationRead(notification.id)"
      @keydown.space.prevent="uiStore.markNotificationRead(notification.id)"
    >
      <div>
        <strong>{{ notification.title }}</strong>
        <p>{{ notification.body }}</p>
        <time>{{ notification.createdAt }}</time>
      </div>
      <span class="status-badge" :class="notification.unread ? 'live' : 'viewer'">
        {{ notification.unread ? "UNREAD" : "READ" }}
      </span>
    </article>
    <div v-if="!uiStore.pendingInvitations.length && !uiStore.notifications.length" class="empty-state informative">
      <strong>{{ t("notifications.none") }}</strong>
      <span>{{ t("notifications.noneBody") }}</span>
    </div>
  </section>
</template>
