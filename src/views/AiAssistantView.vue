<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { generateAiSubtasks, prioritizeBoardCards } from "../services/aiAssistantService";
import { t } from "../services/localization";
import { useAuthStore } from "../stores/auth";
import { useBoardsStore } from "../stores/boards";
import { useCardsStore } from "../stores/cards";
import { useUiStore } from "../stores/ui";

const route = useRoute();
const authStore = useAuthStore();
const boardsStore = useBoardsStore();
const cardsStore = useCardsStore();
const uiStore = useUiStore();

const mode = ref("subtasks");
const prompt = ref("Turn the selected card into a checklist with review-ready steps.");
const selectedCardId = ref("");
const outputItems = ref([]);
const loading = ref(false);
const saving = ref(false);
const pageLoading = ref(false);
const pageMessage = ref("");
const pageError = ref("");

const selectedBoard = computed(() => boardsStore.selectedBoard);
const currentBoardCards = computed(() =>
  cardsStore.cards
    .filter((card) => card.boardId === boardsStore.selectedBoardId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.title.localeCompare(b.title))
);
const selectedCard = computed(() => currentBoardCards.value.find((card) => card.id === selectedCardId.value) || currentBoardCards.value[0] || null);
const savedChecklistItems = computed(() => (selectedCard.value ? cardsStore.checklistForCard(selectedCard.value.id) : []));
const modeLabel = computed(() => (mode.value === "subtasks" ? t("ai.subtasks") : t("ai.priority")));
const actionLabel = computed(() => (loading.value ? t("ai.generating") : t("ai.generate")));
const canGenerate = computed(() => !loading.value && (mode.value === "priority" ? currentBoardCards.value.length > 0 : Boolean(selectedCard.value)));
const canSave = computed(() => mode.value === "subtasks" && outputItems.value.length > 0 && selectedCard.value?.id && authStore.canMutateCards && !saving.value);

watch(
  () => boardsStore.selectedBoardId,
  async (boardId) => {
    if (!boardId) return;
    await loadBoardData(boardId);
  },
  { immediate: true }
);

watch(currentBoardCards, (cards) => {
  if (!cards.length) {
    selectedCardId.value = "";
    return;
  }
  const queryCardId = String(route.query.cardId || "");
  if (queryCardId && cards.some((card) => card.id === queryCardId)) selectedCardId.value = queryCardId;
  else if (!cards.some((card) => card.id === selectedCardId.value)) selectedCardId.value = cards[0].id;
});

async function loadBoardData(boardId) {
  pageLoading.value = true;
  await boardsStore.loadBoard(boardId);
  await boardsStore.loadColumns(boardId);
  await cardsStore.loadCards(boardId);
  pageLoading.value = false;
}

function cardPayload(card) {
  return {
    id: card.id,
    title: card.title,
    description: card.description,
    column: card.column,
    status: card.status,
    position: card.position
  };
}

async function generateRecommendations() {
  if (!canGenerate.value) return;

  loading.value = true;
  pageError.value = "";
  pageMessage.value = "";
  try {
    const items =
      mode.value === "subtasks"
        ? await generateAiSubtasks({ prompt: prompt.value.trim(), card: cardPayload(selectedCard.value) })
        : await prioritizeBoardCards({
            prompt: prompt.value.trim(),
            cards: currentBoardCards.value.map(cardPayload)
          });

    outputItems.value = items;
    uiStore.showToast(mode.value === "subtasks" ? t("ai.aiPreparedSubtasks") : t("ai.aiPreparedPriorities"));
  } catch (error) {
    outputItems.value = [];
    pageError.value = `AI error: ${error.message || "try again later"}`;
    uiStore.showToast("AI error");
  } finally {
    loading.value = false;
  }
}

async function saveGeneratedItems() {
  if (!canSave.value) return;
  saving.value = true;
  pageError.value = "";
  const result = await cardsStore.saveChecklistItemsToCard(selectedCard.value.id, outputItems.value);
  saving.value = false;
  if (result.error === "viewer") {
    pageError.value = "You do not have permission to save subtasks";
    return;
  }
  if (result.error) {
    pageError.value = result.error.code === "MIGRATION_REQUIRED" ? result.error.message : `Save failed: ${result.error.message || result.error}`;
    return;
  }
  pageMessage.value = result.items.length ? t("ai.aiSaved") : "Subtasks already exist on the card";
  uiStore.showToast(t("ai.aiSaved"));
}

onMounted(async () => {
  await authStore.initialize();
  const initialBoardId = boardsStore.selectedBoardId;
  const queryBoardId = String(route.query.boardId || "");
  if (!boardsStore.boards.length) await boardsStore.loadBoards();
  if (queryBoardId) boardsStore.selectBoard(queryBoardId);
  else if (!initialBoardId) boardsStore.selectBoard(null);
  if (boardsStore.selectedBoardId) await loadBoardData(boardsStore.selectedBoardId);
  const queryCardId = String(route.query.cardId || "");
  if (queryCardId) selectedCardId.value = queryCardId;
});
</script>

<template>
  <section class="board-hero" data-component="AiAssistantHeader">
    <div>
      <p class="kicker">{{ t("ai.title") }}</p>
      <h2>{{ t("ai.body") }}</h2>
    </div>
    <div class="board-meta">
      <span class="status-badge synced">SUPABASE FUNCTION</span>
      <span class="status-badge online">DEEPSEEK SERVER-SIDE</span>
    </div>
  </section>

  <section v-if="boardsStore.setupRequired" class="panel empty-state informative">
    <strong>Supabase is not configured</strong>
    <span>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before using the AI Assistant.</span>
  </section>

  <section v-else-if="pageLoading" class="panel empty-state informative">
    <strong>{{ t("board.loading") }}</strong>
    <span>Reading board columns and cards before sending context to the Edge Function.</span>
  </section>

  <section v-else-if="!selectedBoard" class="panel empty-state informative">
    <strong>{{ t("ai.noBoardSelected") }}</strong>
    <span>{{ t("ai.addCardsFirst") }}</span>
    <RouterLink class="button secondary" to="/boards">{{ t("ai.openBoards") }}</RouterLink>
  </section>

  <section v-else class="page-grid two-col ai-workspace" data-component="AiAssistant">
    <div class="panel ai-panel">
      <div class="segmented" role="tablist" aria-label="AI mode">
        <button type="button" :class="{ active: mode === 'subtasks' }" @click="mode = 'subtasks'">{{ t("ai.subtasks") }}</button>
        <button type="button" :class="{ active: mode === 'priority' }" @click="mode = 'priority'">{{ t("ai.priority") }}</button>
      </div>

      <label v-if="mode === 'subtasks'">
        {{ t("ai.selectedCard") }}
        <select v-model="selectedCardId" class="input" :disabled="!currentBoardCards.length || loading">
          <option v-for="card in currentBoardCards" :key="card.id" :value="card.id">
            {{ card.title }}
          </option>
        </select>
      </label>

      <label>
        {{ t("ai.prompt") }}
        <textarea v-model="prompt" class="input textarea" :disabled="loading"></textarea>
      </label>

      <button class="button primary" type="button" :disabled="!canGenerate" @click="generateRecommendations">
        {{ actionLabel }}
      </button>

      <p class="security-note">{{ t("ai.deepSeekNote") }}</p>
    </div>

    <div class="panel">
      <div class="panel-header ai-result-header">
        <div>
          <p class="kicker">{{ selectedBoard.name }}</p>
          <h2>{{ modeLabel }}</h2>
        </div>
        <span class="status-badge" :class="mode === 'subtasks' ? 'live' : 'synced'">{{ t("ai.noCardsInScope", { count: currentBoardCards.length }) }}</span>
      </div>

      <div v-if="selectedCard" class="task-card static">
        <span class="status-badge live">{{ selectedCard.column }}</span>
        <h3>{{ selectedCard.title }}</h3>
        <p>{{ selectedCard.description || t("ai.noDescription") }}</p>
      </div>

      <section v-else class="empty-state informative">
        <strong>{{ t("ai.noCardsAvailable") }}</strong>
        <span>{{ t("ai.addCardsFirst") }}</span>
      </section>

      <div v-if="pageError" class="empty-state error-state compact" role="alert">
        <strong>{{ t("common.error") }}</strong>
        <span>{{ pageError }}</span>
      </div>
      <div v-if="pageMessage" class="empty-state compact">
        <strong>{{ pageMessage }}</strong>
        <span>{{ t("ai.savedChecklist") }}</span>
      </div>

      <h2>{{ t("ai.generated") }}</h2>
      <ul v-if="outputItems.length" class="checklist" aria-live="polite">
        <li v-for="item in outputItems" :key="item">{{ item }}</li>
      </ul>
      <section v-else class="empty-state informative compact">
        <strong>{{ t("ai.noGenerated") }}</strong>
        <span>{{ t("ai.chooseModeAndGenerate") }}</span>
      </section>
      <button v-if="mode === 'subtasks'" class="button primary" type="button" :disabled="!canSave" @click="saveGeneratedItems">
        {{ saving ? t("common.saving") : t("ai.saveToCard") }}
      </button>

      <h2>{{ t("ai.savedChecklist") }}</h2>
      <ul v-if="savedChecklistItems.length" class="checklist saved-checklist">
        <li v-for="item in savedChecklistItems" :key="item.id" :class="{ done: item.isDone }">{{ item.title }}</li>
      </ul>
      <section v-else class="empty-state informative compact">
        <strong>{{ t("ai.noSavedChecklist") }}</strong>
        <span>{{ t("ai.chooseModeAndGenerate") }}</span>
      </section>
    </div>
  </section>
</template>
