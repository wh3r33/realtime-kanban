<script setup>
import { useUiStore } from "../stores/ui";

const uiStore = useUiStore();
</script>

<template>
  <section class="page-header">
    <div class="header-line">
      <p class="kicker">Notifications</p>
      <div class="board-meta">
        <span class="status-badge live">{{ uiStore.unreadNotifications.length }} UNREAD</span>
        <span class="status-badge viewer">NOT CONNECTED</span>
      </div>
    </div>
    <h1>Realtime events that need attention.</h1>
    <p>Notifications are empty until a real notification table or service is connected.</p>
  </section>

  <section class="notification-list">
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
    <div v-if="!uiStore.notifications.length" class="empty-state informative">
      <strong>No notifications</strong>
      <span>No fake notifications are shown.</span>
    </div>
  </section>
</template>
