<script setup>
import { computed, ref } from "vue";
import { useAuthStore } from "../stores/auth";
import { useUiStore } from "../stores/ui";

const authStore = useAuthStore();
const uiStore = useUiStore();
const initials = computed(() => (authStore.currentUserName || "US").slice(0, 2).toUpperCase());
const preferences = ref({
  theme: uiStore.theme,
  glass: true,
  reducedMotion: false,
  conflicts: true,
  mentions: true,
  summary: false
});
</script>

<template>
  <section class="profile-hero">
    <span class="avatar large">{{ initials }}</span>
    <div>
      <p class="kicker">Profile</p>
      <h1>{{ authStore.currentUserName || "No Supabase user" }}</h1>
      <p>{{ authStore.profile?.email || "Profile loads from public.profiles" }}</p>
    </div>
  </section>

  <section class="page-grid two-col">
    <div class="panel">
      <h2>Theme controls</h2>
      <label>
        Interface theme
        <select v-model="preferences.theme" class="input" @change="uiStore.setTheme(preferences.theme)">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
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
        <span class="status-badge synced">SUPABASE</span>
      </div>
      <div class="compact-list">
        <p><strong>Current browser</strong> Supabase auth session</p>
      </div>
    </div>

    <div class="panel stats-row">
      <div>
        <strong>0</strong>
        <span>cards moved</span>
      </div>
      <div>
        <strong>0</strong>
        <span>conflicts resolved</span>
      </div>
      <div>
        <strong>0h</strong>
        <span>focus time</span>
      </div>
      <button class="button secondary" type="button" @click="uiStore.showToast('Profile preferences saved')">Save profile</button>
    </div>
  </section>
</template>
