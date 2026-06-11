<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
  src: {
    type: String,
    default: ""
  },
  name: {
    type: String,
    default: ""
  },
  initials: {
    type: String,
    default: ""
  },
  alt: {
    type: String,
    default: ""
  },
  fill: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    default: ""
  }
});

const imageFailed = ref(false);

watch(
  () => props.src,
  () => {
    imageFailed.value = false;
  }
);

const fallback = computed(() => {
  const source = (props.initials || props.name || "US").trim();
  return source ? source.slice(0, 2).toUpperCase() : "US";
});

const canShowImage = computed(() => Boolean(props.src) && !imageFailed.value);
</script>

<template>
  <span class="user-avatar" :class="{ 'is-fill': fill }" :data-status="status || undefined">
    <img
      v-if="canShowImage"
      class="user-avatar-image"
      :src="src"
      :alt="alt || name || 'User avatar'"
      @error="imageFailed = true"
    />
    <span v-else class="user-avatar-fallback">{{ fallback }}</span>
  </span>
</template>
