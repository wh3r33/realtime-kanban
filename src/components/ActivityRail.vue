<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import UserAvatar from "./UserAvatar.vue";
import { generateAiSubtasks, prioritizeBoardCards } from "../services/aiAssistantService";
import { t } from "../services/localization";
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
    aiError.value = t("ai.selectCardFirst");
    return;
  }
  aiLoading.value = true;
  aiCardId.value = card.id;
  try {
    aiItems.value = await generateAiSubtasks({
      prompt: "Break the selected card into concise implementation subtasks.",
      card: cardPayload(card)
    });
    aiMessage.value = t("ai.aiPreparedSubtasks");
  } catch (error) {
    aiError.value = `AI error: ${error.message || "try again later"}`;
  } finally {
    aiLoading.value = false;
  }
}

async function generatePriority() {
  resetAiState("priority");
  if (!boardCards.value.length) {
    aiError.value = t("ai.noCardsAvailable");
    return;
  }
  aiLoading.value = true;
  try {
    aiItems.value = await prioritizeBoardCards({
      prompt: "Prioritize these board cards. Return concise recommendations with reasons.",
      cards: boardCards.value.map(cardPayload)
    });
    aiMessage.value = t("ai.aiPreparedPriorities");
  } catch (error) {
    aiError.value = `AI error: ${error.message || "try again later"}`;
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
    aiError.value = t("board.viewerReadOnlyShort");
    return;
  }
  if (result.error) {
    aiError.value = result.error.code === "MIGRATION_REQUIRED" ? result.error.message : `Save failed: ${result.error.message || result.error}`;
    return;
  }
  aiMessage.value = result.items.length ? t("ai.aiSaved") : t("ai.noSavedChecklist");
  uiStore.showToast(t("ai.aiSaved"));
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
        <p class="rail-label">{{ t("ai.assistantLabel") }}</p>
        <button class="button secondary rail-ai-button" type="button" :aria-expanded="isOpen" @click="isOpen = !isOpen">{{ t("ai.title") }}</button>
      </div>
      <div v-if="isOpen" class="ai-rail-panel">
        <button type="button" class="ai-action-row" :disabled="aiLoading" @click="generateSubtasks">
          <strong>{{ t("ai.subtasks") }}</strong>
          <span>{{ targetCard?.title || t("ai.selectCardFirst") }}</span>
        </button>
        <button type="button" class="ai-action-row" :disabled="aiLoading" @click="generatePriority">
          <strong>{{ t("ai.priority") }}</strong>
          <span>{{ t("ai.noCardsInScope", { count: boardCards.length }) }}</span>
        </button>
        <button type="button" class="ai-action-row" @click="openFullAssistant">
          <strong>{{ t("ai.openAssistant") }}</strong>
          <span>{{ t("ai.body") }}</span>
        </button>

        <div v-if="aiLoading" class="ai-rail-status">{{ t("ai.aiPreparing") }}</div>
        <div v-if="aiError" class="ai-rail-status error" role="alert">{{ aiError }}</div>
        <div v-if="aiMessage" class="ai-rail-status success">{{ aiMessage }}</div>

        <div v-if="aiItems.length" class="ai-rail-results" aria-live="polite">
          <p>{{ activeMode === "subtasks" ? t("ai.generatedSubtasks") : t("ai.priorityRecommendations") }}</p>
          <ul>
            <li v-for="item in aiItems" :key="item">{{ item }}</li>
          </ul>
          <button v-if="activeMode === 'subtasks'" class="button primary" type="button" :disabled="!canSave" @click="saveToCard">
            {{ aiSaving ? t("common.saving") : t("ai.saveToCard") }}
          </button>
        </div>
      </div>
    </div>
    <div class="rail-section">
      <p class="rail-label">{{ t("members.presence") }}</p>
      <div class="editing-now">
        <div v-for="member in membersStore.onlineMembers" :key="member.id" class="editing-item" data-component="EditingPresenceItem">
          <UserAvatar class="tiny-avatar user-avatar" :src="member.avatarUrl || ''" :name="member.name" :initials="member.initials" />
          <div>
            <strong>{{ member.name }}</strong>
            <span>{{ membersStore.editorForCard(cardsStore.selectedCardId)?.userId === member.id ? t("members.activeSignals") : t("members.online") }}</span>
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
            <span>{{ t("members.activeSignals") }} · {{ cardsStore.cardById(presence.cardId)?.title || presence.cardId }}</span>
          </div>
        </div>
        <div v-if="!membersStore.onlineMembers.length && !membersStore.editingUsers.length" class="editing-item rail-empty-item">
          <strong>{{ membersStore.presenceConnected ? t("members.noActiveSignals") : membersStore.presenceMessage }}</strong>
          <span>{{ membersStore.presenceConnected ? "Other members will appear here." : "Realtime presence is not currently live." }}</span>
        </div>
      </div>
    </div>
    <div class="rail-section">
      <p class="rail-label">{{ t("activity.title") }}</p>
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
        <div v-if="!uiStore.activityEvents.length" class="activity-item rail-empty-item">
          <strong>{{ t("activity.noActivity") }}</strong>
          <span>{{ t("activity.body") }}</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.activity-rail,
.rail-section,
.editing-now,
.activity-feed,
.editing-item,
.activity-item,
.ai-rail-status {
  min-width: 0;
}

.editing-item,
.activity-item,
.ai-rail-status {
  overflow: hidden;
}

.editing-item > div,
.activity-item > div {
  min-width: 0;
}

.editing-item strong,
.editing-item span,
.activity-item strong,
.activity-item span,
.activity-item time,
.ai-rail-status {
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
  white-space: normal;
}

.rail-empty-item {
  grid-template-columns: minmax(0, 1fr);
}
</style>
