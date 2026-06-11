import { ensureLiveRegion } from "./core/dom.js";
import { initGlobalEvents } from "./core/events.js";
import { getCurrentRoute, initSelectedBoard, renderSelectedBoardMeta, syncBoardRouteLinks } from "./core/router.js";
import { closeAllDropdowns, initCustomSelects } from "./ui/dropdown.js";
import { closeDrawer, initDrawer } from "./ui/drawer.js";
import { closeModal } from "./ui/modal.js";
import { showToast } from "./ui/toast.js";
import { initAiAssistant } from "./features/ai.js";
import { initFilters, initRealtimeStatus, initRoleToggles } from "./features/activity.js";
import { bootWorkspace, initBoardCards, renderBoard } from "./features/board.js";
import { initConflicts, openConflictModal } from "./features/conflicts.js";
import { initInvites } from "./features/invites.js";
import { initNotifications, renderNotifications } from "./features/notifications.js";
import { initOffline } from "./features/offline.js";
import { initSearch } from "./features/search.js";
import { initSettingsLanguage } from "./features/settings.js";
import { initUndoRedo, openTaskDrawer } from "./features/tasks.js";

function initActiveNavigation() {
  const current = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav] a").forEach((link) => {
    if (link.getAttribute("href")?.split("/").pop()?.split("?")[0] === current) link.classList.add("active");
  });
}

function initAuthForms() {
  document.querySelectorAll(".auth-shell .button.primary[type='button']").forEach((button) => {
    button.addEventListener("click", () => showToast("Mock auth action completed"));
  });
}

function initWelcomeRoute() {
  document.getElementById("enterWorkspace")?.addEventListener("click", () => {
    window.location.href = "workspace/boards.html";
  });

  if (new URLSearchParams(window.location.search).get("workspace") === "1") {
    const welcome = document.getElementById("welcome");
    const workspace = document.getElementById("workspace");
    if (welcome) welcome.hidden = true;
    if (workspace) {
      workspace.hidden = false;
      workspace.classList.add("active");
    }
    bootWorkspace({ openConflictModal: (cardId) => openConflictModal(cardId, { renderBoard, openTaskDrawer }) });
  }
}

function initStaticApp() {
  ensureLiveRegion();
  const route = getCurrentRoute();
  const conflictContext = { renderBoard, openTaskDrawer };

  initSelectedBoard();
  syncBoardRouteLinks();
  renderSelectedBoardMeta();
  initActiveNavigation();
  initDrawer();
  initInvites();
  initConflicts(conflictContext);
  initFilters();
  initSearch();
  renderNotifications();
  initNotifications();
  initOffline();
  initAiAssistant();
  initBoardCards();
  initSettingsLanguage();
  initCustomSelects();
  initRealtimeStatus();
  initRoleToggles({ showToast });
  initUndoRedo(renderBoard);
  initAuthForms();
  initWelcomeRoute();
  initGlobalEvents({ closeDrawer, closeModal, closeDropdowns: closeAllDropdowns });

  if (route.page === "board") bootWorkspace({ openConflictModal: (cardId) => openConflictModal(cardId, conflictContext) });
  if (route.page && !["welcome", "board"].includes(route.page)) {
    window.setTimeout(() => showToast("Realtime mock channel connected"), 900);
  }
}

initStaticApp();
