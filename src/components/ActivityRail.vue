<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import UserAvatar from "./UserAvatar.vue";
import { generateAiSubtasks, prioritizeBoardCards } from "../services/aiAssistantService";
import { useAuthStore } from "../stores/auth";
import { useBoardsStore } from "../stores/boards";
import { useCardsStore } from "../stores/cards";
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";

const router = useRouter();
const authStore = useAuthStore();
const boardsStore = useBoardsStore();
const cardsStore = useCardsStore();
const membersStore = useMembersStore();
const uiStore = useUiStore();

const isOpen = ref(false);
const activeMode = ref("subtasks");
const aiItems = ref([]);
const aiCardId = ref("");
const aiLoading = ref(false);
const aiSaving = ref(false);
const aiMessage = ref("");
const aiError = ref("");

const boardCards = computed(() =>
  cardsStore.cards
    .filter((card) => card.boardId === boardsStore.selectedBoardId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.title.localeCompare(b.title))
);
const targetCard = computed(() => cardsStore.selectedCard || boardCards.value[0] || null);
const canSave = computed(() => activeMode.value === "subtasks" && aiItems.value.length > 0 && aiCardId.value && authStore.canMutateCards && !aiSaving.value);

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

function resetAiState(mode) {
  activeMode.value = mode;
  aiItems.value = [];
  aiMessage.value = "";
  aiError.value = "";
}

async function generateSubtasks() {
  resetAiState("subtasks");
  const card = targetCard.value;
  if (!card?.id) {
    aiError.value = "Сначала выберите карточку";
    return;
  }
  aiLoading.value = true;
  aiCardId.value = card.id;
  try {
    aiItems.value = await generateAiSubtasks({
      prompt: "Break the selected card into concise implementation subtasks.",
      card: cardPayload(card)
    });
    aiMessage.value = "AI подготовил подзадачи";
  } catch (error) {
    aiError.value = `Ошибка AI: ${error.message || "попробуйте позже"}`;
  } finally {
    aiLoading.value = false;
  }
}

async function generatePriority() {
  resetAiState("priority");
  if (!boardCards.value.length) {
    aiError.value = "На доске пока нет карточек";
    return;
  }
  aiLoading.value = true;
  try {
    aiItems.value = await prioritizeBoardCards({
      prompt: "Prioritize these board cards. Return concise recommendations with reasons.",
      cards: boardCards.value.map(cardPayload)
    });
    aiMessage.value = "AI подготовил рекомендации по приоритетам";
  } catch (error) {
    aiError.value = `Ошибка AI: ${error.message || "попробуйте позже"}`;
  } finally {
    aiLoading.value = false;
  }
}

async function saveToCard() {
  if (!canSave.value) return;
  aiSaving.value = true;
  aiError.value = "";
  const result = await cardsStore.saveChecklistItemsToCard(aiCardId.value, aiItems.value);
  aiSaving.value = false;
  if (result.error === "viewer") {
    aiError.value = "У вас нет прав на сохранение подзадач";
    return;
  }
  if (result.error) {
    aiError.value = result.error.code === "MIGRATION_REQUIRED" ? result.error.message : `Ошибка сохранения: ${result.error.message || result.error}`;
    return;
  }
  aiMessage.value = result.items.length ? "AI subtasks saved to card" : "Подзадачи уже есть в карточке";
  uiStore.showToast("AI subtasks saved to card");
}

function openFullAssistant() {
  router.push({
    path: "/ai",
    query: {
      boardId: boardsStore.selectedBoardId || undefined,
      cardId: cardsStore.selectedCardId || targetCard.value?.id || undefined
    }
  });
}
</script>

<template>
  <aside class="activity-rail glass" data-component="ActivityRail">
    <div class="rail-section ai-rail-section">
      <div class="rail-heading-row">
        <p class="rail-label">AI Assistant</p>
        <button class="button secondary rail-ai-button" type="button" :aria-expanded="isOpen" @click="isOpen = !isOpen">AI</button>
      </div>
      <div v-if="isOpen" class="ai-rail-panel">
        <button type="button" class="ai-action-row" :disabled="aiLoading" @click="generateSubtasks">
          <strong>Break selected card into subtasks</strong>
          <span>{{ targetCard?.title || "Select a card first" }}</span>
        </button>
        <button type="button" class="ai-action-row" :disabled="aiLoading" @click="generatePriority">
          <strong>Prioritize board cards</strong>
          <span>{{ boardCards.length }} cards in scope</span>
        </button>
        <button type="button" class="ai-action-row" @click="openFullAssistant">
          <strong>Open full AI Assistant</strong>
          <span>Use board and card context</span>
        </button>

        <div v-if="aiLoading" class="ai-rail-status">AI готовит результат...</div>
        <div v-if="aiError" class="ai-rail-status error" role="alert">{{ aiError }}</div>
        <div v-if="aiMessage" class="ai-rail-status success">{{ aiMessage }}</div>

        <div v-if="aiItems.length" class="ai-rail-results" aria-live="polite">
          <p>{{ activeMode === "subtasks" ? "Generated subtasks" : "Priority recommendations" }}</p>
          <ul>
            <li v-for="item in aiItems" :key="item">{{ item }}</li>
          </ul>
          <button v-if="activeMode === 'subtasks'" class="button primary" type="button" :disabled="!canSave" @click="saveToCard">
            {{ aiSaving ? "Saving..." : "Save to card" }}
          </button>
        </div>
      </div>
    </div>
    <div class="rail-section">
      <p class="rail-label">Presence</p>
      <div class="editing-now">
        <div v-for="member in membersStore.onlineMembers" :key="member.id" class="editing-item" data-component="EditingPresenceItem">
          <UserAvatar class="tiny-avatar user-avatar" :src="member.avatarUrl || ''" :name="member.name" :initials="member.initials" />
          <div>
            <strong>{{ member.name }}</strong>
            <span>{{ membersStore.editorForCard(cardsStore.selectedCardId)?.userId === member.id ? "Редактирует выбранную карточку" : "Онлайн на доске" }}</span>
          </div>
        </div>
        <div v-for="presence in membersStore.editingUsers" :key="`${presence.userId}-${presence.cardId}`" class="editing-item">
          <UserAvatar
            class="tiny-avatar user-avatar"
            :src="membersStore.memberById(presence.userId).avatarUrl || ''"
            :name="membersStore.memberById(presence.userId).name"
            :initials="membersStore.memberById(presence.userId).initials"
          />
          <div>
            <strong>{{ membersStore.memberById(presence.userId).name }}</strong>
            <span>Редактирует карточку · {{ cardsStore.cardById(presence.cardId)?.title || presence.cardId }}</span>
          </div>
        </div>
        <div v-if="!membersStore.onlineMembers.length && !membersStore.editingUsers.length" class="editing-item">
          <strong>{{ membersStore.presenceConnected ? "Никого онлайн" : membersStore.presenceMessage }}</strong>
          <span>{{ membersStore.presenceConnected ? "Другие участники появятся здесь." : "Realtime presence is not currently live." }}</span>
        </div>
      </div>
    </div>
    <div class="rail-section">
      <p class="rail-label">Recent Activity</p>
      <div class="activity-feed">
        <div
          v-for="(event, index) in uiStore.activityEvents.slice(0, 6)"
          :key="event.id"
          class="activity-item"
          :class="{ new: index === 0 }"
          data-component="ActivityItem"
        >
          <UserAvatar class="tiny-avatar user-avatar" :src="membersStore.memberById(event.actorId).avatarUrl || ''" :name="membersStore.memberById(event.actorId).name" :initials="membersStore.memberById(event.actorId).initials" />
          <div>
            <strong>{{ event.title }}</strong>
            <span>{{ membersStore.memberById(event.actorId).name }} · {{ event.body }}</span>
            <time>{{ event.createdAt }}</time>
          </div>
        </div>
        <div v-if="!uiStore.activityEvents.length" class="activity-item">
          <strong>No activity yet</strong>
          <span>Only Supabase activity_logs rows appear here.</span>
        </div>
      </div>
    </div>
  </aside>
</template>
