<script setup>
import { computed, onMounted, reactive } from "vue";
import UserAvatar from "../components/UserAvatar.vue";
import { useAuthStore } from "../stores/auth";
import { useBoardsStore } from "../stores/boards";
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";
import { t } from "../services/localization";

const authStore = useAuthStore();
const boardsStore = useBoardsStore();
const membersStore = useMembersStore();
const uiStore = useUiStore();
const inviteForm = reactive({ email: "", role: "viewer" });

const selectedBoard = computed(() => boardsStore.selectedBoard);
const canManage = computed(() => authStore.canManageWorkspace);
const canInvite = computed(() => authStore.canInviteMembers && membersStore.invitationsSupported);
const roleDescriptions = computed(() => ({
  owner: t("members.owner"),
  editor: t("members.editor"),
  viewer: t("members.viewer")
}));

async function inviteMember() {
  const result = await membersStore.createInvitation(boardsStore.selectedBoardId, inviteForm.email, inviteForm.role);
  if (result.error) {
    uiStore.showToast(result.error.message);
    return;
  }
  inviteForm.email = "";
  inviteForm.role = "viewer";
  uiStore.showToast(result.duplicate ? t("messages.inviteDuplicate", { email: result.invitation.email }) : t("messages.inviteCreated", { email: result.invitation.email }));
}

async function toggleRole(member) {
  const nextRole = member.role === "viewer" ? "editor" : "viewer";
  const result = await membersStore.changeRole(boardsStore.selectedBoardId, member.id, nextRole);
  uiStore.showToast(result.error ? result.error.message : t("messages.roleChanged", { name: member.name, role: nextRole }));
}

async function removeMember(member) {
  const result = await membersStore.removeMember(boardsStore.selectedBoardId, member.id);
  uiStore.showToast(result.error ? result.error.message : t("messages.memberRemoved", { name: member.name }));
}

async function revokeInvite(invitation) {
  const result = await membersStore.revokeInvitation(invitation.id);
  uiStore.showToast(result.error ? result.error.message : t("messages.inviteRevoked", { email: invitation.email }));
}

onMounted(async () => {
  await membersStore.loadMembers(boardsStore.selectedBoardId);
  await membersStore.loadInvitations(boardsStore.selectedBoardId);
});
</script>

<template>
  <section class="page-header">
    <div class="header-line">
      <p class="kicker">{{ t("members.title") }}</p>
      <div class="board-meta">
        <span class="status-badge synced">SUPABASE MEMBERS</span>
      </div>
    </div>
    <h1>{{ t("members.pageTitle", { board: selectedBoard?.name || t("nav.board") }) }}</h1>
  </section>

  <section class="presence-strip" aria-label="Realtime member presence">
    <div>
      <span class="pulse-dot"></span>
      <strong>{{ membersStore.members.length }} members · {{ t("members.onlineMembers", { count: membersStore.onlineMembers.length }) }}</strong>
    </div>
    <div class="presence-badges">
      <span class="status-badge" :class="membersStore.presenceConnected ? 'synced' : 'viewer'">{{ membersStore.presenceConnected ? t("members.presenceLive") : t("members.presenceOffline") }}</span>
    </div>
    <div class="realtime-mini-feed">
      <span v-if="membersStore.editingUsers.length">{{ membersStore.editingUsers.length }} {{ t("members.activeSignals") }}</span>
      <span v-else>{{ t("members.noActiveSignals") }}</span>
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
            <span>{{ t("members.activity") }}</span>
            <strong>{{ member.activity }}</strong>
          </div>
          <div>
            <span>{{ t("members.lastAction") }}</span>
            <strong>{{ membersStore.editingUsers.find((presence) => presence.userId === member.id)?.field || member.activity }}</strong>
          </div>
          <div>
            <span>{{ t("members.permission") }}</span>
            <strong>{{ roleDescriptions[member.role] }}</strong>
          </div>
        </div>
        <button v-if="member.role !== 'owner'" class="button secondary" type="button" :disabled="!canManage" @click="removeMember(member)">Remove</button>
      </article>
      <div v-if="membersStore.members.length <= 1" class="empty-state informative">
        <strong>{{ t("members.noCollaborators") }}</strong>
        <span>{{ t("members.noCollaboratorsBody") }}</span>
      </div>
    </div>

    <aside class="roles-rail">
      <section class="settings-section-card role-guide-card">
        <div class="section-title-row">
          <p class="kicker">{{ t("members.roleRules") }}</p>
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
          <p class="kicker">{{ t("members.shareLink") }}</p>
          <span class="status-badge" :class="membersStore.invitationsSupported ? 'synced' : 'viewer'">{{ membersStore.invitationsSupported ? 'CONNECTED' : 'MIGRATION REQUIRED' }}</span>
        </div>
        <form class="drawer-block" @submit.prevent="inviteMember">
          <input v-model="inviteForm.email" class="input" type="email" placeholder="teammate@example.com" :disabled="!canInvite" required />
          <select v-model="inviteForm.role" class="input" :disabled="!canInvite">
            <option value="viewer">{{ t("members.viewer") }}</option>
            <option value="editor">{{ t("members.editor") }}</option>
          </select>
          <button class="button primary" type="submit" :disabled="!canInvite">{{ t("members.inviteMember") }}</button>
        </form>
        <div v-if="!membersStore.invitationsSupported" class="empty-state compact">
          <strong>{{ t("members.invitesNeedMigration") }}</strong>
          <span>{{ t("members.inviteBody") }}</span>
        </div>
        <div class="invite-list">
          <div v-for="invitation in membersStore.invitations" :key="invitation.id" class="invite-row">
            <div>
              <strong>{{ invitation.email }}</strong>
              <span>{{ invitation.role }} - {{ t("members.expires") }} {{ new Date(invitation.expiresAt).toLocaleDateString() }}</span>
            </div>
            <button class="button secondary" type="button" :disabled="!canInvite" @click="revokeInvite(invitation)">Revoke</button>
          </div>
          <div v-if="!membersStore.invitations.length" class="empty-state compact">
            <strong>{{ t("members.noPendingInvites") }}</strong>
            <span>{{ t("members.noPendingInvitesBody") }}</span>
          </div>
        </div>
      </section>
    </aside>
  </section>
</template>
