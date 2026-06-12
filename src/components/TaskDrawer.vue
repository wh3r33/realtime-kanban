<script setup>
import { computed, reactive, ref, watch } from "vue";
import UserAvatar from "./UserAvatar.vue";
import { useAuthStore } from "../stores/auth";
import { useCardsStore } from "../stores/cards";
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";
import { t } from "../services/localization";

const authStore = useAuthStore();
const cardsStore = useCardsStore();
const membersStore = useMembersStore();
const uiStore = useUiStore();
const task = computed(() => cardsStore.selectedCard);
const comments = computed(() => (task.value ? cardsStore.commentsFor(task.value.id) : []));
const checklistItems = computed(() => (task.value ? cardsStore.checklistForCard(task.value.id) : []));
const checklistSummary = computed(() => (task.value ? cardsStore.checklistSummaryForCard(task.value.id) : { total: 0, completed: 0 }));
const canMutate = computed(() => authStore.canMutateCards);
const draft = reactive({ title: "", description: "", assigneeId: null, status: "active", labelsText: "", version: 0 });
const commentDraft = ref("");
const editingCommentId = ref(null);
const editingCommentBody = ref("");

watch(
  () => task.value?.id,
  () => {
    const card = task.value;
    if (!card) {
      cardsStore.trackPresence({ cardId: null, mode: "viewing", field: null });
      return;
    }
    draft.title = card.title;
    draft.description = card.description;
    draft.assigneeId = card.assigneeId;
    draft.status = card.status || "active";
    draft.labelsText = (card.labels || []).join(", ");
    draft.version = card.version || 0;
    commentDraft.value = "";
    editingCommentId.value = null;
    cardsStore.trackPresence({ cardId: card.id, mode: "editing", field: "card" });
  },
  { immediate: true }
);

async function saveCard() {
  if (!task.value) return;
  const result = await cardsStore.updateCard(
    task.value.id,
    {
      title: draft.title,
      description: draft.description,
      assigneeId: draft.assigneeId,
      status: draft.status,
      labels: Array.from(new Set(draft.labelsText.split(",").map((item) => item.trim()).filter(Boolean)))
    },
    { expectedVersion: draft.version }
  );
  if (result.error === "viewer") uiStore.showToast(t("board.viewerReadOnlyShort"));
  else if (result.error === "conflict") uiStore.showToast(t("board.versionConflict"));
  else if (result.error) uiStore.showToast(result.error.message || t("board.cardSaveFailed"));
  else {
    draft.version = result.card.version;
    uiStore.showToast(result.queued ? t("board.changeQueuedOffline") : `${result.card.title} saved`);
  }
}

async function deleteCard() {
  if (!task.value) return;
  const title = task.value.title;
  const result = await cardsStore.deleteCard(task.value.id);
  if (result.error === "viewer") uiStore.showToast(t("board.viewerReadOnlyShort"));
  else if (result.error === "conflict") uiStore.showToast(t("board.versionConflict"));
  else if (result.error) uiStore.showToast(result.error.message || t("settings.boardDeletionFailed"));
  else uiStore.showToast(result.queued ? t("board.deleteQueuedOffline") : result.warning || `${title} deleted`);
}

async function addComment() {
  if (!task.value) return;
  const result = await cardsStore.addComment(task.value.id, commentDraft.value);
  if (result.error === "viewer") uiStore.showToast(t("board.viewerReadOnlyShort"));
  else if (result.error) uiStore.showToast(result.error.code === "MIGRATION_REQUIRED" ? result.error.message : result.error.message || t("board.commentFailed"));
  else if (!result.error) {
    commentDraft.value = "";
    uiStore.showToast(t("board.commentAdded"));
  }
}

function startEditComment(comment) {
  editingCommentId.value = comment.id;
  editingCommentBody.value = comment.body;
}

async function saveComment(commentId) {
  const result = await cardsStore.updateComment(commentId, editingCommentBody.value);
  if (result.error === "viewer") uiStore.showToast(t("board.viewerReadOnlyShort"));
  else if (result.error) uiStore.showToast(result.error.code === "MIGRATION_REQUIRED" ? result.error.message : result.error.message || t("board.commentFailed"));
  else {
    editingCommentId.value = null;
    editingCommentBody.value = "";
    uiStore.showToast(t("board.commentUpdated"));
  }
}

async function deleteComment(commentId) {
  const result = await cardsStore.deleteComment(commentId);
  if (result.error === "viewer") uiStore.showToast(t("board.viewerReadOnlyShort"));
  else if (result.error) uiStore.showToast(result.error.code === "MIGRATION_REQUIRED" ? result.error.message : result.error.message || t("board.commentFailed"));
  else uiStore.showToast(t("board.commentDeleted"));
}

function simulateConflict() {
  uiStore.showToast("Conflict simulation is unavailable without a real concurrent edit flow");
}

function keepMine() {
  const card = cardsStore.keepMineConflict();
  if (card) {
    draft.title = card.title;
    draft.description = card.description;
    draft.assigneeId = card.assigneeId;
    draft.version = card.version;
    uiStore.showToast("Kept your draft");
  }
}

function acceptLatest() {
  const card = cardsStore.acceptLatestConflict();
  if (card) {
    draft.title = card.title;
    draft.description = card.description;
    draft.assigneeId = card.assigneeId;
    draft.version = card.version;
    uiStore.showToast("Accepted latest version");
  }
}

async function toggleChecklistItem(item) {
  const result = await cardsStore.toggleChecklistItem(item.id, !item.isDone);
  if (result.error === "viewer") uiStore.showToast(t("board.viewerReadOnlyShort"));
  else if (result.error) uiStore.showToast(result.error.code === "MIGRATION_REQUIRED" ? result.error.message : `Checklist save failed: ${result.error.message || result.error}`);
}
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
        <p class="kicker">{{ t("board.taskDetail") }}</p>
        <h3 id="drawerTitle">{{ task?.title || t("board.selectTask") }}</h3>
      </div>
      <button class="icon-button" type="button" :aria-label="t('common.close')" @click="cardsStore.closeCard">
        <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
    <div v-if="task" class="drawer-content">
      <div v-if="cardsStore.conflict?.cardId === task.id" class="conflict-panel" role="alert">
        <strong>{{ t("board.outdatedEditDetected") }}</strong>
        <p>{{ t("board.draftBasedOnVersion", { mine: cardsStore.conflict.mine.version, latest: cardsStore.conflict.latest.version }) }}</p>
        <div class="drawer-actions">
          <button class="button primary" type="button" @click="keepMine">{{ t("board.keepMine") }}</button>
          <button class="button secondary" type="button" @click="acceptLatest">{{ t("board.acceptLatest") }}</button>
        </div>
      </div>

      <form class="drawer-block" @submit.prevent="saveCard">
        <label>
          {{ t("board.titleField") }}
          <input v-model="draft.title" class="input" :disabled="!canMutate" required />
        </label>
        <label>
          {{ t("board.descriptionField") }}
          <textarea v-model="draft.description" class="input textarea compact-textarea" :disabled="!canMutate" required></textarea>
        </label>
        <label>
          {{ t("board.assigneeField") }}
          <select v-model="draft.assigneeId" class="input" :disabled="!canMutate">
            <option :value="null">{{ t("board.unassigned") }}</option>
            <option v-for="member in membersStore.members" :key="member.id" :value="member.id">{{ member.name }}</option>
          </select>
        </label>
        <label>
          {{ t("board.status") }}
          <select v-model="draft.status" class="input" :disabled="!canMutate">
            <option value="active">{{ t("board.statusActive") }}</option>
            <option value="blocked">{{ t("board.statusBlocked") }}</option>
            <option value="done">{{ t("board.statusDone") }}</option>
          </select>
        </label>
        <label>
          {{ t("board.labelsField") }}
          <input v-model="draft.labelsText" class="input" :disabled="!canMutate" :placeholder="t('board.labelsPlaceholder')" />
        </label>
        <div class="drawer-actions">
          <button class="button primary" type="submit" :disabled="!canMutate">{{ t("board.saveCard") }}</button>
          <button class="button danger" type="button" :disabled="!canMutate" @click="deleteCard">{{ t("common.delete") }}</button>
        </div>
        <p v-if="!canMutate" class="security-note">{{ t("board.viewerReadOnly") }}</p>
      </form>

      <div class="drawer-row">
        <span>Status</span>
        <strong>{{ task.status.toUpperCase() }}</strong>
      </div>
      <div class="drawer-row">
        <span>Column</span>
        <strong>{{ task.column }}</strong>
      </div>
      <div class="drawer-row">
        <span>Version</span>
        <strong>{{ task.version }}</strong>
      </div>

      <div class="drawer-section">
        <div class="section-title-row">
          <h4>{{ t("board.checklist") }}</h4>
          <span v-if="checklistSummary.total" class="status-badge synced">{{ checklistSummary.completed }}/{{ checklistSummary.total }}</span>
        </div>
        <div v-if="checklistItems.length" class="drawer-checklist">
          <label v-for="item in checklistItems" :key="item.id" class="checklist-toggle" :class="{ done: item.isDone }">
            <input type="checkbox" :checked="item.isDone" :disabled="!canMutate" @change="toggleChecklistItem(item)" />
            <span>{{ item.title }}</span>
          </label>
        </div>
        <p v-else>{{ t("board.noChecklistItems") }}</p>
      </div>

      <div class="drawer-section">
        <h4>{{ t("board.comments") }}</h4>
        <form class="comment-form" @submit.prevent="addComment">
          <textarea v-model="commentDraft" class="input textarea compact-textarea" :disabled="!canMutate" :placeholder="t('board.addCommentPlaceholder')"></textarea>
          <button class="button secondary" type="submit" :disabled="!canMutate || !commentDraft.trim()">{{ t("board.addComment") }}</button>
        </form>
        <p class="security-note">Комментарии сохраняются в Supabase и обновляются через realtime.</p>

        <div v-for="comment in comments" :key="comment.id" class="comment">
          <UserAvatar
            class="tiny-avatar user-avatar"
            :src="membersStore.memberById(comment.authorId).avatarUrl || ''"
            :name="membersStore.memberById(comment.authorId).name"
            :initials="membersStore.memberById(comment.authorId).initials"
          />
          <div>
            <strong>{{ membersStore.memberById(comment.authorId).name }}</strong>
            <template v-if="editingCommentId === comment.id">
              <textarea v-model="editingCommentBody" class="input textarea compact-textarea"></textarea>
              <div class="drawer-actions">
                <button class="button secondary" type="button" @click="saveComment(comment.id)">{{ t("common.save") }}</button>
                <button class="button secondary" type="button" @click="editingCommentId = null">{{ t("common.cancel") }}</button>
              </div>
            </template>
            <template v-else>
              <p>{{ comment.body }}</p>
              <time>{{ comment.updatedAt || comment.createdAt }}</time>
              <div class="comment-actions">
                <button type="button" :disabled="!canMutate" @click="startEditComment(comment)">Edit</button>
                <button type="button" :disabled="!canMutate" @click="deleteComment(comment.id)">Delete</button>
              </div>
            </template>
          </div>
        </div>
      </div>
      <div class="drawer-section">
        <h4>{{ t("board.history") }}</h4>
        <p v-if="!task.history?.length">{{ t("board.cardHistoryRecorded") }}</p>
        <p v-for="item in task.history" :key="item">{{ item }}</p>
      </div>
    </div>
  </aside>
</template>
