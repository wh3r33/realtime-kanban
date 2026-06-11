import { createRouter, createWebHistory } from "vue-router";
import AppShell from "../layouts/AppShell.vue";
import { useAuthStore } from "../stores/auth";
import ActivityView from "../views/ActivityView.vue";
import AiAssistantView from "../views/AiAssistantView.vue";
import AuthView from "../views/AuthView.vue";
import BoardView from "../views/BoardView.vue";
import BoardsView from "../views/BoardsView.vue";
import MembersView from "../views/MembersView.vue";
import NotificationsView from "../views/NotificationsView.vue";
import OfflineView from "../views/OfflineView.vue";
import PlaceholderView from "../views/PlaceholderView.vue";
import ProfileView from "../views/ProfileView.vue";
import SearchView from "../views/SearchView.vue";
import SettingsView from "../views/SettingsView.vue";
import SystemStateView from "../views/SystemStateView.vue";
import WelcomeView from "../views/WelcomeView.vue";
import { authGuardDecision } from "./guards";

const placeholder = (title, eyebrow = "realtime-kanban") => ({
  component: PlaceholderView,
  props: { title, eyebrow }
});

const routes = [
  { path: "/", component: WelcomeView },
  { path: "/auth/login", alias: "/login", component: AuthView, meta: { guestOnly: true } },
  { path: "/auth/register", alias: "/register", component: AuthView, meta: { guestOnly: true } },
  { path: "/auth/forgot-password", alias: "/forgot-password", component: AuthView, meta: { guestOnly: true } },
  { path: "/auth/invitations/:token?", alias: "/accept-invitation", component: AuthView },
  {
    path: "/",
    component: AppShell,
    meta: { requiresAuth: true },
    children: [
      { path: "boards", component: BoardsView },
      { path: "boards/:boardId", component: BoardView, meta: { requiresBoard: true } },
      { path: "boards/:boardId/activity", component: ActivityView, meta: { requiresBoard: true } },
      { path: "boards/:boardId/members", component: MembersView, meta: { requiresBoard: true } },
      { path: "boards/:boardId/settings", component: SettingsView, meta: { requiresBoard: true } },
      { path: "board", redirect: "/boards" },
      { path: "activity", redirect: "/boards" },
      { path: "members", redirect: "/boards" },
      { path: "settings", redirect: "/boards" },
      { path: "profile", component: ProfileView, meta: { allowSetupRequired: true } },
      { path: "profile/setup", component: ProfileView, meta: { allowSetupRequired: true } },
      { path: "bonus/analytics", alias: "analytics", ...placeholder("Analytics", "Bonus") },
      { path: "bonus/notifications", alias: "notifications", component: NotificationsView },
      { path: "bonus/search", alias: "search", component: SearchView },
      { path: "bonus/offline", alias: "offline", component: OfflineView },
      { path: "ai", alias: ["ai-assistant", "bonus/ai-assistant"], component: AiAssistantView },
      { path: "403", component: SystemStateView, props: { code: "403", title: "Access denied", message: "Your current board role cannot open this workspace area." } },
      { path: "404", component: SystemStateView, props: { code: "404", title: "Page not found", message: "The route does not exist in the Vue migration." } },
      { path: "loading", component: SystemStateView, props: { code: "SYNC", title: "Loading workspace", message: "Hydrating board state and realtime subscriptions." } }
    ]
  },
  { path: "/:pathMatch(.*)*", redirect: "/404" }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  await authStore.initialize();
  return authGuardDecision(to, authStore.session.status);
});

export default router;
