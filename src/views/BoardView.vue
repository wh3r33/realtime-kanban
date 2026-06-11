<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import TaskCard from "../components/TaskCard.vue";
import { badgeClass } from "../utils/badges";
import { useAuthStore } from "../stores/auth";
import { useBoardsStore } from "../stores/boards";
import { useCardsStore } from "../stores/cards";
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";

const authStore = useAuthStore();
const boardsStore = useBoardsStore();
const cardsStore = useCardsStore();
const membersStore = useMembersStore();
const uiStore = useUiStore();
const draggedTaskId = ref(null);
const liveMessage = ref("");
const newCard = ref({ title: "", description: "", columnId: "", assigneeId: null });
const pageLoading = ref(false);

const currentBoardCards = computed(() => cardsStore.cards.filter((task) => task.boardId === boardsStore.selectedBoardId));
const cardsByColumn = computed(() =>
  boardsStore.columns.map((column) => ({
    ...column,
    cards: cardsStore.cardsForColumn(boardsStore.selectedBoardId, column.id)
  }))
);
const canMutate = computed(() => authStore.canMutateCards);
const selectedBoard = computed(() => boardsStore.selectedBoard);

watch(
  () => boardsStore.selectedBoardId,
  async (boardId) => {
    if (!boardId) return;
    cardsStore.initializeRealtime(boardId);
    await loadBoardData(boardId);
  },
  { immediate: true }
);

watch(
  () => boardsStore.columns[0]?.id,
  (columnId) => {
    if (columnId && !newCard.value.columnId) newCard.value.columnId = columnId;
  },
  { immediate: true }
);

async function loadBoardData(boardId) {
  pageLoading.value = true;
  await boardsStore.loadBoard(boardId);
  await boardsStore.loadColumns(boardId);
  await cardsStore.loadCards(boardId);
  await membersStore.loadMembers(boardId);
  await uiStore.loadActivity(boardId);
  pageLoading.value = false;
}

function openTask(taskId) {
  cardsStore.selectCard(taskId);
}

async function moveTask(columnId, toIndex = Number.POSITIVE_INFINITY) {
  if (!canMutate.value) {
    draggedTaskId.value = null;
    uiStore.showToast("Viewer role can view cards only");
    return;
  }
  const action = await cardsStore.moveTask(draggedTaskId.value, columnId, toIndex);
  draggedTaskId.value = null;
  if (action?.error === "viewer") {
    uiStore.showToast("Viewer role can view cards only");
    return;
  }
  if (!action) return;
  liveMessage.value = `${action.title} moved to ${action.to}, position ${action.toPosition + 1}`;
  uiStore.showToast(`${action.title} moved to ${action.to}`);
  if (cardsStore.movementError) uiStore.showToast(`Movement persistence failed: ${cardsStore.movementError}`);
}

async function moveTaskByKeyboard(task, direction) {
  if (!canMutate.value) {
    uiStore.showToast("Viewer role can view cards only");
    return;
  }
  const currentIndex = boardsStore.columns.findIndex((column) => column.id === task.columnId);
  const targetColumn = boardsStore.columns[currentIndex + direction];
  if (!targetColumn) return;
  draggedTaskId.value = task.id;
  await moveTask(targetColumn.id);
}

async function addCard() {
  const result = await cardsStore.createCard({
    ...newCard.value,
    boardId: boardsStore.selectedBoardId
  });
  if (result.error === "viewer") {
    uiStore.showToast("Viewer role cannot create cards");
    return;
  }
  if (!result.card) return;
  uiStore.showToast(`${result.card.title} added`);
  newCard.value = { title: "", description: "", columnId: boardsStore.columns[0]?.id || "", assigneeId: authStore.currentUserId };
}

async function setupColumns() {
  const result = await boardsStore.ensureDefaultColumns(boardsStore.selectedBoardId);
  if (result.error) uiStore.showToast(result.error.message);
  else {
    newCard.value.columnId = boardsStore.columns[0]?.id || "";
    uiStore.showToast("Default columns created");
  }
}

onMounted(async () => {
  await authStore.initialize();
  await loadBoardData(boardsStore.selectedBoardId);
  newCard.value.assigneeId = authStore.currentUserId;
});

onBeforeUnmount(() => {
  cardsStore.realtime.unsubscribe?.();
});
</script>

<template>
  <section class="board-hero" data-component="BoardHeader">
    <div>
      <p class="kicker">{{ selectedBoard?.name || "Board" }}</p>
      <h2>{{ selectedBoard ? "Board work surface" : "Board not found" }}</h2>
    </div>
    <div class="board-meta">
      <span class="status-badge" :class="badgeClass(uiStore.syncState)">{{ uiStore.syncState.toUpperCase() }}</span>
      <span class="status-badge" :class="badgeClass(authStore.currentRole)">{{ authStore.currentRole.toUpperCase() }}</span>
      <span>{{ uiStore.syncText }}</span>
    </div>
  </section>

  <section v-if="pageLoading" class="panel empty-state informative">
    <strong>Loading board</strong>
    <span>Reading board, columns, cards, members, and activity from Supabase.</span>
  </section>

  <section v-else-if="!selectedBoard" class="panel empty-state informative">
    <strong>Board not found</strong>
    <span>No board row was returned for this id.</span>
  </section>

  <section v-else-if="!boardsStore.columns.length" class="panel empty-state informative">
    <strong>No columns yet</strong>
    <span>This board has no Supabase column rows.</span>
    <button class="button secondary" type="button" :disabled="!canMutate" @click="setupColumns">Create default columns</button>
  </section>

  <form v-if="selectedBoard && boardsStore.columns.length" class="quick-card-form" data-component="CreateCardForm" @submit.prevent="addCard">
    <label>
      Title
      <input v-model="newCard.title" class="input" :disabled="!canMutate" placeholder="New card title" required />
    </label>
    <label>
      Description
      <input v-model="newCard.description" class="input" :disabled="!canMutate" placeholder="What needs to happen?" required />
    </label>
    <label>
      Column
      <select v-model="newCard.columnId" class="input" :disabled="!canMutate">
        <option v-for="column in boardsStore.columns" :key="column.id" :value="column.id">{{ column.title }}</option>
      </select>
    </label>
    <button class="button primary" type="submit" :disabled="!canMutate">Add card</button>
    <span v-if="!canMutate" class="permission-note">Viewer role is read-only. Card actions are disabled.</span>
  </form>

  <section v-if="selectedBoard && boardsStore.columns.length" class="board-layout" data-component="Board">
    <p class="sr-only" aria-live="polite">{{ liveMessage }}</p>
    <article
      v-for="column in cardsByColumn"
      :key="column.id"
      class="column"
      data-component="BoardColumn"
      @dragover.prevent
      @drop="moveTask(column.id)"
    >
      <header class="column-header">
        <h3 class="column-title">{{ column.title }}</h3>
        <span class="column-count">{{ column.cards.length }}</span>
      </header>
      <div class="card-list">
        <TaskCard
          v-for="task in column.cards"
          :key="task.id"
          :task="task"
          :can-mutate="canMutate"
          @open="openTask"
          @drag-start="draggedTaskId = $event"
          @move-left="moveTaskByKeyboard(task, -1)"
          @move-right="moveTaskByKeyboard(task, 1)"
        />
        <div v-if="!column.cards.length" class="empty-state informative">
          <strong>No cards here</strong>
          <span>Create a card or move an existing Supabase card into {{ column.title }}.</span>
        </div>
      </div>
    </article>
  </section>
</template>
