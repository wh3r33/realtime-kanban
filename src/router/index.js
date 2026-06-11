import { createRouter, createWebHistory } from "vue-router";
import AppShell from "../layouts/AppShell.vue";
import BoardView from "../views/BoardView.vue";
import PlaceholderView from "../views/PlaceholderView.vue";

const placeholder = (title, eyebrow = "realtime-kanban") => ({
  component: PlaceholderView,
  props: { title, eyebrow }
});

const routes = [
  { path: "/", redirect: "/boards" },
  { path: "/login", ...placeholder("Sign in", "Authentication") },
  { path: "/register", ...placeholder("Create account", "Authentication") },
  { path: "/forgot-password", ...placeholder("Reset password", "Authentication") },
  { path: "/accept-invitation", ...placeholder("Accept invitation", "Authentication") },
  {
    path: "/",
    component: AppShell,
    children: [
      { path: "boards", ...placeholder("Boards", "Workspace") },
      { path: "board", component: BoardView },
      { path: "members", ...placeholder("Members", "Workspace") },
      { path: "settings", ...placeholder("Settings", "Workspace") },
      { path: "profile", ...placeholder("Profile", "Workspace") },
      { path: "activity", ...placeholder("Activity", "Workspace") },
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
