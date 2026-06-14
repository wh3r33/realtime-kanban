<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import TaskCard from "../components/TaskCard.vue";
import { badgeClass } from "../utils/badges";
import { useAuthStore } from "../stores/auth";
import { useBoardsStore } from "../stores/boards";
import { useCardsStore } from "../stores/cards";
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";
import { t } from "../services/localization";

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
const fallbackIntervalId = ref(null);
let boardSessionVersion = 0;

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
    await initializeBoardSession(boardId);
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

async function refreshRailFallbackData(boardId = boardsStore.selectedBoardId) {
  if (!boardId) return;
  if (cardsStore.realtime.mode === "reconnecting" || !cardsStore.realtime.unsubscribe) {
    cardsStore.initializeRealtime(boardId);
  }
  await Promise.all([
    boardsStore.loadColumns(boardId),
    cardsStore.loadCards(boardId),
    membersStore.loadMembers(boardId),
    uiStore.loadActivity(boardId)
  ]);
  cardsStore.trackPresence({
    boardId,
    cardId: cardsStore.selectedCardId || null,
    mode: cardsStore.selectedCardId ? "editing" : "viewing",
    field: cardsStore.selectedCardId ? "card" : null
  });
}

function stopFallbackPolling() {
  if (!fallbackIntervalId.value) return;
  window.clearInterval(fallbackIntervalId.value);
  fallbackIntervalId.value = null;
}

function startFallbackPolling(boardId) {
  stopFallbackPolling();
  fallbackIntervalId.value = window.setInterval(() => {
    refreshRailFallbackData(boardId);
  }, 30000);
}

async function initializeBoardSession(boardId) {
  const sessionVersion = ++boardSessionVersion;
  stopFallbackPolling();
  cardsStore.disposeRealtime({ keepPresence: true });
  await loadBoardData(boardId);
  if (sessionVersion !== boardSessionVersion) return;
  cardsStore.initializeRealtime(boardId);
  await refreshRailFallbackData(boardId);
  if (sessionVersion !== boardSessionVersion) return;
  startFallbackPolling(boardId);
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
    uiStore.showToast(t("board.viewerReadOnlyShort"));
    return;
  }
  const action = await cardsStore.moveTask(draggedTaskId.value, columnId, toIndex);
  draggedTaskId.value = null;
  if (action?.error === "viewer") {
    uiStore.showToast(t("board.viewerReadOnlyShort"));
    return;
  }
  if (action?.error === "conflict") {
    uiStore.showToast(t("board.versionConflict"));
    return;
  }
  if (action?.error) {
    uiStore.showToast(action.error.message || t("board.cardMoveFailed"));
    return;
  }
  if (!action) return;
  liveMessage.value = `${action.title} moved to ${action.to}, position ${action.toPosition + 1}`;
  uiStore.showToast(`${action.title} moved to ${action.to}`);
  if (cardsStore.movementError) uiStore.showToast(`Movement persistence failed: ${cardsStore.movementError}`);
}

async function moveTaskByKeyboard(task, direction) {
  if (!canMutate.value) {
    uiStore.showToast(t("board.viewerReadOnlyShort"));
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
    uiStore.showToast(t("board.viewerReadOnlyShort"));
    return;
  }
  if (result.error) {
    uiStore.showToast(result.error.message || t("board.cardCreationFailed"));
    return;
  }
  if (!result.card) return;
  uiStore.showToast(result.queued ? t("board.cardQueuedOffline") : `${result.card.title} added`);
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
    uiStore.showToast(t("board.createDefaultColumns"));
  }
}

onMounted(async () => {
  await authStore.initialize();
  newCard.value.assigneeId = authStore.currentUserId;
  cardsStore.setOnlineStatus(typeof navigator === "undefined" ? true : navigator.onLine);
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
});

onBeforeUnmount(() => {
  boardSessionVersion += 1;
  stopFallbackPolling();
  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);
  cardsStore.disposeRealtime();
});

function handleOnline() {
  cardsStore.setOnlineStatus(true);
  uiStore.showToast(t("board.connectionRestored"));
}

function handleOffline() {
  cardsStore.setOnlineStatus(false);
  uiStore.showToast(t("board.connectionLost"));
}
</script>

<template>
  <section class="board-hero" data-component="BoardHeader">
    <div>
      <p class="kicker">{{ selectedBoard?.name || t("nav.board") }}</p>
      <h2>{{ selectedBoard ? t("board.workSurface") : t("board.notFound") }}</h2>
    </div>
    <div class="board-meta">
      <span class="status-badge" :class="badgeClass(uiStore.syncState)">{{ uiStore.syncState.toUpperCase() }}</span>
      <span class="status-badge" :class="badgeClass(authStore.currentRole)">{{ authStore.currentRole.toUpperCase() }}</span>
      <span>{{ uiStore.syncText }}</span>
    </div>
  </section>

  <section v-if="pageLoading" class="panel empty-state informative">
    <strong>{{ t("board.loading") }}</strong>
    <span>{{ t("board.loadingBody") }}</span>
  </section>

  <section v-else-if="!selectedBoard" class="panel empty-state informative">
    <strong>{{ t("board.notFound") }}</strong>
    <span>{{ t("board.notFound") }}</span>
  </section>

  <section v-else-if="!boardsStore.columns.length" class="panel empty-state informative">
    <strong>{{ t("board.noColumns") }}</strong>
    <span>{{ t("board.noColumnsBody") }}</span>
    <button class="button secondary" type="button" :disabled="!canMutate" @click="setupColumns">{{ t("board.createDefaultColumns") }}</button>
  </section>

  <section v-if="selectedBoard && boardsStore.columns.length" class="board-filters panel compact-panel">
    <input v-model="filters.query" class="input" type="search" :placeholder="t('board.searchPlaceholder')" />
    <select v-model="filters.assigneeId" class="input">
      <option value="">{{ t("board.allAssignees") }}</option>
      <option v-for="member in membersStore.members" :key="member.id" :value="member.id">{{ member.name }}</option>
    </select>
    <select v-model="filters.label" class="input">
      <option value="">{{ t("board.allLabels") }}</option>
      <option v-for="label in availableLabels" :key="label" :value="label">{{ label }}</option>
    </select>
    <select v-model="filters.status" class="input">
      <option value="">{{ t("board.allStatuses") }}</option>
      <option value="active">{{ t("board.statusActive") }}</option>
      <option value="blocked">{{ t("board.statusBlocked") }}</option>
      <option value="done">{{ t("board.statusDone") }}</option>
    </select>
    <span class="status-badge" :class="cardsStore.offline.isOnline ? 'synced' : 'offline'">
      {{ cardsStore.offline.isOnline ? t("board.online") : `${cardsStore.offline.queue.length} ${t("board.offlinePrefix")}` }}
    </span>
  </section>

  <form v-if="selectedBoard && boardsStore.columns.length" class="quick-card-form" data-component="CreateCardForm" @submit.prevent="addCard">
    <label>
      {{ t("board.titleField") }}
      <input v-model="newCard.title" class="input" :disabled="!canMutate" :placeholder="t('board.newCardTitle')" required />
    </label>
    <label>
      {{ t("board.descriptionField") }}
      <input v-model="newCard.description" class="input" :disabled="!canMutate" :placeholder="t('board.newCardDescription')" required />
    </label>
    <label>
      {{ t("board.columnField") }}
      <select v-model="newCard.columnId" class="input" :disabled="!canMutate">
        <option v-for="column in boardsStore.columns" :key="column.id" :value="column.id">{{ column.title }}</option>
      </select>
    </label>
    <label>
      {{ t("board.assigneeField") }}
      <select v-model="newCard.assigneeId" class="input" :disabled="!canMutate">
        <option :value="null">{{ t("board.unassigned") }}</option>
        <option v-for="member in membersStore.members" :key="member.id" :value="member.id">{{ member.name }}</option>
      </select>
    </label>
    <label>
      {{ t("board.labelsField") }}
      <input v-model="newCard.labelsText" class="input" :disabled="!canMutate" :placeholder="t('board.labelsPlaceholder')" />
    </label>
    <button class="button primary" type="submit" :disabled="!canMutate">{{ t("board.addCard") }}</button>
    <span v-if="!canMutate" class="permission-note">{{ t("board.viewerReadOnlyShort") }}</span>
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
          <strong>{{ t("board.noCardsHere") }}</strong>
          <span>{{ t("board.createCardHint", { column: column.title }) }}</span>
        </div>
      </div>
    </article>
  </section>
</template>
