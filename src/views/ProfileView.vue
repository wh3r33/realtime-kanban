<script setup>
import { computed, ref } from "vue";
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";

const membersStore = useMembersStore();
const uiStore = useUiStore();
const profile = computed(() => membersStore.memberById("u-nn"));
const preferences = ref({
  paper: true,
  glass: true,
  reducedMotion: false,
  conflicts: true,
  mentions: true,
  summary: false
});
</script>

<template>
  <section class="profile-hero">
    <span class="avatar large" :style="{ '--ring': profile.color }">{{ profile.initials }}</span>
    <div>
      <p class="kicker">Profile</p>
      <h1>{{ profile.name }}</h1>
      <p>{{ profile.email }}</p>
    </div>
  </section>

  <section class="page-grid two-col">
    <div class="panel">
      <h2>Theme controls</h2>
      <label><input v-model="preferences.paper" type="checkbox" /> Warm paper background</label>
      <label><input v-model="preferences.glass" type="checkbox" /> Quiet glass surfaces</label>
      <label><input v-model="preferences.reducedMotion" type="checkbox" /> Reduced realtime motion</label>
    </div>

    <div class="panel">
      <h2>Notifications</h2>
      <label><input v-model="preferences.conflicts" type="checkbox" /> Conflict alerts</label>
      <label><input v-model="preferences.mentions" type="checkbox" /> Mentions and invites</label>
      <label><input v-model="preferences.summary" type="checkbox" /> Daily summary</label>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2>Active sessions</h2>
        <span class="status-badge online">CURRENT</span>
      </div>
      <div class="compact-list">
        <p><strong>Desktop browser</strong> Current session · Asia/Almaty</p>
        <p><strong>Mobile browser</strong> Last active 18m ago</p>
      </div>
    </div>

    <div class="panel stats-row">
      <div>
        <strong>42</strong>
        <span>cards moved</span>
      </div>
      <div>
        <strong>9</strong>
        <span>conflicts resolved</span>
      </div>
      <div>
        <strong>6h</strong>
        <span>focus time</span>
      </div>
      <button class="button secondary" type="button" @click="uiStore.showToast('Profile preferences saved')">Save profile</button>
    </div>
  </section>
</template>
