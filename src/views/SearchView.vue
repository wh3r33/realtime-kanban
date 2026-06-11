<script setup>
import { computed, onMounted, ref } from "vue";
import { useBoardsStore } from "../stores/boards";
import { useCardsStore } from "../stores/cards";
import { useMembersStore } from "../stores/members";

const boardsStore = useBoardsStore();
const cardsStore = useCardsStore();
const membersStore = useMembersStore();
const query = ref("");
const assigneeId = ref("");
const label = ref("");
const status = ref("");

const boardCards = computed(() => cardsStore.cards.filter((card) => card.boardId === boardsStore.selectedBoardId));
const labels = computed(() => Array.from(new Set(boardCards.value.flatMap((card) => card.labels || []))).sort());
const results = computed(() => {
  const q = query.value.trim().toLowerCase();
  return boardCards.value.filter((card) => {
    const text = `${card.title} ${card.description}`.toLowerCase();
    return (
      (!q || text.includes(q)) &&
      (!assigneeId.value || card.assigneeId === assigneeId.value) &&
      (!label.value || (card.labels || []).includes(label.value)) &&
      (!status.value || card.status === status.value)
    );
  });
});

onMounted(async () => {
  if (!boardsStore.boards.length) await boardsStore.loadBoards();
  if (boardsStore.selectedBoardId) {
    await boardsStore.loadColumns(boardsStore.selectedBoardId);
    await cardsStore.loadCards(boardsStore.selectedBoardId);
    await membersStore.loadMembers(boardsStore.selectedBoardId);
  }
});
</script>

<template>
  <section class="page-header">
    <p class="kicker">Search</p>
    <h1>Search real board cards.</h1>
    <p>Results are filtered from the selected board loaded from Supabase.</p>
  </section>

  <section class="panel search-control-panel">
    <input v-model="query" class="input" type="search" placeholder="Поиск по названию или описанию" />
    <select v-model="assigneeId" class="input">
      <option value="">Все исполнители</option>
      <option v-for="member in membersStore.members" :key="member.id" :value="member.id">{{ member.name }}</option>
    </select>
    <select v-model="label" class="input">
      <option value="">Все метки</option>
      <option v-for="item in labels" :key="item" :value="item">{{ item }}</option>
    </select>
    <select v-model="status" class="input">
      <option value="">Все статусы</option>
      <option value="active">active</option>
      <option value="blocked">blocked</option>
      <option value="done">done</option>
    </select>
  </section>

  <section class="search-results">
    <article v-for="card in results" :key="card.id" class="result-card" @click="cardsStore.selectCard(card.id)">
      <div>
        <span class="status-badge synced">{{ card.column }}</span>
        <h2>{{ card.title }}</h2>
        <p>{{ card.description }}</p>
        <div class="metric-row">
          <span>{{ membersStore.memberById(card.assigneeId).name }}</span>
          <span>{{ card.status }}</span>
          <span v-for="item in card.labels" :key="item">{{ item }}</span>
        </div>
      </div>
    </article>
    <div v-if="!results.length" class="empty-state informative">
      <strong>Ничего не найдено</strong>
      <span>Измените запрос, метку, статус или исполнителя.</span>
    </div>
  </section>
</template>
