<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useBoardsStore } from "../stores/boards";
import { useUiStore } from "../stores/ui";

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
  uiStore.showToast(`${boardsStore.selectedBoard?.name || "Board"} opened`);
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
  uiStore.showToast(`${result.board.name} created`);
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
      <p class="kicker">Workspace Dashboard</p>
      <div class="board-meta">
        <span class="status-badge" :class="authStore.isConfigured ? 'synced' : 'viewer'">{{ authStore.isConfigured ? 'SUPABASE' : 'SETUP REQUIRED' }}</span>
      </div>
    </div>
    <h1>Your boards</h1>
    <p>Boards shown here are loaded from Supabase membership rows. Empty workspaces stay empty until you create a board.</p>
  </section>

  <section v-if="authStore.session.status === 'setup_required'" class="panel empty-state informative">
    <strong>Supabase setup required</strong>
    <span>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then reload the app. VITE_SUPABASE_PUBLISHABLE_KEY is supported as a fallback.</span>
  </section>

  <section v-if="authStore.profileErrorMessage && authStore.session.status === 'authenticated'" class="panel empty-state informative error-state" role="alert">
    <strong>Profile setup needs attention</strong>
    <span>{{ authStore.profileErrorMessage }}</span>
  </section>

  <section v-if="authStore.session.status !== 'setup_required'" class="stats-grid workspace-stats" aria-label="Workspace summary">
    <article class="stat-card">
      <span>Boards</span>
      <strong>{{ boardsStore.boards.length }}</strong>
    </article>
    <article class="stat-card">
      <span>Members</span>
      <strong>{{ totalMembers }}</strong>
    </article>
    <article class="stat-card">
      <span>Activity</span>
      <strong>{{ totalActivity }}</strong>
    </article>
    <article class="stat-card">
      <span>Realtime</span>
      <strong>{{ uiStore.syncState }}</strong>
    </article>
  </section>

  <section v-if="hasBoardError && authStore.session.status !== 'setup_required'" class="panel empty-state informative error-state" role="alert">
    <strong>Boards could not be loaded</strong>
    <span>{{ boardsStore.errorMessage }}</span>
  </section>

  <section v-else-if="!boardsStore.loading && !hasBoards && authStore.session.status !== 'setup_required'" class="panel empty-state informative">
    <strong>No boards yet</strong>
    <span>Create a board to insert a Supabase board, owner membership, and default columns.</span>
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
        Open board
      </button>
    </article>

    <article class="board-card create-board" aria-label="Create a new board">
      <span>Create</span>
      <h2>New board</h2>
      <p>Creates the board, owner membership, and Todo / In Progress / Review / Done columns.</p>
      <form class="drawer-block" @submit.prevent="createBoard">
        <input v-model="form.title" class="input" placeholder="Board title" required />
        <input v-model="form.description" class="input" placeholder="Description optional" />
        <button class="button secondary" type="submit" :disabled="busy">{{ busy ? "Creating..." : "Create board" }}</button>
      </form>
    </article>
  </section>

  <section v-if="authStore.session.status !== 'setup_required'" class="panel">
    <div class="panel-header">
      <h2>Recent activity</h2>
      <span class="status-badge viewer">FROM ACTIVITY LOGS</span>
    </div>
    <div class="compact-list">
      <p v-for="event in uiStore.activityEvents.slice(0, 4)" :key="event.id">
        <strong>{{ event.title }}</strong> {{ event.body }}
      </p>
      <div v-if="!uiStore.activityEvents.length" class="empty-state compact">
        <strong>No recent activity</strong>
        <span>Activity appears after Supabase writes create log rows.</span>
      </div>
    </div>
  </section>
</template>
