<script setup>
import { onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import ActivityRail from "../components/ActivityRail.vue";
import TaskDrawer from "../components/TaskDrawer.vue";
import ToastStack from "../components/ToastStack.vue";
import TopBar from "../components/TopBar.vue";
import { useAuthStore } from "../stores/auth";
import { useBoardsStore } from "../stores/boards";
import { useUiStore } from "../stores/ui";

const route = useRoute();
const authStore = useAuthStore();
const boardsStore = useBoardsStore();
const uiStore = useUiStore();

watch(
  () => route.params.boardId,
  (boardId) => {
    if (boardId) boardsStore.selectBoard(boardId);
  },
  { immediate: true }
);

if (typeof document !== "undefined") {
  document.documentElement.dataset.theme = uiStore.theme;
}

onMounted(async () => {
  await authStore.initialize();
  if (authStore.session.status === "authenticated") await boardsStore.loadBoards();
});
</script>

<template>
  <section class="workspace-screen standalone active">
    <div class="workspace-noise"></div>
    <TopBar />
    <ActivityRail />
    <div class="workspace-shell">
      <RouterView />
    </div>
    <TaskDrawer />
  </section>
  <ToastStack />
</template>
