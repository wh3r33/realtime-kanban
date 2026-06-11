import { cardById, currentUser, mockStores } from "../data/mockStores.js";
import { closeModal, openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { addActivity } from "./activity.js";

export function renderConflictTemplate(conflict, task) {
  return `
    <!-- Future Vue component: ConflictResolver -->
    <div class="conflict-preview" data-component="ConflictResolver">
      <div><span>Card</span><strong>${task.title}</strong></div>
      <div><span>Field</span><strong>${conflict.field}</strong></div>
      <article><strong>Mine</strong><p>${conflict.mine}</p></article>
      <article><strong>Server</strong><p>${conflict.server}</p></article>
      <article><strong>Merged</strong><p>${conflict.merged}</p></article>
    </div>
  `;
}

export function openConflictModal(cardId = "websocket-layer", { renderBoard, openTaskDrawer } = {}) {
  const conflict = { ...mockStores.ConflictStore.activeConflict, cardId };
  const task = cardById(conflict.cardId) || cardById("websocket-layer");
  openModal("Resolve conflict", renderConflictTemplate(conflict, task), [
    { label: "Keep Mine", handler: () => resolveConflict(task.id, conflict.mine, "kept local version", { renderBoard, openTaskDrawer }), style: "secondary" },
    { label: "Use Server Version", handler: () => resolveConflict(task.id, conflict.server, "used server version", { renderBoard, openTaskDrawer }), style: "secondary" },
    { label: "Merge Changes", handler: () => resolveConflict(task.id, conflict.merged, "merged both versions", { renderBoard, openTaskDrawer }), style: "primary" }
  ]);
}

export function resolveConflict(cardId, description, resolution, { renderBoard, openTaskDrawer } = {}) {
  const task = cardById(cardId);
  if (!task) return;
  task.description = description;
  task.status = "live";
  task.labels = Array.from(new Set(["LIVE", ...task.labels.filter((badge) => badge !== "CONFLICT")]));
  task.history.unshift(`${currentUser().name} ${resolution}`);
  addActivity("conflict_resolved", "Conflict resolved", `${currentUser().name} ${resolution} on ${task.title}.`);
  renderBoard?.();
  if (mockStores.TaskStore.selectedCardId === cardId) openTaskDrawer?.(cardId);
  closeModal();
  showToast(`Conflict resolved: ${resolution}`);
}

export function initConflicts(context) {
  document.querySelectorAll("[data-conflict-demo]").forEach((button) => button.addEventListener("click", () => openConflictModal("websocket-layer", context)));
}
