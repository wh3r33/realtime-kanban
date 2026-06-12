<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { deleteBoard, transferBoardOwnership } from "../services/boardRepository";
import { useAuthStore } from "../stores/auth";
import { useBoardsStore } from "../stores/boards";
import { useMembersStore } from "../stores/members";
import { useUiStore } from "../stores/ui";
import { t } from "../services/localization";

const router = useRouter();
const authStore = useAuthStore();
const boardsStore = useBoardsStore();
const membersStore = useMembersStore();
const uiStore = useUiStore();
const language = ref(boardsStore.boardSettings.language);
const conflictStrategy = ref(boardsStore.boardSettings.conflictStrategy);
const languageOpen = ref(false);
const conflictStrategyOpen = ref(false);
const languagePickerRef = ref(null);
const conflictStrategyPickerRef = ref(null);
const transferOpen = ref(false);
const transferPickerRef = ref(null);
const dangerModal = ref("");
const dangerBusy = ref(false);
const dangerMessage = ref("");
const deleteConfirm = ref("");
const transferTargetId = ref("");

const selectedBoard = computed(() => boardsStore.selectedBoard);
const selectedBoardMembers = computed(() => membersStore.members || []);
const transferCandidates = computed(() => selectedBoardMembers.value.filter((member) => member.id !== authStore.currentUserId));
const canManageDanger = computed(() => authStore.canManageWorkspace && Boolean(selectedBoard.value?.id));
const languageOptions = computed(() => [
  { value: "en", label: t("settings.languageEnglish"), detail: t("settings.languageEnglishDetail") },
  { value: "ru", label: t("settings.languageRussian"), detail: t("settings.languageRussianDetail") }
]);
const conflictStrategyOptions = computed(() => [
  { value: "versioned", label: t("settings.conflictStrategyVersioned"), detail: t("settings.conflictStrategyVersionedDetail") },
  { value: "manual", label: t("settings.conflictStrategyManual"), detail: t("settings.conflictStrategyManualDetail") },
  { value: "server", label: t("settings.conflictStrategyServer"), detail: t("settings.conflictStrategyServerDetail") }
]);

function saveSettings() {
  boardsStore.setLanguage(language.value);
  boardsStore.boardSettings.conflictStrategy = conflictStrategy.value;
  uiStore.showToast(t("settings.saveSettings"));
}

function selectLanguage(option) {
  language.value = option.value;
  boardsStore.setLanguage(option.value);
  languageOpen.value = false;
}

function selectConflictStrategy(option) {
  conflictStrategy.value = option.value;
  boardsStore.boardSettings.conflictStrategy = option.value;
  conflictStrategyOpen.value = false;
}

function selectTransferTarget(member) {
  transferTargetId.value = member.id;
  transferOpen.value = false;
}

function toggleLanguagePicker() {
  languageOpen.value = !languageOpen.value;
}

function toggleConflictStrategyPicker() {
  conflictStrategyOpen.value = !conflictStrategyOpen.value;
}

function toggleTransferPicker() {
  transferOpen.value = !transferOpen.value;
}

function closeLanguagePicker(event) {
  if (
    languagePickerRef.value?.contains(event.target) ||
    conflictStrategyPickerRef.value?.contains(event.target) ||
    transferPickerRef.value?.contains(event.target)
  ) return;
  languageOpen.value = false;
  conflictStrategyOpen.value = false;
  transferOpen.value = false;
}

function copyShareLink() {
  uiStore.showToast(t("settings.copyShareLink"));
}

function openDangerModal(action) {
  dangerMessage.value = "";
  dangerModal.value = action;
  deleteConfirm.value = "";
  transferTargetId.value = transferCandidates.value[0]?.id || "";
  transferOpen.value = false;
}

function closeDangerModal() {
  dangerModal.value = "";
  dangerBusy.value = false;
  dangerMessage.value = "";
  deleteConfirm.value = "";
  transferTargetId.value = "";
  transferOpen.value = false;
}

async function confirmDeleteBoard() {
  if (!selectedBoard.value?.id) return;
  if (deleteConfirm.value.trim().toLowerCase() !== (selectedBoard.value.name || "").trim().toLowerCase()) {
    dangerMessage.value = t("settings.deleteConfirmHint");
    return;
  }
  dangerBusy.value = true;
  dangerMessage.value = "";
  try {
    const result = await deleteBoard(selectedBoard.value.id);
    if (result.error) {
      dangerMessage.value = result.error.message || t("settings.boardDeletionFailed");
      uiStore.showToast(dangerMessage.value);
      return;
    }
    boardsStore.resetWorkspace();
    membersStore.resetWorkspace();
    uiStore.showToast(t("messages.boardDeleted"));
    closeDangerModal();
    router.push("/boards");
  } catch (error) {
    dangerMessage.value = error?.message || t("settings.boardDeletionFailed");
    uiStore.showToast(dangerMessage.value);
  } finally {
    dangerBusy.value = false;
  }
}

async function confirmTransferOwnership() {
  if (!selectedBoard.value?.id || !transferTargetId.value) return;
  if (transferTargetId.value === authStore.currentUserId) {
    dangerMessage.value = t("settings.chooseAnotherMember");
    return;
  }
  dangerBusy.value = true;
  dangerMessage.value = "";
  try {
    const result = await transferBoardOwnership(selectedBoard.value.id, transferTargetId.value);
    if (result.error) {
      dangerMessage.value = result.error.message || t("settings.ownershipTransferFailed");
      uiStore.showToast(dangerMessage.value);
      return;
    }
    await boardsStore.loadBoards();
    await membersStore.loadMembers(selectedBoard.value.id);
    uiStore.showToast(t("messages.ownershipTransferred"));
    closeDangerModal();
  } catch (error) {
    dangerMessage.value = error?.message || t("settings.ownershipTransferFailed");
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
      <p class="kicker">{{ t("settings.systemControlCenter") }}</p>
      <div class="board-meta">
        <span class="status-badge" :class="uiStore.syncState === 'synced' ? 'synced' : 'viewer'">{{ uiStore.syncState.toUpperCase() }}</span>
        <span class="status-badge viewer">{{ t("settings.rlsRequired") }}</span>
        <span class="status-badge versioned">{{ t("settings.versioned") }}</span>
      </div>
    </div>
    <h1>{{ t("settings.title", { board: selectedBoard?.name || "this board" }) }}</h1>
    <p>{{ t("settings.subtitle") }}</p>
  </section>

  <section class="settings-control-grid" aria-label="Board system controls">
    <article class="settings-section-card">
      <div class="section-title-row">
        <div>
          <p class="kicker">{{ t("settings.boardSection") }}</p>
          <h2>{{ t("settings.workspaceIdentity") }}</h2>
        </div>
        <span class="status-badge synced">{{ t("settings.synced") }}</span>
      </div>
      <label>{{ t("board.titleField") }}<input class="input" :value="selectedBoard?.name" readonly /></label>
      <div class="setting-line">
        <span>{{ t("settings.ownerControls") }}</span>
        <strong>{{ t("settings.privateToMembers") }}</strong>
      </div>
      <div class="setting-line share-line">
        <span>{{ t("settings.boardUrl") }}</span>
        <strong>/boards/{{ selectedBoard?.id }}</strong>
      </div>
      <button class="button secondary" type="button" @click="copyShareLink">{{ t("settings.copyShareLink") }}</button>
    </article>

    <article class="settings-section-card">
      <div class="section-title-row">
        <div>
          <p class="kicker">{{ t("settings.invitationsSection") }}</p>
          <h2>{{ t("settings.pendingAccess") }}</h2>
        </div>
        <span class="status-badge synced">{{ t("settings.connected") }}</span>
      </div>
      <div class="invite-list">
        <div v-for="invitation in membersStore.invitations" :key="invitation.id" class="invite-row">
          <div>
            <strong>{{ invitation.email }}</strong>
            <span>{{ invitation.role }} - {{ t("members.expires") }} {{ new Date(invitation.expiresAt).toLocaleDateString() }}</span>
          </div>
        </div>
        <div v-if="!membersStore.invitations.length" class="empty-state compact">
          <strong>{{ t("members.noPendingInvites") }}</strong>
          <span>{{ t("members.noPendingInvitesBody") }}</span>
        </div>
      </div>
      <button class="button primary" type="button" @click="router.push(`/boards/${selectedBoard?.id}/members`)">{{ t("settings.createInvite") }}</button>
    </article>

    <article class="settings-section-card">
      <div class="section-title-row">
        <div>
          <p class="kicker">{{ t("settings.permissionsSection") }}</p>
          <h2>{{ t("settings.roleEnforcement") }}</h2>
        </div>
        <span class="status-badge viewer">{{ t("settings.rlsRequired") }}</span>
      </div>
      <div class="system-status-card">
        <span>{{ t("settings.ownerControls") }}</span>
        <strong>Owner/editor/viewer roles are loaded from board_members.role.</strong>
      </div>
      <div class="setting-line">
        <span>{{ t("settings.defaultInviteRole") }}</span>
        <strong><span class="role-badge viewer">VIEWER</span></strong>
      </div>
      <div class="setting-line">
        <span>{{ t("settings.viewerMode") }}</span>
        <strong>Read-only cards, activity, and presence.</strong>
      </div>
    </article>

    <article class="settings-section-card language-section">
      <div class="section-title-row">
        <div>
          <p class="kicker">{{ t("settings.localizationSection") }}</p>
          <h2>{{ t("settings.interfaceLanguage") }}</h2>
        </div>
        <span class="status-badge synced">{{ t("settings.languageSynced") }}</span>
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
            <small>{{ t("settings.interfaceLanguage") }}</small>
            <strong>{{ languageOptions.find((option) => option.value === language)?.label || t("settings.languageEnglish") }}</strong>
            <em>{{ languageOptions.find((option) => option.value === language)?.detail || t("settings.languageEnglishDetail") }}</em>
          </div>
          <svg class="select-chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 9 6 6 6-6"></path>
          </svg>
        </button>
        <div v-if="languageOpen" class="custom-select-menu" role="listbox" :aria-label="t('settings.interfaceLanguage')">
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
      <p class="settings-helper-text">{{ t("settings.languagePreference") }}</p>
    </article>

    <article class="settings-section-card realtime-section">
      <div class="section-title-row">
        <div>
          <p class="kicker">{{ t("settings.realtimeSection") }}</p>
          <h2>{{ t("settings.liveSync") }}</h2>
        </div>
        <span class="status-badge" :class="uiStore.syncState === 'synced' ? 'synced' : 'viewer'">{{ uiStore.syncState.toUpperCase() }}</span>
      </div>
      <div class="system-status-grid">
        <div class="system-status-card">
          <span>{{ t("settings.realtimeProvider") }}</span>
          <strong>{{ uiStore.syncState === "synced" ? t("settings.realtimeLive") : t("settings.realtimeFallback") }}</strong>
        </div>
        <div class="system-status-card">
          <span>{{ t("settings.realtimeStatus") }}</span>
          <strong><span class="pulse-dot"></span><span>{{ uiStore.syncText }}</span></strong>
        </div>
        <div class="system-status-card">
          <span>{{ t("settings.realtimePresence") }}</span>
          <strong>{{ membersStore.presenceConnected ? `${membersStore.onlineMembers.length} online` : membersStore.presenceMessage }}</strong>
        </div>
      </div>
      <label>
        {{ t("settings.conflictStrategy") }}
        <div ref="conflictStrategyPickerRef" class="custom-select language-picker" :class="{ open: conflictStrategyOpen }">
          <button
            class="custom-select-trigger language-trigger"
            type="button"
            aria-haspopup="listbox"
            :aria-expanded="conflictStrategyOpen"
            @click.stop="toggleConflictStrategyPicker"
          >
            <div>
              <small>{{ t("settings.conflictStrategy") }}</small>
              <strong>{{ conflictStrategyOptions.find((option) => option.value === conflictStrategy)?.label || t("settings.conflictStrategyVersioned") }}</strong>
              <em>{{ conflictStrategyOptions.find((option) => option.value === conflictStrategy)?.detail || "" }}</em>
            </div>
            <svg class="select-chevron" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 9 6 6 6-6"></path>
            </svg>
          </button>
          <div v-if="conflictStrategyOpen" class="custom-select-menu" role="listbox" :aria-label="t('settings.conflictStrategy')">
            <button
              v-for="option in conflictStrategyOptions"
              :key="option.value"
              class="custom-select-option"
              :class="{ active: conflictStrategy === option.value }"
              type="button"
              role="option"
              :aria-selected="conflictStrategy === option.value"
              @click.stop="selectConflictStrategy(option)"
            >
              <div>
                <strong>{{ option.label }}</strong>
                <span>{{ option.detail }}</span>
              </div>
              <span class="custom-select-check" aria-hidden="true">{{ conflictStrategy === option.value ? "✓" : "" }}</span>
            </button>
          </div>
        </div>
      </label>
      <button class="button primary" type="button" @click="saveSettings">{{ t("settings.saveSettings") }}</button>
    </article>

    <article class="danger-zone-card">
      <div class="section-title-row">
        <div>
          <p class="kicker">Danger Zone</p>
          <h2>{{ t("settings.ownerOnly") }}</h2>
        </div>
        <span class="status-badge conflict">OWNER ONLY</span>
      </div>
      <div class="danger-action-row">
        <div>
          <strong>{{ t("settings.deleteBoard") }}</strong>
          <span>{{ t("settings.deleteBoardBody") }}</span>
        </div>
      <button class="button danger" type="button" :disabled="!canManageDanger" @click="openDangerModal('delete')">{{ t("common.delete") }}</button>
      </div>
      <div class="danger-action-row">
        <div>
          <strong>{{ t("settings.transferOwnership") }}</strong>
          <span>{{ t("settings.transferOwnershipBody") }}</span>
        </div>
      <button class="button secondary" type="button" :disabled="!canManageDanger || !transferCandidates.length" @click="openDangerModal('transfer')">{{ t("common.transfer") }}</button>
      </div>
    </article>
  </section>

  <div v-if="dangerModal" class="modal-backdrop" role="presentation" @click.self="closeDangerModal">
    <section class="modal danger-modal settings-danger-modal" role="dialog" aria-modal="true" :aria-labelledby="dangerModal === 'delete' ? 'delete-board-title' : 'transfer-board-title'">
      <button class="button secondary modal-close" type="button" @click="closeDangerModal">{{ t("common.close") }}</button>
      <div class="modal-body">
        <template v-if="dangerModal === 'delete'">
          <h2 id="delete-board-title">{{ t("settings.deleteConfirmTitle", { board: selectedBoard?.name }) }}</h2>
          <p>{{ t("settings.deleteConfirmBody") }}</p>
          <div class="modal-form">
            <label>
              {{ t("settings.confirmBoardName") }}
              <input v-model="deleteConfirm" class="input" :placeholder="selectedBoard?.name || t('board.titleField')" autocomplete="off" />
            </label>
            <p v-if="dangerMessage" class="security-note" role="alert">{{ dangerMessage }}</p>
            <div class="modal-actions">
              <button class="button danger" type="button" :disabled="dangerBusy || !selectedBoard?.id" @click="confirmDeleteBoard">
                {{ dangerBusy ? t("common.working") : t("settings.deleteBoard") }}
              </button>
              <button class="button secondary" type="button" @click="closeDangerModal">{{ t("common.cancel") }}</button>
            </div>
          </div>
        </template>
        <template v-else>
          <h2 id="transfer-board-title">{{ t("settings.transferConfirmTitle") }}</h2>
          <p>{{ t("settings.transferConfirmBody") }}</p>
          <div class="modal-form">
            <label>
              {{ t("settings.newOwner") }}
              <div ref="transferPickerRef" class="custom-select language-picker" :class="{ open: transferOpen }">
                <button
                  class="custom-select-trigger language-trigger"
                  type="button"
                  aria-haspopup="listbox"
                  :aria-expanded="transferOpen"
                  :disabled="!transferCandidates.length"
                  @click.stop="toggleTransferPicker"
                >
                  <div>
                    <small>{{ t("settings.newOwner") }}</small>
                    <strong>{{ transferCandidates.find((member) => member.id === transferTargetId)?.name || t("common.selectBoardMember") }}</strong>
                    <em>{{ transferCandidates.find((member) => member.id === transferTargetId)?.email || "" }}</em>
                  </div>
                  <svg class="select-chevron" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m6 9 6 6 6-6"></path>
                  </svg>
                </button>
                <div v-if="transferOpen" class="custom-select-menu" role="listbox" :aria-label="t('settings.newOwner')">
                  <button
                    v-for="member in transferCandidates"
                    :key="member.id"
                    class="custom-select-option"
                    :class="{ active: transferTargetId === member.id }"
                    type="button"
                    role="option"
                    :aria-selected="transferTargetId === member.id"
                    @click.stop="selectTransferTarget(member)"
                  >
                    <div>
                      <strong>{{ member.name }}</strong>
                      <span>{{ member.email || member.role }}</span>
                    </div>
                    <span class="custom-select-check" aria-hidden="true">{{ transferTargetId === member.id ? "✓" : "" }}</span>
                  </button>
                </div>
              </div>
            </label>
            <p v-if="dangerMessage" class="security-note" role="alert">{{ dangerMessage }}</p>
            <div class="modal-actions">
              <button class="button primary" type="button" :disabled="dangerBusy || !transferTargetId" @click="confirmTransferOwnership">
                {{ dangerBusy ? t("common.working") : t("settings.transferOwnership") }}
              </button>
              <button class="button secondary" type="button" @click="closeDangerModal">{{ t("common.cancel") }}</button>
            </div>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>
