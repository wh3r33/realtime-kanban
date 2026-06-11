<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import TaskCard from "../components/TaskCard.vue";
import { badgeClass } from "../data/mockData";
import { useBoardsStore } from "../stores/boards";
import { useCardsStore } from "../stores/cards";
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";

const boardsStore = useBoardsStore();
const cardsStore = useCardsStore();
const membersStore = useMembersStore();
const uiStore = useUiStore();
const draggedTaskId = ref(null);
const liveMessage = ref("");
let heartbeatTimer;

const currentBoardCards = computed(() => cardsStore.cards.filter((task) => task.boardId === boardsStore.selectedBoardId));
const cardsByColumn = computed(() =>
  boardsStore.columns.map((column) => ({
    name: column,
    cards: cardsStore.cardsForColumn(boardsStore.selectedBoardId, column)
  }))
);

function openTask(taskId) {
  cardsStore.selectCard(taskId);
}

async function moveTask(columnName, toIndex = Number.POSITIVE_INFINITY) {
  const action = await cardsStore.moveTask(draggedTaskId.value, columnName, toIndex);
  draggedTaskId.value = null;
  if (!action) return;
  uiStore.addActivity("card_moved", "Card moved", `NN User moved ${action.title} to ${action.to}.`);
  liveMessage.value = `${action.title} moved to ${action.to}, position ${action.toPosition + 1}`;
  uiStore.showToast(`${action.title} moved to ${action.to}`);
  if (cardsStore.movementError) uiStore.showToast(`Movement persistence failed: ${cardsStore.movementError}`);
}

async function moveTaskByKeyboard(task, direction) {
  const currentIndex = boardsStore.columns.indexOf(task.column);
  const targetColumn = boardsStore.columns[currentIndex + direction];
  if (!targetColumn) return;
  draggedTaskId.value = task.id;
  await moveTask(targetColumn);
}

onMounted(() => {
  uiStore.showToast("Workspace synced with live mock state");
  heartbeatTimer = window.setInterval(() => {
    uiStore.lastChanged = `Last change ${Math.floor(Math.random() * 4) + 1}s ago`;
    uiStore.setSyncState("synced", `Synced · heartbeat ${Math.floor(Math.random() * 4) + 1}s ago`);
  }, 4200);
});

onBeforeUnmount(() => {
  window.clearInterval(heartbeatTimer);
});
</script>

<template>
  <section class="board-hero" data-component="BoardHeader">
    <div>
      <p class="kicker">{{ boardsStore.selectedBoard.name }} Board</p>
      <h2>Collaboration, visible by default.</h2>
    </div>
    <div class="board-meta">
      <span class="status-badge" :class="badgeClass(uiStore.syncState)">{{ uiStore.syncState.toUpperCase() }}</span>
      <span class="status-badge online">ONLINE</span>
      <span>{{ uiStore.lastChanged }}</span>
    </div>
  </section>

  <section class="board-layout" data-component="Board">
    <p class="sr-only" aria-live="polite">{{ liveMessage }}</p>
    <article
      v-for="column in cardsByColumn"
      :key="column.name"
      class="column"
      data-component="BoardColumn"
      @dragover.prevent
      @drop="moveTask(column.name)"
    >
      <header class="column-header">
        <h3 class="column-title">{{ column.name }}</h3>
        <span class="column-count">{{ column.cards.length }}</span>
      </header>
      <div class="card-list">
        <TaskCard
          v-for="task in column.cards"
          :key="task.id"
          :task="task"
          @open="openTask"
          @drag-start="draggedTaskId = $event"
          @move-left="moveTaskByKeyboard(task, -1)"
          @move-right="moveTaskByKeyboard(task, 1)"
        />
        <div v-if="!column.cards.length" class="empty-state informative">
          <strong>No cards here</strong>
          <span>Drop a card into {{ column.name }} or wait for a teammate movement.</span>
        </div>
      </div>
    </article>
  </section>
</template>
