<script setup>
import { computed, ref } from "vue";
import { useBoardsStore } from "../stores/boards";
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";

const boardsStore = useBoardsStore();
const membersStore = useMembersStore();
const uiStore = useUiStore();
const activeFilter = ref("all");

const filters = [
  { id: "all", label: "All" },
  { id: "cards", label: "Cards" },
  { id: "members", label: "Members" },
  { id: "conflicts", label: "Conflicts" },
  { id: "system", label: "System" }
];

const categoryByType = {
  card_moved: "cards",
  card_edited: "cards",
  conflict_detected: "conflicts",
  invite_accepted: "members",
  sync_restored: "system"
};

const timeline = computed(() => [
  ...uiStore.activityEvents.map((event) => ({
    ...event,
    category: categoryByType[event.type] || "system",
    actor: membersStore.memberById(event.actorId)
  })),
  {
    id: "evt-system-replay",
    title: "Sync restored",
    body: "Realtime channel replayed 7 pending events after reconnect.",
    createdAt: "31m",
    category: "system",
    actor: { initials: "RK", color: "#2855FF" }
  }
]);

const filteredTimeline = computed(() =>
  activeFilter.value === "all" ? timeline.value : timeline.value.filter((event) => event.category === activeFilter.value)
);
</script>

<template>
  <section class="page-header">
    <p class="kicker">History of Changes</p>
    <h1>{{ boardsStore.selectedBoard.name }} actions have a readable trail.</h1>
    <p>Filter board movement, member events, conflicts, and system sync messages without losing the surrounding context.</p>
  </section>

  <div class="filter-bar" aria-label="Activity filters">
    <button
      v-for="filter in filters"
      :key="filter.id"
      type="button"
      :class="{ active: activeFilter === filter.id }"
      @click="activeFilter = filter.id"
    >
      {{ filter.label }}
    </button>
  </div>

  <section class="timeline panel" data-component="ActivityFeed">
    <article v-for="event in filteredTimeline" :key="event.id" :data-type="event.category">
      <span class="tiny-avatar" :style="{ '--ring': event.actor.color }">{{ event.actor.initials }}</span>
      <div>
        <strong>{{ event.title }}</strong>
        <p>{{ event.body }}</p>
        <time>{{ event.createdAt }}</time>
      </div>
    </article>
    <div v-if="!filteredTimeline.length" class="empty-state compact">
      <strong>No events match this filter</strong>
      <span>Try a different activity category.</span>
    </div>
  </section>
</template>
