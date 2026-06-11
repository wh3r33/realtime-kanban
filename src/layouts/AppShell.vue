<script setup>
import ActivityRail from "../components/ActivityRail.vue";
import TaskDrawer from "../components/TaskDrawer.vue";
import ToastStack from "../components/ToastStack.vue";
import TopBar from "../components/TopBar.vue";
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
