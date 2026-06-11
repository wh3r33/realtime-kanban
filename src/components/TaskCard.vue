<script setup>
import { computed } from "vue";
import UserAvatar from "./UserAvatar.vue";
import { badgeClass } from "../utils/badges";
import { useCardsStore } from "../stores/cards";
import { useMembersStore } from "../stores/members";

const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  canMutate: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(["open", "drag-start", "drag-end", "drop-on", "move-left", "move-right"]);
const cardsStore = useCardsStore();
const membersStore = useMembersStore();
const assignee = computed(() => membersStore.memberById(props.task.assigneeId));
const editor = computed(() => membersStore.editorForCard(props.task.id));
const lock = computed(() => membersStore.lockForCard(props.task.id));
const labels = computed(() => Array.from(new Set([...(props.task.labels || []), props.task.status?.toUpperCase()].filter(Boolean))));
const checklistSummary = computed(() => cardsStore.checklistSummaryForCard(props.task.id));
const checklistPreview = computed(() => checklistSummary.value.open.slice(0, 2));
const stateClass = computed(() => ({
  "conflict-state": props.task.status === "conflict",
  "locked-state": props.task.status === "locked",
  pending: props.task.pending
}));
</script>

<template>
  <article
    class="task-card"
    :class="stateClass"
    :draggable="canMutate"
    data-component="TaskCard"
    tabindex="0"
    :aria-label="`${task.title}, ${task.column} column`"
    @click="emit('open', task.id)"
    @keydown.enter.prevent="emit('open', task.id)"
    @keydown.space.prevent="emit('open', task.id)"
    @dragstart="canMutate && emit('drag-start', task.id)"
    @dragend="emit('drag-end')"
    @dragover.prevent.stop
    @drop.prevent.stop="emit('drop-on', { taskId: task.id, event: $event })"
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
    <div v-if="checklistSummary.total" class="card-checklist-preview" aria-label="Checklist preview">
      <div class="checklist-count-row">
        <strong>{{ checklistSummary.total }} subtasks</strong>
        <span>{{ checklistSummary.completed }}/{{ checklistSummary.total }} done</span>
      </div>
      <ul>
        <li v-for="item in checklistPreview" :key="item.id">{{ item.title }}</li>
      </ul>
    </div>
    <div class="live-line" aria-hidden="true"></div>
    <div class="card-meta">
      <span class="assignee">
        <UserAvatar class="tiny-avatar user-avatar" :src="assignee.avatarUrl || ''" :name="assignee.name" :initials="assignee.initials" />
        {{ assignee.name }}
      </span>
      <span class="status-badge" :class="badgeClass(task.status)">{{ task.status.toUpperCase() }}</span>
    </div>
    <div class="card-move-actions" aria-label="Keyboard card movement">
      <button type="button" class="mini-move-button" aria-label="Move card left" :disabled="!canMutate" @click.stop="emit('move-left')">←</button>
      <button type="button" class="mini-move-button" aria-label="Move card right" :disabled="!canMutate" @click.stop="emit('move-right')">→</button>
    </div>
  </article>
</template>
