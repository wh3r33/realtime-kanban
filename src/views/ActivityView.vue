<script setup>
import { computed, onMounted, ref } from "vue";
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
  card_updated: "cards",
  card_created: "cards",
  card_deleted: "cards",
  conflict_detected: "conflicts",
  invite_accepted: "members",
  board_created: "system"
};

const timeline = computed(() => [
  ...uiStore.activityEvents.map((event) => ({
    ...event,
    category: categoryByType[event.type] || "system",
    actor: membersStore.memberById(event.actorId)
  }))
]);

const filteredTimeline = computed(() =>
  activeFilter.value === "all" ? timeline.value : timeline.value.filter((event) => event.category === activeFilter.value)
);

onMounted(async () => {
  await uiStore.loadActivity(boardsStore.selectedBoardId);
});
</script>

<template>
  <section class="page-header">
    <p class="kicker">History of Changes</p>
    <h1>{{ boardsStore.selectedBoard?.name || "Board" }} activity</h1>
    <p>Only rows from public.activity_logs are shown here.</p>
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
      <strong>No activity</strong>
      <span>No Supabase activity log rows match this filter.</span>
    </div>
  </section>
</template>
