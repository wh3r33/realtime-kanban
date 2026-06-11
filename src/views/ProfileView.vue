<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import UserAvatar from "../components/UserAvatar.vue";
import { uploadProfileAvatar } from "../services/profileRepository";
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
const avatarStorageHint = computed(() => "If a public Supabase avatar bucket exists, files upload there first. Otherwise, paste a public avatar URL.");

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
    let uploadWarning = "";

    if (avatarFile.value) {
      const upload = await uploadProfileAvatar(avatarFile.value);
      if (upload.error) {
        uploadWarning = upload.error.message || "Avatar upload failed";
        nextAvatarUrl = nextAvatarUrl || authStore.profile?.avatar_url || "";
      } else {
        nextAvatarUrl = upload.data.avatarUrl;
        avatarUrl.value = nextAvatarUrl;
      }
    }

    const result = await authStore.updateProfile({
      name: displayName.value.trim(),
      avatarUrl: nextAvatarUrl || null
    });
    if (!result.ok) {
      uiStore.showToast(result.message || "Profile save failed");
      return;
    }
    resetAvatarFileSelection();
    if (uploadWarning) {
      uiStore.showToast(uploadWarning);
    }
    uiStore.showToast("Profile saved");
  } catch (error) {
    uiStore.showToast(error?.message || "Profile save failed");
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
    uiStore.showToast(error?.message || "Logout failed");
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
      <p class="kicker">Profile</p>
      <h1>{{ authStore.currentUserName || "No Supabase user" }}</h1>
      <p>{{ authStore.profile?.email || "Profile loads from public.profiles" }}</p>
    </div>
  </section>

  <section class="page-grid two-col profile-grid">
    <article class="settings-section-card">
      <div class="section-title-row">
        <div>
          <p class="kicker">Identity</p>
          <h2>Avatar and name</h2>
        </div>
        <span class="status-badge synced">SUPABASE PROFILE</span>
      </div>

      <div class="profile-avatar-row">
        <UserAvatar class="avatar large user-avatar" :src="currentAvatarSrc" :name="displayName || authStore.currentUserName" :initials="initials" />
        <div class="profile-avatar-copy">
          <strong>{{ displayName || authStore.currentUserName || "Supabase user" }}</strong>
          <span>{{ authStore.profile?.email || "public.profiles.email" }}</span>
          <span class="settings-helper-text">{{ avatarStorageHint }}</span>
        </div>
      </div>

      <label>
        Display name
        <input v-model="displayName" class="input" autocomplete="name" />
      </label>

      <div class="avatar-upload">
        <input ref="avatarInputRef" class="sr-only" type="file" accept="image/*" @change="handleAvatarFileChange" />
        <div class="avatar-upload-actions">
          <button class="button secondary" type="button" @click="openAvatarPicker">Choose avatar</button>
          <span class="avatar-file-chip" :class="{ empty: !avatarFileName }" :title="avatarFileName || 'No file selected'">
            {{ avatarFileName || "No file selected" }}
          </span>
        </div>
        <p class="settings-helper-text">PNG, JPG, or WebP. Smaller files work best.</p>
      </div>

      <label>
        Avatar URL
        <input v-model="avatarUrl" class="input" type="url" placeholder="https://example.com/avatar.png" autocomplete="url" />
      </label>

      <div class="drawer-actions">
        <button class="button primary" type="button" :disabled="saving" @click="saveProfile">
          {{ saving ? "Saving..." : "Save profile" }}
        </button>
        <button class="button secondary" type="button" @click="clearAvatar">Clear avatar</button>
        <button class="button danger" type="button" :disabled="loggingOut" @click="signOut">
          {{ loggingOut ? "Logging out..." : "Log out" }}
        </button>
      </div>
    </article>

    <article class="settings-section-card">
      <div class="section-title-row">
        <div>
          <p class="kicker">Session</p>
          <h2>Account access</h2>
        </div>
        <span class="status-badge synced">ACTIVE</span>
      </div>
      <div class="system-status-card">
        <span>User ID</span>
        <strong>{{ authStore.currentUserId || "No active session" }}</strong>
      </div>
      <div class="system-status-card">
        <span>Current role</span>
        <strong>{{ authStore.currentRole.toUpperCase() }}</strong>
      </div>
      <div class="system-status-card">
        <span>Avatar source</span>
        <strong>{{ avatarUrl.trim() ? "Profile URL / uploaded file" : "Initials fallback" }}</strong>
      </div>
      <p class="settings-helper-text">
        Logging out clears the workspace stores, ends the Supabase session, and returns you to the auth page.
      </p>
    </article>
  </section>
</template>
