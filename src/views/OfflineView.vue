<script setup>
import { onBeforeUnmount, onMounted } from "vue";
import { useCardsStore } from "../stores/cards";
import { useUiStore } from "../stores/ui";

const cardsStore = useCardsStore();
const uiStore = useUiStore();

function syncOnlineState() {
  cardsStore.setOnlineStatus(typeof navigator === "undefined" ? true : navigator.onLine);
}

async function retrySync() {
  await cardsStore.flushOfflineQueue();
  uiStore.showToast(cardsStore.offline.queue.length ? "Часть очереди не синхронизирована" : "Офлайн-очередь синхронизирована");
}

onMounted(() => {
  syncOnlineState();
  window.addEventListener("online", syncOnlineState);
  window.addEventListener("offline", syncOnlineState);
});

onBeforeUnmount(() => {
  window.removeEventListener("online", syncOnlineState);
  window.removeEventListener("offline", syncOnlineState);
});
</script>

<template>
  <section class="page-header">
    <p class="kicker">Offline Mode</p>
    <h1>Lightweight offline queue.</h1>
    <p>Card create, edit, move, and delete actions are queued while the browser is offline and retried when the connection returns.</p>
  </section>

  <section class="page-grid two-col">
    <article class="panel">
      <div class="panel-header">
        <h2>Connection</h2>
        <span class="status-badge" :class="cardsStore.offline.isOnline ? 'synced' : 'offline'">
          {{ cardsStore.offline.isOnline ? "ONLINE" : "OFFLINE" }}
        </span>
      </div>
      <p>{{ cardsStore.offline.isOnline ? "Supabase requests run immediately." : "New card mutations stay local until retry." }}</p>
      <button class="button primary" type="button" :disabled="cardsStore.offline.syncing || !cardsStore.offline.queue.length" @click="retrySync">
        {{ cardsStore.offline.syncing ? "Syncing..." : "Retry sync" }}
      </button>
    </article>

    <article class="panel">
      <div class="panel-header">
        <h2>Pending changes</h2>
        <span class="status-badge queued">{{ cardsStore.offline.queue.length }}</span>
      </div>
      <div class="compact-list">
        <p v-for="item in cardsStore.offline.queue" :key="item.id">
          <strong>{{ item.type }}</strong> {{ new Date(item.createdAt).toLocaleString() }}
        </p>
        <div v-if="!cardsStore.offline.queue.length" class="empty-state compact">
          <strong>Очередь пуста</strong>
          <span>Нет локальных действий, ожидающих Supabase.</span>
        </div>
      </div>
    </article>
  </section>
</template>
