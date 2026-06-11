<script setup>
import { storeToRefs } from "pinia";
import { useCardsStore } from "../stores/cards";
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";

const cardsStore = useCardsStore();
const membersStore = useMembersStore();
const uiStore = useUiStore();
const { onlineMembers, members } = storeToRefs(membersStore);

function undo() {
  const action = cardsStore.undoLastMove();
  uiStore.showToast(action ? `${action.title} restored to ${action.from}` : "Nothing to undo");
  if (action) uiStore.addActivity("card_moved", "Move reverted", `NN User moved ${action.title} back to ${action.from}.`);
}

function redo() {
  const action = cardsStore.redoLastMove();
  uiStore.showToast(action ? `${action.title} moved to ${action.to}` : "Nothing to redo");
  if (action) uiStore.addActivity("card_moved", "Move redone", `NN User redid move for ${action.title} to ${action.to}.`);
}
</script>

<template>
  <header class="topbar glass" data-component="TopBar">
    <div class="presence-cluster" data-component="PresenceCluster">
      <span class="online-signal"></span>
      <span>{{ onlineMembers.length }} online</span>
      <div class="mini-avatars">
        <span
          v-for="member in members"
          :key="member.id"
          class="avatar"
          :class="member.presence"
          :style="{ '--ring': member.color }"
          :title="`${member.name} · ${member.presence}`"
        >
          {{ member.initials }}
        </span>
      </div>
    </div>

    <nav class="nav-capsule" data-nav>
      <RouterLink to="/boards" active-class="active">Boards</RouterLink>
      <RouterLink to="/board" active-class="active">Board</RouterLink>
      <RouterLink to="/activity" active-class="active">Activity</RouterLink>
      <RouterLink to="/members" active-class="active">Members</RouterLink>
      <RouterLink to="/settings" active-class="active">Settings</RouterLink>
    </nav>

    <div class="top-actions">
      <button class="ghost-button" type="button" :disabled="!cardsStore.undoHistory.length" @click="undo">Undo</button>
      <button class="ghost-button" type="button" :disabled="!cardsStore.redoHistory.length" @click="redo">Redo</button>
      <button class="ghost-button" type="button" @click="uiStore.showToast('Mock invite action queued')">Invite</button>
      <RouterLink class="icon-button" to="/notifications" aria-label="Notifications">
        <span class="notification-dot"></span>
      </RouterLink>
      <RouterLink class="profile-button" to="/profile">NN</RouterLink>
    </div>
  </header>
</template>
