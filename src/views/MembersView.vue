<script setup>
import { computed, onMounted, reactive } from "vue";
import UserAvatar from "../components/UserAvatar.vue";
import { useAuthStore } from "../stores/auth";
import { useBoardsStore } from "../stores/boards";
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";

const authStore = useAuthStore();
const boardsStore = useBoardsStore();
const membersStore = useMembersStore();
const uiStore = useUiStore();
const inviteForm = reactive({ email: "", role: "viewer" });

const selectedBoard = computed(() => boardsStore.selectedBoard);
const canManage = computed(() => authStore.canManageWorkspace);
const canInvite = computed(() => canManage.value && membersStore.invitationsSupported);
const roleDescriptions = {
  owner: "Full board control",
  editor: "Create, edit, and move cards",
  viewer: "Read-only access with visible presence"
};

async function inviteMember() {
  const result = await membersStore.createInvitation(boardsStore.selectedBoardId, inviteForm.email, inviteForm.role);
  if (result.error) {
    uiStore.showToast(result.error.message);
    return;
  }
  inviteForm.email = "";
  inviteForm.role = "viewer";
  uiStore.showToast(result.duplicate ? `Приглашение для ${result.invitation.email} уже существует` : `Invite created for ${result.invitation.email}`);
}

async function toggleRole(member) {
  const nextRole = member.role === "viewer" ? "editor" : "viewer";
  const result = await membersStore.changeRole(boardsStore.selectedBoardId, member.id, nextRole);
  uiStore.showToast(result.error ? result.error.message : `${member.name} changed to ${nextRole}`);
}

async function removeMember(member) {
  const result = await membersStore.removeMember(boardsStore.selectedBoardId, member.id);
  uiStore.showToast(result.error ? result.error.message : `${member.name} removed`);
}

async function revokeInvite(invitation) {
  const result = await membersStore.revokeInvitation(invitation.id);
  uiStore.showToast(result.error ? result.error.message : `Invite revoked for ${invitation.email}`);
}

onMounted(async () => {
  await membersStore.loadMembers(boardsStore.selectedBoardId);
  await membersStore.loadInvitations(boardsStore.selectedBoardId);
});
</script>

<template>
  <section class="page-header">
    <div class="header-line">
      <p class="kicker">Members & Roles</p>
      <div class="board-meta">
        <span class="status-badge synced">SUPABASE MEMBERS</span>
      </div>
    </div>
    <h1>{{ selectedBoard?.name || "Board" }} members</h1>
  </section>

  <section class="presence-strip" aria-label="Realtime member presence">
    <div>
      <span class="pulse-dot"></span>
      <strong>{{ membersStore.members.length }} members · {{ membersStore.onlineMembers.length }} online</strong>
    </div>
    <div class="presence-badges">
      <span class="status-badge" :class="membersStore.presenceConnected ? 'synced' : 'viewer'">{{ membersStore.presenceConnected ? 'PRESENCE LIVE' : 'PRESENCE OFFLINE' }}</span>
    </div>
    <div class="realtime-mini-feed">
      <span v-if="membersStore.editingUsers.length">{{ membersStore.editingUsers.length }} active editing signal{{ membersStore.editingUsers.length === 1 ? '' : 's' }}</span>
      <span v-else>No active editing signals</span>
    </div>
  </section>

  <section class="members-layout">
    <div class="members-list">
      <article
        v-for="member in membersStore.members"
        :key="member.id"
        class="member-card-enhanced"
        :class="member.presence === 'online' ? 'is-online' : 'is-offline'"
        :style="{ '--role-color': member.color }"
      >
        <div class="member-main-row">
          <UserAvatar
            class="member-avatar user-avatar"
            :src="member.avatarUrl || ''"
            :name="member.name"
            :initials="member.initials"
            :status="member.presence === 'online' ? 'online' : 'offline'"
          />
          <div class="member-identity">
            <div class="member-name-row">
              <h2>{{ member.name }}</h2>
              <button v-if="member.role !== 'owner'" class="role-badge role-action" :class="member.role" type="button" :disabled="!canManage" @click="toggleRole(member)">
                {{ member.role.toUpperCase() }}
              </button>
              <span v-else class="role-badge owner">{{ member.role.toUpperCase() }}</span>
            </div>
            <p>{{ member.email }}</p>
          </div>
          <span class="member-status" :class="member.presence === 'online' ? 'online' : 'offline'">{{ member.presence }}</span>
        </div>
        <div class="member-detail-grid">
          <div>
            <span>Activity</span>
            <strong>{{ member.activity }}</strong>
          </div>
          <div>
            <span>Last action</span>
            <strong>{{ membersStore.editingUsers.find((presence) => presence.userId === member.id)?.field || member.activity }}</strong>
          </div>
          <div>
            <span>Permission</span>
            <strong>{{ roleDescriptions[member.role] }}</strong>
          </div>
        </div>
        <button v-if="member.role !== 'owner'" class="button secondary" type="button" :disabled="!canManage" @click="removeMember(member)">Remove</button>
      </article>
      <div v-if="membersStore.members.length <= 1" class="empty-state informative">
        <strong>No collaborators yet</strong>
        <span>Only real board_members rows are shown. Use owner-only invitations to add collaborators.</span>
      </div>
    </div>

    <aside class="roles-rail">
      <section class="settings-section-card role-guide-card">
        <div class="section-title-row">
          <p class="kicker">Role Rules</p>
          <span class="status-badge viewer">RLS POLICY REQUIRED</span>
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
          <span class="status-badge" :class="membersStore.invitationsSupported ? 'synced' : 'viewer'">{{ membersStore.invitationsSupported ? 'CONNECTED' : 'MIGRATION REQUIRED' }}</span>
        </div>
        <form class="drawer-block" @submit.prevent="inviteMember">
          <input v-model="inviteForm.email" class="input" type="email" placeholder="teammate@example.com" :disabled="!canInvite" required />
          <select v-model="inviteForm.role" class="input" :disabled="!canInvite">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button class="button primary" type="submit" :disabled="!canInvite">Invite member</button>
        </form>
        <div v-if="!membersStore.invitationsSupported" class="empty-state compact">
          <strong>Invites require database migration.</strong>
          <span>The members page still works with existing board_members rows.</span>
        </div>
        <div class="invite-list">
          <div v-for="invitation in membersStore.invitations" :key="invitation.id" class="invite-row">
            <div>
              <strong>{{ invitation.email }}</strong>
              <span>{{ invitation.role }} · expires {{ new Date(invitation.expiresAt).toLocaleDateString() }}</span>
            </div>
            <button class="button secondary" type="button" :disabled="!canInvite" @click="revokeInvite(invitation)">Revoke</button>
          </div>
          <div v-if="!membersStore.invitations.length" class="empty-state compact">
            <strong>No pending invitations</strong>
            <span>Owner-created invitations will appear here.</span>
          </div>
        </div>
      </section>
    </aside>
  </section>
</template>
