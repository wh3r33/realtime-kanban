<script setup>
import { computed, reactive, ref, watch } from "vue";
import { useAuthStore } from "../stores/auth";
import { useCardsStore } from "../stores/cards";
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";

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
  if (result.error === "viewer") uiStore.showToast("Роль viewer не может редактировать карточки");
  else if (result.error === "conflict") uiStore.showToast("Конфликт версии: карточка уже изменена другим пользователем");
  else if (result.error) uiStore.showToast(result.error.message || "Ошибка сохранения карточки");
  else {
    draft.version = result.card.version;
    uiStore.showToast(result.queued ? "Изменение поставлено в очередь офлайн" : `${result.card.title} saved`);
  }
}

async function deleteCard() {
  if (!task.value) return;
  const title = task.value.title;
  const result = await cardsStore.deleteCard(task.value.id);
  if (result.error === "viewer") uiStore.showToast("Роль viewer не может удалять карточки");
  else if (result.error === "conflict") uiStore.showToast("Конфликт версии: карточка уже изменена другим пользователем");
  else if (result.error) uiStore.showToast(result.error.message || "Delete failed");
  else uiStore.showToast(result.queued ? "Удаление поставлено в очередь офлайн" : result.warning || `${title} deleted`);
}

async function addComment() {
  if (!task.value) return;
  const result = await cardsStore.addComment(task.value.id, commentDraft.value);
  if (result.error === "viewer") uiStore.showToast("Роль viewer не может комментировать");
  else if (result.error) uiStore.showToast(result.error.message || "Ошибка комментария");
  else if (!result.error) {
    commentDraft.value = "";
    uiStore.showToast("Комментарий добавлен");
  }
}

function startEditComment(comment) {
  editingCommentId.value = comment.id;
  editingCommentBody.value = comment.body;
}

async function saveComment(commentId) {
  const result = await cardsStore.updateComment(commentId, editingCommentBody.value);
  if (result.error === "viewer") uiStore.showToast("Роль viewer не может редактировать комментарии");
  else if (result.error) uiStore.showToast(result.error.message || "Ошибка комментария");
  else {
    editingCommentId.value = null;
    editingCommentBody.value = "";
    uiStore.showToast("Comment updated");
  }
}

async function deleteComment(commentId) {
  const result = await cardsStore.deleteComment(commentId);
  if (result.error === "viewer") uiStore.showToast("Роль viewer не может удалять комментарии");
  else if (result.error) uiStore.showToast(result.error.message || "Ошибка комментария");
  else uiStore.showToast("Comment deleted");
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
  if (result.error === "viewer") uiStore.showToast("Роль viewer не может менять чеклист");
  else if (result.error) uiStore.showToast(`Ошибка сохранения чеклиста: ${result.error.message || result.error}`);
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
        <p class="kicker">Task Detail</p>
        <h3 id="drawerTitle">{{ task?.title || "Select a task" }}</h3>
      </div>
      <button class="icon-button" type="button" aria-label="Close task drawer" @click="cardsStore.closeCard">
        <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
    <div v-if="task" class="drawer-content">
      <div v-if="cardsStore.conflict?.cardId === task.id" class="conflict-panel" role="alert">
        <strong>Outdated edit detected</strong>
        <p>Your draft was based on version {{ cardsStore.conflict.mine.version }}. Latest is version {{ cardsStore.conflict.latest.version }}.</p>
        <div class="drawer-actions">
          <button class="button primary" type="button" @click="keepMine">Keep mine</button>
          <button class="button secondary" type="button" @click="acceptLatest">Accept latest</button>
        </div>
      </div>

      <form class="drawer-block" @submit.prevent="saveCard">
        <label>
          Title
          <input v-model="draft.title" class="input" :disabled="!canMutate" required />
        </label>
        <label>
          Description
          <textarea v-model="draft.description" class="input textarea compact-textarea" :disabled="!canMutate" required></textarea>
        </label>
        <label>
          Assignee
          <select v-model="draft.assigneeId" class="input" :disabled="!canMutate">
            <option :value="null">Unassigned</option>
            <option v-for="member in membersStore.members" :key="member.id" :value="member.id">{{ member.name }}</option>
          </select>
        </label>
        <label>
          Status
          <select v-model="draft.status" class="input" :disabled="!canMutate">
            <option value="active">active</option>
            <option value="blocked">blocked</option>
            <option value="done">done</option>
          </select>
        </label>
        <label>
          Labels
          <input v-model="draft.labelsText" class="input" :disabled="!canMutate" placeholder="frontend, urgent" />
        </label>
        <div class="drawer-actions">
          <button class="button primary" type="submit" :disabled="!canMutate">Save card</button>
          <button class="button danger" type="button" :disabled="!canMutate" @click="deleteCard">Delete</button>
        </div>
        <p v-if="!canMutate" class="security-note">Viewer role is read-only. Editing, deleting, moving, and comments are disabled.</p>
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
          <h4>Checklist</h4>
          <span v-if="checklistSummary.total" class="status-badge synced">{{ checklistSummary.completed }}/{{ checklistSummary.total }}</span>
        </div>
        <div v-if="checklistItems.length" class="drawer-checklist">
          <label v-for="item in checklistItems" :key="item.id" class="checklist-toggle" :class="{ done: item.isDone }">
            <input type="checkbox" :checked="item.isDone" :disabled="!canMutate" @change="toggleChecklistItem(item)" />
            <span>{{ item.title }}</span>
          </label>
        </div>
        <p v-else>No saved checklist items yet.</p>
      </div>

      <div class="drawer-section">
        <h4>Comments</h4>
        <form class="comment-form" @submit.prevent="addComment">
          <textarea v-model="commentDraft" class="input textarea compact-textarea" :disabled="!canMutate" placeholder="Add a comment"></textarea>
          <button class="button secondary" type="submit" :disabled="!canMutate || !commentDraft.trim()">Add comment</button>
        </form>
        <p class="security-note">Комментарии сохраняются в Supabase и обновляются через realtime.</p>

        <div v-for="comment in comments" :key="comment.id" class="comment">
          <span class="tiny-avatar" :style="{ '--ring': membersStore.memberById(comment.authorId).color }">
            {{ membersStore.memberById(comment.authorId).initials }}
          </span>
          <div>
            <strong>{{ membersStore.memberById(comment.authorId).name }}</strong>
            <template v-if="editingCommentId === comment.id">
              <textarea v-model="editingCommentBody" class="input textarea compact-textarea"></textarea>
              <div class="drawer-actions">
                <button class="button secondary" type="button" @click="saveComment(comment.id)">Save</button>
                <button class="button secondary" type="button" @click="editingCommentId = null">Cancel</button>
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
        <h4>History</h4>
        <p v-if="!task.history?.length">Card history is recorded in activity logs.</p>
        <p v-for="item in task.history" :key="item">{{ item }}</p>
      </div>
    </div>
  </aside>
</template>
