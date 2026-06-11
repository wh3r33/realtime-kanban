<script setup>
defineProps({
  code: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  }
});
</script>

<template>
  <section class="system-state">
    <div class="loading-panel glass">
      <span class="system-code">{{ code }}</span>
      <h1>{{ title }}</h1>
      <p>{{ message }}</p>
      <div v-if="code === 'SYNC'" class="loading-orbit" aria-label="Loading">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <RouterLink class="button primary" to="/boards">Back to boards</RouterLink>
    </div>
  </section>
</template>
