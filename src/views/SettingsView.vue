<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { deleteBoard, transferBoardOwnership } from "../services/boardRepository";
import { useAuthStore } from "../stores/auth";
import { useBoardsStore } from "../stores/boards";
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";

const router = useRouter();
const authStore = useAuthStore();
const boardsStore = useBoardsStore();
const membersStore = useMembersStore();
const uiStore = useUiStore();
const language = ref(boardsStore.boardSettings.language);
const conflictStrategy = ref(boardsStore.boardSettings.conflictStrategy);
const languageOpen = ref(false);
const languagePickerRef = ref(null);
const dangerModal = ref("");
const dangerBusy = ref(false);
const dangerMessage = ref("");
const deleteConfirm = ref("");
const transferTargetId = ref("");

const selectedBoard = computed(() => boardsStore.selectedBoard);
const selectedBoardMembers = computed(() => membersStore.members || []);
const transferCandidates = computed(() => selectedBoardMembers.value.filter((member) => member.id !== authStore.currentUserId));
const canManageDanger = computed(() => authStore.canManageWorkspace && Boolean(selectedBoard.value?.id));
const languageOptions = [
  { value: "en", label: "English", detail: "Interface in English" },
  { value: "ru", label: "Russian", detail: "Интерфейс на русском" }
];

function saveSettings() {
  boardsStore.setLanguage(language.value);
  boardsStore.boardSettings.conflictStrategy = conflictStrategy.value;
  uiStore.showToast("Board settings are local until a settings table is added");
}

function selectLanguage(option) {
  language.value = option.value;
  boardsStore.setLanguage(option.value);
  languageOpen.value = false;
}

function toggleLanguagePicker() {
  languageOpen.value = !languageOpen.value;
}

function closeLanguagePicker(event) {
  if (!languagePickerRef.value) return;
  if (languagePickerRef.value.contains(event.target)) return;
  languageOpen.value = false;
}

function copyShareLink() {
  uiStore.showToast("Board URL is ready to share with existing members");
}

function openDangerModal(action) {
  dangerMessage.value = "";
  dangerModal.value = action;
  deleteConfirm.value = "";
  transferTargetId.value = transferCandidates.value[0]?.id || "";
}

function closeDangerModal() {
  dangerModal.value = "";
  dangerBusy.value = false;
  dangerMessage.value = "";
  deleteConfirm.value = "";
  transferTargetId.value = "";
}

async function confirmDeleteBoard() {
  if (!selectedBoard.value?.id) return;
  if (deleteConfirm.value.trim().toLowerCase() !== (selectedBoard.value.name || "").trim().toLowerCase()) {
    dangerMessage.value = "Type the board name exactly to confirm deletion.";
    return;
  }
  dangerBusy.value = true;
  dangerMessage.value = "";
  try {
    const result = await deleteBoard(selectedBoard.value.id);
    if (result.error) {
      dangerMessage.value = result.error.message || "Board deletion failed.";
      uiStore.showToast(dangerMessage.value);
      return;
    }
    boardsStore.resetWorkspace();
    membersStore.resetWorkspace();
    uiStore.showToast("Board deleted");
    closeDangerModal();
    router.push("/boards");
  } catch (error) {
    dangerMessage.value = error?.message || "Board deletion failed.";
    uiStore.showToast(dangerMessage.value);
  } finally {
    dangerBusy.value = false;
  }
}

async function confirmTransferOwnership() {
  if (!selectedBoard.value?.id || !transferTargetId.value) return;
  if (transferTargetId.value === authStore.currentUserId) {
    dangerMessage.value = "Choose another board member.";
    return;
  }
  dangerBusy.value = true;
  dangerMessage.value = "";
  try {
    const result = await transferBoardOwnership(selectedBoard.value.id, transferTargetId.value);
    if (result.error) {
      dangerMessage.value = result.error.message || "Ownership transfer failed.";
      uiStore.showToast(dangerMessage.value);
      return;
    }
    await boardsStore.loadBoards();
    await membersStore.loadMembers(selectedBoard.value.id);
    uiStore.showToast("Ownership transferred");
    closeDangerModal();
  } catch (error) {
    dangerMessage.value = error?.message || "Ownership transfer failed.";
    uiStore.showToast(dangerMessage.value);
  } finally {
    dangerBusy.value = false;
  }
}

watch(
  () => transferCandidates.value,
  (members) => {
    if (!transferTargetId.value || !members.some((member) => member.id === transferTargetId.value)) {
      transferTargetId.value = members[0]?.id || "";
    }
  },
  { immediate: true }
);

onMounted(async () => {
  await membersStore.loadMembers(boardsStore.selectedBoardId);
  await membersStore.loadInvitations(boardsStore.selectedBoardId);
  document.addEventListener("click", closeLanguagePicker);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", closeLanguagePicker);
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
      <button class="button primary" type="button" @click="router.push(`/boards/${selectedBoard?.id}/members`)">Create invite</button>
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
      <div ref="languagePickerRef" class="custom-select language-picker" :class="{ open: languageOpen }">
        <button
          class="custom-select-trigger language-trigger"
          type="button"
          aria-haspopup="listbox"
          :aria-expanded="languageOpen"
          @click.stop="toggleLanguagePicker"
        >
          <div>
            <small>Interface language</small>
            <strong>{{ languageOptions.find((option) => option.value === language)?.label || "English" }}</strong>
            <em>{{ languageOptions.find((option) => option.value === language)?.detail || "Interface in English" }}</em>
          </div>
          <svg class="select-chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 9 6 6 6-6"></path>
          </svg>
        </button>
        <div class="custom-select-menu" role="listbox" aria-label="Interface language">
          <button
            v-for="option in languageOptions"
            :key="option.value"
            class="custom-select-option"
            :class="{ active: language === option.value }"
            type="button"
            role="option"
            :aria-selected="language === option.value"
            @click.stop="selectLanguage(option)"
          >
            <div>
              <strong>{{ option.label }}</strong>
              <span>{{ option.detail }}</span>
            </div>
            <span class="custom-select-check" aria-hidden="true">{{ language === option.value ? "✓" : "" }}</span>
          </button>
        </div>
      </div>
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
          <strong>{{ membersStore.presenceConnected ? `${membersStore.onlineMembers.length} online` : membersStore.presenceMessage }}</strong>
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
          <span>Deletes the board and its cascaded board data. Owner only.</span>
        </div>
        <button class="button danger" type="button" :disabled="!canManageDanger" @click="openDangerModal('delete')">Delete</button>
      </div>
      <div class="danger-action-row">
        <div>
          <strong>Transfer ownership</strong>
          <span>Moves owner control to another existing board member.</span>
        </div>
        <button class="button secondary" type="button" :disabled="!canManageDanger || !transferCandidates.length" @click="openDangerModal('transfer')">Transfer</button>
      </div>
    </article>
  </section>

  <div v-if="dangerModal" class="modal-backdrop" role="presentation" @click.self="closeDangerModal">
    <section class="modal danger-modal settings-danger-modal" role="dialog" aria-modal="true" :aria-labelledby="dangerModal === 'delete' ? 'delete-board-title' : 'transfer-board-title'">
      <button class="button secondary modal-close" type="button" @click="closeDangerModal">Close</button>
      <div class="modal-body">
        <template v-if="dangerModal === 'delete'">
          <h2 id="delete-board-title">Delete {{ selectedBoard?.name }}</h2>
          <p>Type the board name below to confirm permanent deletion. Board members, cards, columns, activity, and invites are removed through cascade rules.</p>
          <div class="modal-form">
            <label>
              Confirm board name
              <input v-model="deleteConfirm" class="input" :placeholder="selectedBoard?.name || 'Board name'" autocomplete="off" />
            </label>
            <p v-if="dangerMessage" class="security-note" role="alert">{{ dangerMessage }}</p>
            <div class="modal-actions">
              <button class="button danger" type="button" :disabled="dangerBusy || !selectedBoard?.id" @click="confirmDeleteBoard">
                {{ dangerBusy ? "Deleting..." : "Delete board" }}
              </button>
              <button class="button secondary" type="button" @click="closeDangerModal">Cancel</button>
            </div>
          </div>
        </template>
        <template v-else>
          <h2 id="transfer-board-title">Transfer ownership</h2>
          <p>Select another member who should become the board owner. Your role becomes editor after the transfer.</p>
          <div class="modal-form">
            <label>
              New owner
              <select v-model="transferTargetId" class="input" :disabled="!transferCandidates.length">
                <option value="" disabled>Select a board member</option>
                <option v-for="member in transferCandidates" :key="member.id" :value="member.id">
                  {{ member.name }}{{ member.email ? ` · ${member.email}` : "" }}
                </option>
              </select>
            </label>
            <p v-if="dangerMessage" class="security-note" role="alert">{{ dangerMessage }}</p>
            <div class="modal-actions">
              <button class="button primary" type="button" :disabled="dangerBusy || !transferTargetId" @click="confirmTransferOwnership">
                {{ dangerBusy ? "Transferring..." : "Transfer ownership" }}
              </button>
              <button class="button secondary" type="button" @click="closeDangerModal">Cancel</button>
            </div>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>
