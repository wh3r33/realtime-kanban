<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import UserAvatar from "../components/UserAvatar.vue";
import { uploadProfileAvatar } from "../services/profileRepository";
import { t } from "../services/localization";
import { useAuthStore } from "../stores/auth";
import { useUiStore } from "../stores/ui";

const router = useRouter();
const authStore = useAuthStore();
const uiStore = useUiStore();
const displayName = ref("");
const avatarUrl = ref("");
const avatarFile = ref(null);
const avatarFileName = ref("");
const avatarPreviewUrl = ref("");
const avatarInputRef = ref(null);
const saving = ref(false);
const loggingOut = ref(false);

const initials = computed(() => (displayName.value || authStore.currentUserName || "US").trim().slice(0, 2).toUpperCase());
const currentAvatarSrc = computed(() => avatarPreviewUrl.value || avatarUrl.value || authStore.profile?.avatar_url || "");
const avatarStorageHint = computed(() => t("profile.storageHint"));

function syncProfileForm() {
  displayName.value = authStore.profile?.name || authStore.currentUserName || "";
  avatarUrl.value = authStore.profile?.avatar_url || "";
}

function handleAvatarFileChange(event) {
  const file = event.target.files?.[0] || null;
  avatarFile.value = file;
  avatarFileName.value = file?.name || "";
}

function openAvatarPicker() {
  avatarInputRef.value?.click();
}

function resetAvatarFileSelection() {
  avatarFile.value = null;
  avatarFileName.value = "";
  if (avatarInputRef.value) avatarInputRef.value.value = "";
  if (avatarPreviewUrl.value) URL.revokeObjectURL(avatarPreviewUrl.value);
  avatarPreviewUrl.value = "";
}

function clearAvatar() {
  avatarUrl.value = "";
  resetAvatarFileSelection();
}

async function saveProfile() {
  saving.value = true;
  try {
    let nextAvatarUrl = avatarUrl.value.trim();

    if (avatarFile.value) {
      const upload = await uploadProfileAvatar(avatarFile.value);
      if (upload.error) {
        uiStore.showToast(upload.error.message || t("messages.avatarUploadFailed"));
        return;
      }
      nextAvatarUrl = upload.data.avatarUrl;
      avatarUrl.value = nextAvatarUrl;
    }

    const result = await authStore.updateProfile({
      name: displayName.value.trim(),
      avatarUrl: nextAvatarUrl || null
    });
    if (!result.ok) {
      uiStore.showToast(result.message || t("messages.profileSaveFailed"));
      return;
    }
    resetAvatarFileSelection();
    uiStore.showToast(result.message || t("messages.profileSaved"));
  } catch (error) {
    uiStore.showToast(error?.message || t("messages.profileSaveFailed"));
  } finally {
    saving.value = false;
  }
}

async function signOut() {
  loggingOut.value = true;
  try {
    await authStore.signOut();
    router.replace("/auth/login?redirect=/boards");
  } catch (error) {
    uiStore.showToast(error?.message || t("common.logoutFailed"));
  } finally {
    loggingOut.value = false;
  }
}

watch(
  () => authStore.profile,
  () => {
    syncProfileForm();
  },
  { immediate: true }
);

watch(avatarFile, (file) => {
  if (avatarPreviewUrl.value) URL.revokeObjectURL(avatarPreviewUrl.value);
  avatarPreviewUrl.value = file ? URL.createObjectURL(file) : "";
});

onMounted(() => {
  authStore.initialize();
});

onBeforeUnmount(() => {
  if (avatarPreviewUrl.value) URL.revokeObjectURL(avatarPreviewUrl.value);
});
</script>

<template>
  <section class="profile-hero">
    <UserAvatar class="avatar large user-avatar" :src="currentAvatarSrc" :name="displayName || authStore.currentUserName" :initials="initials" />
    <div class="profile-hero-copy">
      <p class="kicker">{{ t("profile.title") }}</p>
      <h1>{{ authStore.currentUserName || t("profile.noSupabaseUser") }}</h1>
      <p>{{ authStore.profile?.email || t("profile.profileLoadsFromPublicProfiles") }}</p>
    </div>
  </section>

  <section class="page-grid two-col profile-grid">
    <article class="settings-section-card">
      <div class="section-title-row">
        <div>
          <p class="kicker">{{ t("profile.title") }}</p>
          <h2>{{ t("profile.avatarAndName") }}</h2>
        </div>
        <span class="status-badge synced">SUPABASE PROFILE</span>
      </div>

      <div class="profile-avatar-row">
        <UserAvatar class="avatar large user-avatar" :src="currentAvatarSrc" :name="displayName || authStore.currentUserName" :initials="initials" />
        <div class="profile-avatar-copy">
          <strong>{{ displayName || authStore.currentUserName || t("profile.supabaseUser") }}</strong>
          <span>{{ authStore.profile?.email || t("profile.publicProfileEmail") }}</span>
          <span class="settings-helper-text">{{ avatarStorageHint }}</span>
        </div>
      </div>

      <label>
        {{ t("profile.displayName") }}
        <input v-model="displayName" class="input" autocomplete="name" />
      </label>

      <div class="avatar-upload">
        <input ref="avatarInputRef" class="sr-only" type="file" accept="image/*" @change="handleAvatarFileChange" />
        <div class="avatar-upload-actions">
          <button class="button secondary" type="button" @click="openAvatarPicker">{{ t("common.chooseAvatar") }}</button>
          <span class="avatar-file-chip" :class="{ empty: !avatarFileName }" :title="avatarFileName || t('common.noFileSelected')">
            {{ avatarFileName || t("common.noFileSelected") }}
          </span>
        </div>
        <p class="settings-helper-text">{{ t("profile.storageNote") }}</p>
      </div>

      <label>
        {{ t("profile.avatarUrl") }}
        <input v-model="avatarUrl" class="input" type="url" placeholder="https://example.com/avatar.png" autocomplete="url" />
      </label>

      <div class="drawer-actions">
        <button class="button primary" type="button" :disabled="saving" @click="saveProfile">
          {{ saving ? t("common.saving") : t("profile.saveProfile") }}
        </button>
        <button class="button secondary" type="button" @click="clearAvatar">{{ t("common.clearAvatar") }}</button>
        <button class="button danger" type="button" :disabled="loggingOut" @click="signOut">
          {{ loggingOut ? t("common.working") : t("profile.logoutTitle") }}
        </button>
      </div>
    </article>

    <article class="settings-section-card">
      <div class="section-title-row">
        <div>
          <p class="kicker">{{ t("profile.session") }}</p>
          <h2>{{ t("profile.accountAccess") }}</h2>
        </div>
        <span class="status-badge synced">{{ t("profile.activeSession") }}</span>
      </div>
      <div class="system-status-card">
        <span>{{ t("profile.userId") }}</span>
        <strong>{{ authStore.currentUserId || t("profile.noActiveSession") }}</strong>
      </div>
      <div class="system-status-card">
        <span>{{ t("profile.currentRole") }}</span>
        <strong>{{ authStore.currentRole.toUpperCase() }}</strong>
      </div>
      <div class="system-status-card">
        <span>{{ t("profile.avatarSource") }}</span>
        <strong>{{ avatarUrl.trim() ? t("profile.profileUrlOrFile") : t("profile.initialsFallback") }}</strong>
      </div>
      <p class="settings-helper-text">
        {{ t("profile.logoutNote") }}
      </p>
    </article>
  </section>
</template>
