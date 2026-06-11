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
const newCard = ref({ title: "", description: "", columnId: "", assigneeId: null, labelsText: "" });
const pageLoading = ref(false);
const filters = ref({ query: "", assigneeId: "", label: "", status: "" });

const currentBoardCards = computed(() => cardsStore.cards.filter((task) => task.boardId === boardsStore.selectedBoardId));
const availableLabels = computed(() => Array.from(new Set(currentBoardCards.value.flatMap((card) => card.labels || []))).sort());
const filteredBoardCards = computed(() => {
  const query = filters.value.query.trim().toLowerCase();
  return currentBoardCards.value.filter((card) => {
    const matchesQuery = !query || `${card.title} ${card.description}`.toLowerCase().includes(query);
    const matchesAssignee = !filters.value.assigneeId || card.assigneeId === filters.value.assigneeId;
    const matchesLabel = !filters.value.label || (card.labels || []).includes(filters.value.label);
    const matchesStatus = !filters.value.status || card.status === filters.value.status;
    return matchesQuery && matchesAssignee && matchesLabel && matchesStatus;
  });
});
const cardsByColumn = computed(() =>
  boardsStore.columns.map((column) => ({
    ...column,
    cards: filteredBoardCards.value
      .filter((card) => card.columnId === column.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.title.localeCompare(b.title))
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

function labelsFromText(value) {
  return Array.from(new Set(String(value || "").split(",").map((item) => item.trim()).filter(Boolean)));
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
  if (action?.error === "conflict") {
    uiStore.showToast("Конфликт версии: карточка уже изменена другим пользователем");
    return;
  }
  if (action?.error) {
    uiStore.showToast(action.error.message || "Ошибка перемещения карточки");
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
    boardId: boardsStore.selectedBoardId,
    labels: labelsFromText(newCard.value.labelsText)
  });
  if (result.error === "viewer") {
    uiStore.showToast("Viewer role cannot create cards");
    return;
  }
  if (result.error) {
    uiStore.showToast(result.error.message || "Ошибка создания карточки");
    return;
  }
  if (!result.card) return;
  uiStore.showToast(result.queued ? "Карточка добавлена в очередь офлайн" : `${result.card.title} added`);
  newCard.value = { title: "", description: "", columnId: boardsStore.columns[0]?.id || "", assigneeId: authStore.currentUserId, labelsText: "" };
}

function dropOnTask(column, task, event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const after = event.clientY > rect.top + rect.height / 2;
  const visibleCards = cardsByColumn.value.find((item) => item.id === column.id)?.cards || [];
  const taskIndex = visibleCards.findIndex((card) => card.id === task.id);
  const draggedIndex = visibleCards.findIndex((card) => card.id === draggedTaskId.value);
  let targetIndex = taskIndex + (after ? 1 : 0);
  if (column.id === cardsStore.cardById(draggedTaskId.value)?.columnId && draggedIndex >= 0 && draggedIndex < targetIndex) targetIndex -= 1;
  moveTask(column.id, targetIndex);
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
  cardsStore.setOnlineStatus(typeof navigator === "undefined" ? true : navigator.onLine);
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
});

onBeforeUnmount(() => {
  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);
  cardsStore.realtime.untrack?.();
  cardsStore.realtime.unsubscribe?.();
});

function handleOnline() {
  cardsStore.setOnlineStatus(true);
  uiStore.showToast("Соединение восстановлено. Очередь синхронизируется.");
}

function handleOffline() {
  cardsStore.setOnlineStatus(false);
  uiStore.showToast("Нет соединения. Новые действия будут поставлены в очередь.");
}
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

  <section v-if="selectedBoard && boardsStore.columns.length" class="board-filters panel compact-panel">
    <input v-model="filters.query" class="input" type="search" placeholder="Поиск по карточкам" />
    <select v-model="filters.assigneeId" class="input">
      <option value="">Все исполнители</option>
      <option v-for="member in membersStore.members" :key="member.id" :value="member.id">{{ member.name }}</option>
    </select>
    <select v-model="filters.label" class="input">
      <option value="">Все метки</option>
      <option v-for="label in availableLabels" :key="label" :value="label">{{ label }}</option>
    </select>
    <select v-model="filters.status" class="input">
      <option value="">Все статусы</option>
      <option value="active">active</option>
      <option value="blocked">blocked</option>
      <option value="done">done</option>
    </select>
    <span class="status-badge" :class="cardsStore.offline.isOnline ? 'synced' : 'offline'">
      {{ cardsStore.offline.isOnline ? 'ONLINE' : `${cardsStore.offline.queue.length} OFFLINE` }}
    </span>
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
    <label>
      Assignee
      <select v-model="newCard.assigneeId" class="input" :disabled="!canMutate">
        <option :value="null">Unassigned</option>
        <option v-for="member in membersStore.members" :key="member.id" :value="member.id">{{ member.name }}</option>
      </select>
    </label>
    <label>
      Labels
      <input v-model="newCard.labelsText" class="input" :disabled="!canMutate" placeholder="frontend, urgent" />
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
          @drag-end="draggedTaskId = null"
          @drop-on="dropOnTask(column, task, $event.event)"
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
