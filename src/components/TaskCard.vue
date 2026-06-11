<script setup>
import { computed } from "vue";
import { badgeClass } from "../data/mockData";
import { useMembersStore } from "../stores/members";

const props = defineProps({
  task: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(["open", "drag-start", "move-left", "move-right"]);
const membersStore = useMembersStore();
const assignee = computed(() => membersStore.memberById(props.task.assigneeId));
const editor = computed(() => membersStore.editorForCard(props.task.id));
const lock = computed(() => membersStore.lockForCard(props.task.id));
const labels = computed(() => Array.from(new Set([...(props.task.labels || []), props.task.status.toUpperCase()])));
const stateClass = computed(() => ({
  "conflict-state": props.task.status === "conflict",
  "locked-state": props.task.status === "locked"
}));
</script>

<template>
  <article
    class="task-card"
    :class="stateClass"
    draggable="true"
    data-component="TaskCard"
    tabindex="0"
    :aria-label="`${task.title}, ${task.column} column`"
    @click="emit('open', task.id)"
    @keydown.enter.prevent="emit('open', task.id)"
    @keydown.space.prevent="emit('open', task.id)"
    @dragstart="emit('drag-start', task.id)"
  >
    <div class="card-badges">
      <span v-for="label in labels" :key="label" class="status-badge" :class="badgeClass(label)">{{ label }}</span>
    </div>
    <div>
      <h3>{{ task.title }}</h3>
      <p>{{ task.description }}</p>
    </div>
    <div v-if="editor" class="ownership-line">
      <strong>{{ membersStore.memberById(editor.userId).name }}</strong> {{ editor.mode }} · {{ editor.duration }}
    </div>
    <div v-if="lock" class="ownership-line locked">
      <strong>Locked by {{ membersStore.memberById(lock.userId).name }}</strong> · {{ lock.duration }}
    </div>
    <div class="live-line" aria-hidden="true"></div>
    <div class="card-meta">
      <span class="assignee">
        <span class="tiny-avatar" :style="{ '--ring': assignee.color }">{{ assignee.initials }}</span>
        {{ assignee.name }}
      </span>
      <span class="status-badge" :class="badgeClass(task.status)">{{ task.status.toUpperCase() }}</span>
    </div>
    <div class="card-move-actions" aria-label="Keyboard card movement">
      <button type="button" class="mini-move-button" aria-label="Move card left" @click.stop="emit('move-left')">←</button>
      <button type="button" class="mini-move-button" aria-label="Move card right" @click.stop="emit('move-right')">→</button>
    </div>
  </article>
</template>
