<script setup>
import { useUiStore } from "../stores/ui";

const uiStore = useUiStore();
</script>

<template>
  <div class="toast-stack">
    <div v-for="toast in uiStore.toasts" :key="toast.id" class="toast">
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>
