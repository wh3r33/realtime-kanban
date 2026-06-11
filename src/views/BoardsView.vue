<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useBoardsStore } from "../stores/boards";
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";

const router = useRouter();
const boardsStore = useBoardsStore();
const membersStore = useMembersStore();
const uiStore = useUiStore();

const totalActivity = computed(() => boardsStore.boards.reduce((sum, board) => sum + board.activity, 0));
const totalMembers = computed(() => boardsStore.boards.reduce((sum, board) => sum + board.members, 0));

function openBoard(boardId) {
  boardsStore.selectBoard(boardId);
  uiStore.showToast(`${boardsStore.selectedBoard.name} opened`);
  router.push(`/boards/${boardId}`);
}

function createBoard() {
  uiStore.showToast("Create board flow queued for the Vue migration");
}
</script>

<template>
  <section class="page-header">
    <div class="header-line">
      <p class="kicker">Workspace Dashboard</p>
      <div class="board-meta">
        <span class="status-badge live">SYNC STABLE</span>
        <span>{{ membersStore.onlineMembers.length }} online collaborators</span>
      </div>
    </div>
    <h1>Boards that keep live context visible.</h1>
    <p>
      Fast access to active boards with member load, recent activity, and current sync state visible before opening the work surface.
    </p>
  </section>

  <section class="stats-grid workspace-stats" aria-label="Workspace summary">
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
      <span>Online now</span>
      <strong>{{ membersStore.onlineMembers.length }}</strong>
    </article>
  </section>

  <section class="page-grid boards-grid">
    <article v-for="board in boardsStore.boards" :key="board.id" class="board-card">
      <div class="board-card-topline">
        <span class="status-badge" :class="board.online > 1 ? 'synced' : 'online'">{{ board.online }} ONLINE</span>
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
      <p>Start with visible sync status, roles, member presence, and activity history.</p>
      <button class="button secondary" type="button" @click="createBoard">Create board</button>
    </article>
  </section>

  <section class="panel">
    <div class="panel-header">
      <h2>Recent activity</h2>
      <span class="status-badge online">LIVE</span>
    </div>
    <div class="compact-list">
      <p v-for="event in uiStore.activityEvents.slice(0, 4)" :key="event.id">
        <strong>{{ event.title }}</strong> {{ event.body }}
      </p>
    </div>
  </section>
</template>
