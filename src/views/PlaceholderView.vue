<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  eyebrow: {
    type: String,
    default: "realtime-kanban"
  }
});
</script>

<template>
  <section class="board-hero">
    <div>
      <p class="kicker">{{ eyebrow }}</p>
      <h2>{{ title }}</h2>
    </div>
    <div class="board-meta">
      <span class="status-badge live">MIGRATED ROUTE</span>
      <span class="status-badge online">VUE</span>
    </div>
  </section>
  <section class="empty-state informative">
    <strong>{{ title }} route is configured</strong>
    <span>This view is ready for the next migration pass. The board page is migrated first with functional mock data.</span>
  </section>
</template>
