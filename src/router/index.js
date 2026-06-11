import { createRouter, createWebHistory } from "vue-router";
import AppShell from "../layouts/AppShell.vue";
import ActivityView from "../views/ActivityView.vue";
import BoardView from "../views/BoardView.vue";
import BoardsView from "../views/BoardsView.vue";
import MembersView from "../views/MembersView.vue";
import PlaceholderView from "../views/PlaceholderView.vue";
import ProfileView from "../views/ProfileView.vue";
import SettingsView from "../views/SettingsView.vue";
import WelcomeView from "../views/WelcomeView.vue";

const placeholder = (title, eyebrow = "realtime-kanban") => ({
  component: PlaceholderView,
  props: { title, eyebrow }
});

const routes = [
  { path: "/", component: WelcomeView },
  { path: "/login", ...placeholder("Sign in", "Authentication") },
  { path: "/register", ...placeholder("Create account", "Authentication") },
  { path: "/forgot-password", ...placeholder("Reset password", "Authentication") },
  { path: "/accept-invitation", ...placeholder("Accept invitation", "Authentication") },
  {
    path: "/",
    component: AppShell,
    children: [
      { path: "boards", component: BoardsView },
      { path: "board", component: BoardView },
      { path: "members", component: MembersView },
      { path: "settings", component: SettingsView },
      { path: "profile", component: ProfileView },
      { path: "activity", component: ActivityView },
      { path: "analytics", ...placeholder("Analytics", "Bonus") },
      { path: "notifications", ...placeholder("Notifications", "Bonus") },
      { path: "search", ...placeholder("Search", "Bonus") },
      { path: "offline", ...placeholder("Offline queue", "Bonus") },
      { path: "ai-assistant", ...placeholder("AI assistant", "Bonus") },
      { path: "403", ...placeholder("Access denied", "System") },
      { path: "404", ...placeholder("Page not found", "System") }
    ]
  },
  { path: "/:pathMatch(.*)*", redirect: "/404" }
];

export default createRouter({
  history: createWebHistory(),
  routes
});
