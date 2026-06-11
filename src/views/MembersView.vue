<script setup>
import { computed } from "vue";
import { useBoardsStore } from "../stores/boards";
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";

const boardsStore = useBoardsStore();
const membersStore = useMembersStore();
const uiStore = useUiStore();

const selectedBoard = computed(() => boardsStore.selectedBoard);
const roleDescriptions = {
  owner: "Full board control",
  editor: "Create, edit, and move cards",
  viewer: "Read-only access with visible presence"
};

function inviteMember() {
  uiStore.showToast("Invite member modal queued");
}

function toggleRole(member) {
  uiStore.showToast(`${member.name} role controls are mocked in this migration`);
}
</script>

<template>
  <section class="page-header">
    <div class="header-line">
      <p class="kicker">Members & Roles</p>
      <div class="board-meta">
        <span class="status-badge live">LIVE</span>
        <span class="status-badge synced">SYNCED</span>
      </div>
    </div>
    <h1>{{ selectedBoard.name }} permissions, presence, and activity at a glance.</h1>
  </section>

  <section class="presence-strip" aria-label="Realtime member presence">
    <div>
      <span class="pulse-dot"></span>
      <strong>{{ membersStore.members.length }} members · {{ membersStore.onlineMembers.length }} online · synced</strong>
    </div>
    <div class="presence-badges">
      <span class="status-badge live">LIVE</span>
      <span class="status-badge online">ONLINE</span>
      <span class="status-badge synced">SYNCED</span>
      <span class="status-badge editing">EDITING</span>
    </div>
    <div class="realtime-mini-feed">
      <span v-for="presence in membersStore.editingUsers" :key="presence.userId">
        {{ membersStore.memberById(presence.userId).name }} {{ presence.mode }} for {{ presence.duration }}
      </span>
    </div>
  </section>

  <section class="members-layout">
    <div class="members-list">
      <article
        v-for="member in membersStore.members"
        :key="member.id"
        class="member-card-enhanced"
        :class="`is-${member.presence}`"
        :style="{ '--role-color': member.color }"
      >
        <div class="member-main-row">
          <span class="member-avatar" :data-status="member.presence">{{ member.initials }}</span>
          <div class="member-identity">
            <div class="member-name-row">
              <h2>{{ member.name }}</h2>
              <button v-if="member.role !== 'owner'" class="role-badge role-action" :class="member.role" type="button" @click="toggleRole(member)">
                {{ member.role.toUpperCase() }}
              </button>
              <span v-else class="role-badge owner">{{ member.role.toUpperCase() }}</span>
            </div>
            <p>{{ member.email }}</p>
          </div>
          <span class="member-status" :class="member.presence">{{ member.presence }}</span>
        </div>
        <div class="member-detail-grid">
          <div>
            <span>Activity</span>
            <strong>{{ member.activity }}</strong>
          </div>
          <div>
            <span>Last action</span>
            <strong>{{ member.presence === "offline" ? "Accepted invite yesterday" : "Changed workspace state recently" }}</strong>
          </div>
          <div>
            <span>Permission</span>
            <strong>{{ roleDescriptions[member.role] }}</strong>
          </div>
        </div>
      </article>
    </div>

    <aside class="roles-rail">
      <section class="settings-section-card role-guide-card">
        <div class="section-title-row">
          <p class="kicker">Role Rules</p>
          <span class="status-badge rls">RLS ACTIVE</span>
        </div>
        <div class="role-permission-list">
          <article v-for="(description, role) in roleDescriptions" :key="role">
            <span class="role-badge" :class="role">{{ role.toUpperCase() }}</span>
            <p>{{ description }}.</p>
          </article>
        </div>
      </section>

      <section class="settings-section-card">
        <div class="section-title-row">
          <p class="kicker">Share Link</p>
          <span class="status-badge synced">SYNCED</span>
        </div>
        <div class="share-box">https://realtime-kanban.local/invite/{{ selectedBoard.id }}</div>
        <button class="button primary" type="button" @click="inviteMember">Invite member</button>
      </section>
    </aside>
  </section>
</template>
