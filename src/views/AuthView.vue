<script setup>
import { computed, reactive, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

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
    title: "Sign in",
    body: "Sign in with Supabase auth to enter your workspace.",
    submit: "Sign in"
  },
  register: {
    title: "Create account",
    body: "Creates a Supabase auth account. public.handle_new_user() should create the profile row.",
    submit: "Create account"
  },
  forgot: {
    title: "Reset password",
    body: "Requests a Supabase password reset email.",
    submit: "Send reset link"
  },
  invite: {
    title: "Accept invitation",
    body: "Sign in with the invited email, then accept the board invitation.",
    submit: "Accept invite"
  }
}[mode.value]));

const form = reactive({
  name: "Demo User",
  email: "nn.user@example.com",
  password: "password",
  role: "viewer"
});

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
  message.value = result.message;
  if (result.ok && mode.value !== "forgot") router.push(result.boardId ? `/boards/${result.boardId}` : route.query.redirect || "/boards");
}
</script>

<template>
  <main class="auth-shell">
    <section class="brand-pane">
      <RouterLink class="brand-mark" to="/">realtime-kanban</RouterLink>
      <div>
        <p class="kicker">Supabase authentication</p>
        <h1 class="auth-title">{{ copy.title }}</h1>
      </div>
      <p>{{ copy.body }}</p>
      <div class="benefit-list">
        <span>owner: full access</span>
        <span>editor: cards only</span>
        <span>viewer: read-only</span>
      </div>
    </section>

    <form class="form-card" @submit.prevent="submit">
      <h1>{{ copy.title }}</h1>
      <p class="form-note">This calls Supabase auth. No local mock users are created.</p>

      <label v-if="mode === 'register'">
        Name
        <input v-model="form.name" class="input" autocomplete="name" required />
      </label>

      <label>
        Email
        <input v-model="form.email" class="input" type="email" autocomplete="email" required />
      </label>

      <label v-if="mode !== 'forgot'">
        Password
        <input v-model="form.password" class="input" type="password" autocomplete="current-password" required />
      </label>

      <p v-if="message" class="security-note" role="status">{{ message }}</p>

      <button class="button primary" type="submit" :disabled="busy">{{ busy ? "Working..." : copy.submit }}</button>

      <div class="form-links">
        <RouterLink v-if="mode !== 'login'" to="/auth/login">Sign in</RouterLink>
        <RouterLink v-if="mode !== 'register'" to="/auth/register">Create account</RouterLink>
        <RouterLink v-if="mode !== 'forgot'" to="/auth/forgot-password">Forgot password</RouterLink>
      </div>
    </form>
  </main>
</template>
