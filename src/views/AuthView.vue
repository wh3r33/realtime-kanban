<script setup>
import { computed, reactive, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { t } from "../services/localization";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const busy = ref(false);
const message = ref("");

const mode = computed(() => {
  if (route.path.includes("register")) return "register";
  if (route.path.includes("forgot-password")) return "forgot";
  if (route.path.includes("invitations") || route.path.includes("accept-invitation")) return "invite";
  return "login";
});

const copy = computed(() => ({
  login: {
    title: t("auth.signInTitle"),
    body: t("auth.signInBody"),
    submit: t("common.signIn")
  },
  register: {
    title: t("auth.registerTitle"),
    body: t("auth.registerBody"),
    submit: t("common.createAccount")
  },
  forgot: {
    title: t("auth.forgotTitle"),
    body: t("auth.forgotBody"),
    submit: t("auth.forgotTitle")
  },
  invite: {
    title: t("auth.inviteTitle"),
    body: t("auth.inviteBody"),
    submit: t("auth.inviteTitle")
  }
}[mode.value]));

const form = reactive({
  name: "Demo User",
  email: "nn.user@example.com",
  password: "password",
  role: "viewer"
});

function normalizeAuthMessage(rawMessage, authMode) {
  const message = (rawMessage || "").trim();
  if (!message) {
    if (authMode === "forgot") return t("auth.resetSent");
    return t("auth.authFailed");
  }
  if (authMode === "login" && /invalid.*(login|credential)|incorrect.*password|invalid email or password/i.test(message)) {
    return t("auth.invalidLogin");
  }
  if (authMode === "register" && /already.*(registered|exists)|duplicate/i.test(message)) {
    return t("auth.accountExists");
  }
  if (authMode === "forgot") {
    return /invalid.*email|not found|user not found/i.test(message)
      ? t("auth.resetSent")
      : t("auth.authFailed");
  }
  if (authMode === "invite") {
    return t("auth.inviteFailed");
  }
  return t("auth.authFailed");
}

async function submit() {
  busy.value = true;
  message.value = "";
  let result;
  if (mode.value === "invite") {
    if (!authStore.isAuthenticated) {
      const signInResult = await authStore.submitAuth("login", {
        email: form.email,
        password: form.password
      });
      if (!signInResult.ok) result = signInResult;
    }
    if (!result) result = await authStore.acceptInvitation(route.params.token || route.query.token);
  } else {
    result = await authStore.submitAuth(mode.value, {
      name: form.name,
      email: form.email,
      password: form.password,
      role: form.role
    });
  }
  busy.value = false;
  message.value = result.ok ? result.message : normalizeAuthMessage(result.message, mode.value);
  if (result.ok && mode.value !== "forgot") router.push(result.boardId ? `/boards/${result.boardId}` : route.query.redirect || "/boards");
}
</script>

<template>
  <main class="auth-shell">
    <section class="brand-pane">
      <RouterLink class="brand-mark" to="/">realtime-kanban</RouterLink>
      <div>
        <p class="kicker">{{ t("auth.signInTitle") }}</p>
        <h1 class="auth-title">{{ copy.title }}</h1>
      </div>
      <p>{{ copy.body }}</p>
      <div class="benefit-list">
        <span>{{ t("auth.ownerFullAccess") }}</span>
        <span>{{ t("auth.editorCardsOnly") }}</span>
        <span>{{ t("auth.viewerReadOnly") }}</span>
      </div>
    </section>

    <form class="form-card" @submit.prevent="submit">
      <h1>{{ copy.title }}</h1>
      <p class="form-note">{{ t("auth.formNote") }}</p>

      <label v-if="mode === 'register'">
        {{ t("auth.name") }}
        <input v-model="form.name" class="input" autocomplete="name" required />
      </label>

      <label>
        {{ t("auth.email") }}
        <input v-model="form.email" class="input" type="email" :autocomplete="mode === 'forgot' ? 'email' : 'username'" required />
      </label>

      <label v-if="mode !== 'forgot'">
        {{ t("auth.password") }}
        <input
          v-model="form.password"
          class="input"
          type="password"
          :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
          required
        />
      </label>

      <p v-if="message" class="security-note" role="status">{{ message }}</p>

      <button class="button primary" type="submit" :disabled="busy">{{ busy ? t("common.working") : copy.submit }}</button>

      <div class="form-links auth-links">
        <RouterLink v-if="mode !== 'login'" class="auth-link-pill" to="/auth/login">{{ t("common.signIn") }}</RouterLink>
        <RouterLink v-if="mode !== 'register'" class="auth-link-pill" to="/auth/register">{{ t("common.createAccount") }}</RouterLink>
        <RouterLink v-if="mode !== 'forgot'" class="auth-link-pill" to="/auth/forgot-password">{{ t("common.forgotPassword") }}</RouterLink>
      </div>
    </form>
  </main>
</template>
