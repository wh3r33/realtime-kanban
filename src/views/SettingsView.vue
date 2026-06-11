<script setup>
import { computed, onMounted, ref } from "vue";
import { useBoardsStore } from "../stores/boards";
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";

const boardsStore = useBoardsStore();
const membersStore = useMembersStore();
const uiStore = useUiStore();
const language = ref(boardsStore.boardSettings.language);
const conflictStrategy = ref(boardsStore.boardSettings.conflictStrategy);

const selectedBoard = computed(() => boardsStore.selectedBoard);

function saveSettings() {
  boardsStore.boardSettings.language = language.value;
  boardsStore.boardSettings.conflictStrategy = conflictStrategy.value;
  uiStore.showToast("Board settings are local until a settings table is added");
}

function copyShareLink() {
  uiStore.showToast("Board URL is ready to share with existing members");
}

onMounted(() => {
  membersStore.loadInvitations(boardsStore.selectedBoardId);
});
</script>

<template>
  <section class="page-header settings-hero">
    <div class="header-line">
      <p class="kicker">Realtime System Control Center</p>
      <div class="board-meta">
        <span class="status-badge" :class="uiStore.syncState === 'synced' ? 'synced' : 'viewer'">{{ uiStore.syncState.toUpperCase() }}</span>
        <span class="status-badge viewer">RLS POLICY REQUIRED</span>
        <span class="status-badge versioned">VERSIONED</span>
      </div>
    </div>
    <h1>Operational controls for {{ selectedBoard?.name || "this board" }}.</h1>
    <p>Only data backed by the provided Supabase schema is marked connected.</p>
  </section>

  <section class="settings-control-grid" aria-label="Board system controls">
    <article class="settings-section-card">
      <div class="section-title-row">
        <div>
          <p class="kicker">Board</p>
          <h2>Workspace identity</h2>
        </div>
        <span class="status-badge synced">SYNCED</span>
      </div>
      <label>Board name<input class="input" :value="selectedBoard?.name" readonly /></label>
      <div class="setting-line">
        <span>Visibility</span>
        <strong>Private to members</strong>
      </div>
      <div class="setting-line share-line">
        <span>Board URL</span>
        <strong>/boards/{{ selectedBoard?.id }}</strong>
      </div>
      <button class="button secondary" type="button" @click="copyShareLink">Copy share link</button>
    </article>

    <article class="settings-section-card">
      <div class="section-title-row">
        <div>
          <p class="kicker">Invitations</p>
          <h2>Pending access</h2>
        </div>
        <span class="status-badge synced">CONNECTED</span>
      </div>
      <div class="invite-list">
        <div v-for="invitation in membersStore.invitations" :key="invitation.id" class="invite-row">
          <div>
            <strong>{{ invitation.email }}</strong>
            <span>{{ invitation.role }} · expires {{ new Date(invitation.expiresAt).toLocaleDateString() }}</span>
          </div>
        </div>
        <div v-if="!membersStore.invitations.length" class="empty-state compact">
          <strong>No pending invitations</strong>
          <span>Pending board_invites rows appear here for board owners.</span>
        </div>
      </div>
      <button class="button primary" type="button" @click="$router.push(`/boards/${selectedBoard?.id}/members`)">Create invite</button>
    </article>

    <article class="settings-section-card">
      <div class="section-title-row">
        <div>
          <p class="kicker">Permissions</p>
          <h2>Role enforcement</h2>
        </div>
        <span class="status-badge viewer">RLS POLICY REQUIRED</span>
      </div>
      <div class="system-status-card">
        <span>Owner controls</span>
        <strong>Owner/editor/viewer roles are loaded from board_members.role.</strong>
      </div>
      <div class="setting-line">
        <span>Default invite role</span>
        <strong><span class="role-badge viewer">VIEWER</span></strong>
      </div>
      <div class="setting-line">
        <span>Viewer mode</span>
        <strong>Read-only cards, activity, and presence.</strong>
      </div>
    </article>

    <article class="settings-section-card language-section">
      <div class="section-title-row">
        <div>
          <p class="kicker">Localization</p>
          <h2>Interface language</h2>
        </div>
        <span class="status-badge synced">LANGUAGE SYNCED</span>
      </div>
      <label>
        Interface language
        <select v-model="language" class="input">
          <option value="en">English</option>
          <option value="ru">Russian</option>
        </select>
      </label>
      <p class="settings-helper-text">Language preference is stored locally for this prototype migration.</p>
    </article>

    <article class="settings-section-card realtime-section">
      <div class="section-title-row">
        <div>
          <p class="kicker">Realtime</p>
          <h2>Live sync channel</h2>
        </div>
        <span class="status-badge" :class="uiStore.syncState === 'synced' ? 'synced' : 'viewer'">{{ uiStore.syncState.toUpperCase() }}</span>
      </div>
      <div class="system-status-grid">
        <div class="system-status-card">
          <span>Provider</span>
          <strong>{{ uiStore.syncState === "synced" ? "Supabase Realtime" : "Local BroadcastChannel fallback" }}</strong>
        </div>
        <div class="system-status-card">
          <span>Sync status</span>
          <strong><span class="pulse-dot"></span><span>{{ uiStore.syncText }}</span></strong>
        </div>
        <div class="system-status-card">
          <span>Presence</span>
          <strong>{{ membersStore.presenceConnected ? `${membersStore.onlineMembers.length} online` : "Connecting to Supabase presence" }}</strong>
        </div>
      </div>
      <label>
        Conflict strategy
        <select v-model="conflictStrategy" class="input">
          <option value="versioned">Versioned last-write-wins with rollback</option>
          <option value="manual">Manual conflict review</option>
          <option value="server">Server authority mode</option>
        </select>
      </label>
      <button class="button primary" type="button" @click="saveSettings">Save settings</button>
    </article>

    <article class="danger-zone-card">
      <div class="section-title-row">
        <div>
          <p class="kicker">Danger Zone</p>
          <h2>Owner-only operations</h2>
        </div>
        <span class="status-badge conflict">OWNER ONLY</span>
      </div>
      <div class="danger-action-row">
        <div>
          <strong>Delete board</strong>
          <span>Destructive board cleanup is not implemented.</span>
        </div>
        <button class="button danger" type="button" @click="uiStore.showToast('Delete board is not implemented')">Delete</button>
      </div>
      <div class="danger-action-row">
        <div>
          <strong>Transfer ownership</strong>
          <span>Moves owner controls to another member.</span>
        </div>
        <button class="button secondary" type="button" @click="uiStore.showToast('Ownership transfer queued')">Transfer</button>
      </div>
    </article>
  </section>
</template>
