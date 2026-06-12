<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useBoardsStore } from "../stores/boards";
import { useUiStore } from "../stores/ui";
import { t } from "../services/localization";

const router = useRouter();
const authStore = useAuthStore();
const boardsStore = useBoardsStore();
const uiStore = useUiStore();
const busy = ref(false);
const form = reactive({ title: "", description: "" });

const totalActivity = computed(() => boardsStore.boards.reduce((sum, board) => sum + board.activity, 0));
const totalMembers = computed(() => boardsStore.boards.reduce((sum, board) => sum + board.members, 0));
const hasBoards = computed(() => boardsStore.boards.length > 0);
const hasBoardError = computed(() => Boolean(boardsStore.errorMessage));

function openBoard(boardId) {
  boardsStore.selectBoard(boardId);
  uiStore.showToast(t("messages.boardOpened", { name: boardsStore.selectedBoard?.name || "Board" }));
  router.push(`/boards/${boardId}`);
}

async function createBoard() {
  if (!form.title.trim()) return;
  busy.value = true;
  const result = await boardsStore.createBoard(form.title, form.description);
  busy.value = false;
  if (result.error) {
    uiStore.showToast(result.error.message);
    return;
  }
  form.title = "";
  form.description = "";
  uiStore.showToast(t("messages.boardCreated", { name: result.board.name }));
  router.push(`/boards/${result.board.id}`);
}

onMounted(async () => {
  await authStore.initialize();
  if (authStore.session.status === "authenticated") await boardsStore.loadBoards();
});
</script>

<template>
  <section class="page-header">
    <div class="header-line">
      <p class="kicker">{{ t("boards.header") }}</p>
      <div class="board-meta">
        <span class="status-badge" :class="authStore.isConfigured ? 'synced' : 'viewer'">{{ authStore.isConfigured ? 'SUPABASE' : t('boards.setupRequired') }}</span>
      </div>
    </div>
    <h1>{{ t("boards.title") }}</h1>
    <p>{{ t("boards.summary") }}</p>
  </section>

  <section v-if="authStore.session.status === 'setup_required'" class="panel empty-state informative">
    <strong>{{ t("boards.setupRequired") }}</strong>
    <span>{{ t("boards.setupRequiredBody") }}</span>
  </section>

  <section v-if="authStore.profileErrorMessage && authStore.session.status === 'authenticated'" class="panel empty-state informative error-state" role="alert">
    <strong>{{ t("boards.profileSetup") }}</strong>
    <span>{{ authStore.profileErrorMessage }}</span>
  </section>

  <section v-if="authStore.session.status !== 'setup_required'" class="stats-grid workspace-stats" aria-label="Workspace summary">
    <article class="stat-card">
      <span>{{ t("nav.boards") }}</span>
      <strong>{{ boardsStore.boards.length }}</strong>
    </article>
    <article class="stat-card">
      <span>{{ t("nav.members") }}</span>
      <strong>{{ totalMembers }}</strong>
    </article>
    <article class="stat-card">
      <span>{{ t("nav.activity") }}</span>
      <strong>{{ totalActivity }}</strong>
    </article>
    <article class="stat-card">
      <span>{{ t("settings.realtime") }}</span>
      <strong>{{ uiStore.syncState }}</strong>
    </article>
  </section>

  <section v-if="hasBoardError && authStore.session.status !== 'setup_required'" class="panel empty-state informative error-state" role="alert">
    <strong>{{ t("boards.boardsLoadFailed") }}</strong>
    <span>{{ boardsStore.errorMessage }}</span>
  </section>

  <section v-else-if="!boardsStore.loading && !hasBoards && authStore.session.status !== 'setup_required'" class="panel empty-state informative">
    <strong>{{ t("boards.noBoards") }}</strong>
    <span>{{ t("boards.noBoardsBody") }}</span>
  </section>

  <section v-if="authStore.session.status !== 'setup_required'" class="page-grid boards-grid">
    <article v-for="board in boardsStore.boards" :key="board.id" class="board-card">
      <div class="board-card-topline">
        <span class="status-badge synced">SUPABASE</span>
        <small>{{ board.updated }}</small>
      </div>
      <div>
        <h2>{{ board.name }}</h2>
        <p>{{ board.summary }}</p>
      </div>
      <div class="metric-row" aria-label="Board metrics">
        <span>{{ board.columns }} columns</span>
        <span>{{ board.cards }} cards</span>
        <span>{{ board.members }} members</span>
        <span>{{ board.activity }} activity</span>
      </div>
      <button class="button primary board-open-action" type="button" @click="openBoard(board.id)">
        {{ t("boards.openBoard") }}
      </button>
    </article>

    <article class="board-card create-board" aria-label="Create a new board">
      <span>{{ t("common.create") }}</span>
      <h2>{{ t("boards.createTitle") }}</h2>
      <p>{{ t("boards.createBody") }}</p>
      <form class="drawer-block" @submit.prevent="createBoard">
        <input v-model="form.title" class="input" :placeholder="t('boards.title')" required />
        <input v-model="form.description" class="input" :placeholder="t('common.descriptionOptional')" />
        <button class="button secondary" type="submit" :disabled="busy">{{ busy ? t("common.working") : t("boards.createBoard") }}</button>
      </form>
    </article>
  </section>

  <section v-if="authStore.session.status !== 'setup_required'" class="panel">
    <div class="panel-header">
      <h2>{{ t("boards.recentActivity") }}</h2>
      <span class="status-badge viewer">FROM ACTIVITY LOGS</span>
    </div>
      <div class="compact-list">
        <p v-for="event in uiStore.activityEvents.slice(0, 4)" :key="event.id">
          <strong>{{ event.title }}</strong> {{ event.body }}
        </p>
      <div v-if="!uiStore.activityEvents.length" class="empty-state compact">
        <strong>{{ t("boards.noRecentActivity") }}</strong>
        <span>{{ t("boards.noRecentActivityBody") }}</span>
      </div>
      </div>
  </section>
</template>
