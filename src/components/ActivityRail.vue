<script setup>
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";

const membersStore = useMembersStore();
const uiStore = useUiStore();
</script>

<template>
  <aside class="activity-rail glass" data-component="ActivityRail">
    <div class="rail-section">
      <p class="rail-label">Presence</p>
      <div class="editing-now">
        <div class="editing-item" data-component="EditingPresenceItem">
          <strong>Presence not connected</strong>
          <span v-if="!membersStore.presenceConnected">Online and editing indicators are hidden until Supabase presence is implemented.</span>
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
        <div v-if="!uiStore.activityEvents.length" class="activity-item">
          <strong>No activity yet</strong>
          <span>Only Supabase activity_logs rows appear here.</span>
        </div>
      </div>
    </div>
  </aside>
</template>
