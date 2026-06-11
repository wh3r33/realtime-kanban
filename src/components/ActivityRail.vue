<script setup>
import { computed } from "vue";
import { useCardsStore } from "../stores/cards";
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";

const cardsStore = useCardsStore();
const membersStore = useMembersStore();
const uiStore = useUiStore();

const editingNow = computed(() =>
  membersStore.editingUsers.slice(0, 4).map((presence) => ({
    ...presence,
    member: membersStore.memberById(presence.userId),
    card: cardsStore.cardById(presence.cardId)
  }))
);
</script>

<template>
  <aside class="activity-rail glass" data-component="ActivityRail">
    <div class="rail-section">
      <p class="rail-label">Editing Now</p>
      <div class="editing-now">
        <div v-for="presence in editingNow" :key="presence.userId" class="editing-item" data-component="EditingPresenceItem">
          <strong>{{ presence.member.name }}</strong>
          <span>{{ presence.mode === "viewing" ? "Viewing" : "Editing" }} {{ presence.card?.title || "board" }} · {{ presence.duration }}</span>
        </div>
      </div>
    </div>
    <div class="rail-section">
      <p class="rail-label">Recent Activity</p>
      <div class="activity-feed">
        <div
          v-for="(event, index) in uiStore.activityEvents.slice(0, 6)"
          :key="event.id"
          class="activity-item"
          :class="{ new: index === 0 }"
          data-component="ActivityItem"
        >
          <strong>{{ event.title }}</strong>
          <span>{{ event.body }}</span>
          <time>{{ event.createdAt }}</time>
        </div>
      </div>
    </div>
  </aside>
</template>
