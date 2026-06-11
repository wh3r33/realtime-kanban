<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { generateAiSubtasks, prioritizeBoardCards } from "../services/aiAssistantService";
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
const modeLabel = computed(() => (mode.value === "subtasks" ? "Break card into subtasks" : "Prioritize board"));
const actionLabel = computed(() => (loading.value ? "Generating..." : "Generate"));
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
    uiStore.showToast("AI подготовил рекомендации");
  } catch (error) {
    outputItems.value = [];
    pageError.value = `Ошибка AI: ${error.message || "попробуйте позже"}`;
    uiStore.showToast("Ошибка AI");
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
    pageError.value = "У вас нет прав на сохранение подзадач";
    return;
  }
  if (result.error) {
    pageError.value = `Ошибка сохранения: ${result.error.message || result.error}`;
    return;
  }
  pageMessage.value = result.items.length ? "AI subtasks saved to card" : "Подзадачи уже есть в карточке";
  uiStore.showToast("AI subtasks saved to card");
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
      <p class="kicker">AI assistant</p>
      <h2>Assist the board without exposing secrets.</h2>
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
    <strong>Loading board</strong>
    <span>Reading board columns and cards before sending context to the Edge Function.</span>
  </section>

  <section v-else-if="!selectedBoard" class="panel empty-state informative">
    <strong>No board selected</strong>
    <span>Open a board first to use AI with real cards.</span>
    <RouterLink class="button secondary" to="/boards">Open boards</RouterLink>
  </section>

  <section v-else class="page-grid two-col ai-workspace" data-component="AiAssistant">
    <div class="panel ai-panel">
      <div class="segmented" role="tablist" aria-label="AI mode">
        <button type="button" :class="{ active: mode === 'subtasks' }" @click="mode = 'subtasks'">Break card into subtasks</button>
        <button type="button" :class="{ active: mode === 'priority' }" @click="mode = 'priority'">Prioritize board</button>
      </div>

      <label v-if="mode === 'subtasks'">
        Card
        <select v-model="selectedCardId" class="input" :disabled="!currentBoardCards.length || loading">
          <option v-for="card in currentBoardCards" :key="card.id" :value="card.id">
            {{ card.title }}
          </option>
        </select>
      </label>

      <label>
        Prompt
        <textarea v-model="prompt" class="input textarea" :disabled="loading"></textarea>
      </label>

      <button class="button primary" type="button" :disabled="!canGenerate" @click="generateRecommendations">
        {{ actionLabel }}
      </button>

      <p class="security-note">DeepSeek is called only by the Supabase Edge Function. The frontend sends board context, never a provider key.</p>
    </div>

    <div class="panel">
      <div class="panel-header ai-result-header">
        <div>
          <p class="kicker">{{ selectedBoard.name }}</p>
          <h2>{{ modeLabel }}</h2>
        </div>
        <span class="status-badge" :class="mode === 'subtasks' ? 'live' : 'synced'">{{ currentBoardCards.length }} CARDS</span>
      </div>

      <div v-if="selectedCard" class="task-card static">
        <span class="status-badge live">{{ selectedCard.column }}</span>
        <h3>{{ selectedCard.title }}</h3>
        <p>{{ selectedCard.description || "No description provided." }}</p>
      </div>

      <section v-else class="empty-state informative">
        <strong>No cards available</strong>
        <span>Add cards to this board before asking AI for subtasks or prioritization.</span>
      </section>

      <div v-if="pageError" class="empty-state error-state compact" role="alert">
        <strong>Ошибка</strong>
        <span>{{ pageError }}</span>
      </div>
      <div v-if="pageMessage" class="empty-state compact">
        <strong>{{ pageMessage }}</strong>
        <span>Saved checklist items are visible on the board card and in the card drawer.</span>
      </div>

      <h2>Generated results</h2>
      <ul v-if="outputItems.length" class="checklist" aria-live="polite">
        <li v-for="item in outputItems" :key="item">{{ item }}</li>
      </ul>
      <section v-else class="empty-state informative compact">
        <strong>No generated results yet</strong>
        <span>Choose a mode and click Generate. Results are separate from saved checklist items.</span>
      </section>
      <button v-if="mode === 'subtasks'" class="button primary" type="button" :disabled="!canSave" @click="saveGeneratedItems">
        {{ saving ? "Saving..." : "Save to card" }}
      </button>

      <h2>Saved checklist items</h2>
      <ul v-if="savedChecklistItems.length" class="checklist saved-checklist">
        <li v-for="item in savedChecklistItems" :key="item.id" :class="{ done: item.isDone }">{{ item.title }}</li>
      </ul>
      <section v-else class="empty-state informative compact">
        <strong>No saved checklist yet</strong>
        <span>Generated subtasks become board data only after Save to card.</span>
      </section>
    </div>
  </section>
</template>
