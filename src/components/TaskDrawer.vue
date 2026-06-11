<script setup>
import { computed } from "vue";
import { useCardsStore } from "../stores/cards";
import { useMembersStore } from "../stores/members";

const cardsStore = useCardsStore();
const membersStore = useMembersStore();
const task = computed(() => cardsStore.selectedCard);
const comments = computed(() => (task.value ? cardsStore.commentsFor(task.value.id) : []));
</script>

<template>
  <aside
    class="task-drawer glass"
    :class="{ open: task }"
    data-component="TaskDrawer"
    role="dialog"
    aria-modal="true"
    aria-labelledby="drawerTitle"
    :aria-hidden="!task"
  >
    <div class="drawer-header">
      <div>
        <p class="kicker">Task Detail</p>
        <h3 id="drawerTitle">{{ task?.title || "Select a task" }}</h3>
      </div>
      <button class="icon-button" type="button" aria-label="Close task drawer" @click="cardsStore.closeCard">
        <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
    <div v-if="task" class="drawer-content">
      <p>{{ task.description }}</p>
      <div class="drawer-row">
        <span>Status</span>
        <strong>{{ task.status.toUpperCase() }}</strong>
      </div>
      <div class="drawer-row">
        <span>Column</span>
        <strong>{{ task.column }}</strong>
      </div>
      <div class="drawer-row">
        <span>Assignee</span>
        <strong>{{ membersStore.memberById(task.assigneeId).name }}</strong>
      </div>
      <div class="drawer-section">
        <h4>Comments</h4>
        <div v-for="comment in comments" :key="comment.id" class="comment">
          <span class="tiny-avatar" :style="{ '--ring': membersStore.memberById(comment.authorId).color }">
            {{ membersStore.memberById(comment.authorId).initials }}
          </span>
          <div>
            <strong>{{ membersStore.memberById(comment.authorId).name }}</strong>
            <p>{{ comment.body }}</p>
            <time>{{ comment.createdAt }}</time>
          </div>
        </div>
      </div>
      <div class="drawer-section">
        <h4>History</h4>
        <p v-for="item in task.history" :key="item">{{ item }}</p>
      </div>
    </div>
  </aside>
</template>
