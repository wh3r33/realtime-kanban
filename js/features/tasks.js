import { badgeClass, cardById, currentUser, mockStores, nowLabel, userById } from "../data/mockStores.js";
import { openDrawerShell } from "../ui/drawer.js";
import { showToast } from "../ui/toast.js";
import { addActivity } from "./activity.js";
import { bindDrawerCommentEvents, renderTaskDrawerTemplate } from "./comments.js";

export function renderTaskCardTemplate(task) {
  const assignee = userById(task.assigneeId);
  const lock = mockStores.PresenceStore.locks.find((item) => item.cardId === task.id);
  const editor = mockStores.PresenceStore.editingUsers.find((item) => item.cardId === task.id);
  const stateClass = task.status === "conflict" ? "conflict-state" : task.status === "locked" ? "locked-state" : "";
  const labels = Array.from(new Set([...(task.labels || []), task.status.toUpperCase()]));
  return `
    <!-- Future Vue component: TaskCard -->
    <article class="task-card ${stateClass}" draggable="true" data-component="TaskCard" data-task-id="${task.id}" tabindex="0" aria-label="${task.title}">
      <div class="card-badges">
        ${labels.map((badge) => `<span class="status-badge ${badgeClass(badge)}">${badge}</span>`).join("")}
      </div>
      <div>
        <h3>${task.title}</h3>
        <p>${task.description}</p>
      </div>
      ${editor ? `<div class="ownership-line"><strong>${userById(editor.userId).name}</strong> ${editor.mode} · ${editor.duration}</div>` : ""}
      ${lock ? `<div class="ownership-line locked"><strong>Locked by ${userById(lock.userId).name}</strong> · ${lock.duration}</div>` : ""}
      <div class="live-line" aria-hidden="true"></div>
      <div class="card-meta">
        <span class="assignee"><span class="tiny-avatar" style="--ring:${assignee.color}">${assignee.initials}</span>${assignee.name}</span>
        <span class="status-badge ${badgeClass(task.status)}">${task.status.toUpperCase()}</span>
      </div>
    </article>
  `;
}

export function openTaskDrawer(taskId) {
  const task = cardById(taskId);
  if (!task) return;
  mockStores.TaskStore.selectedCardId = taskId;
  openDrawerShell({
    title: task.title,
    content: renderTaskDrawerTemplate(task),
    onRendered: (drawerContent) => bindDrawerCommentEvents(task.id, drawerContent, { openDrawer: openTaskDrawer, showToast })
  });
}

export function applyMove(task, targetColumn, mode, { renderBoard }) {
  task.column = targetColumn;
  task.status = task.status === "locked" ? "live" : task.status;
  task.labels = Array.from(new Set(["LIVE", ...(task.labels || []).filter((badge) => badge !== "LOCKED")]));
  task.updatedAt = nowLabel();
  task.history.unshift(`${mode === "redo" ? "Redone" : mode === "undo" ? "Reverted" : "Moved"} to ${targetColumn} by ${currentUser().name}`);
  renderBoard();
  if (mockStores.TaskStore.selectedCardId === task.id) openTaskDrawer(task.id);
}

export function moveTask(taskId, targetColumn, announce = false, { renderBoard }) {
  const task = cardById(taskId);
  if (!task || task.column === targetColumn) return;
  const action = { id: `move-${Date.now()}`, cardId: task.id, from: task.column, to: targetColumn, title: task.title };
  mockStores.TaskStore.undoHistory.push(action);
  mockStores.TaskStore.redoHistory = [];
  applyMove(task, targetColumn, "move", { renderBoard });
  addActivity("card_moved", "Card moved", `${currentUser().name} moved ${task.title} to ${targetColumn}.`);
  renderUndoRedoControls();
  if (announce) showToast(`${task.title} moved to ${targetColumn}`, [{ id: "undo", label: "Undo", handler: () => undoLastMove({ renderBoard }) }]);
}

export function undoLastMove({ renderBoard }) {
  const action = mockStores.TaskStore.undoHistory.pop();
  if (!action) {
    showToast("Nothing to undo");
    return;
  }
  const task = cardById(action.cardId);
  if (!task) return;
  applyMove(task, action.from, "undo", { renderBoard });
  mockStores.TaskStore.redoHistory.push(action);
  addActivity("card_moved", "Move reverted", `${currentUser().name} moved ${task.title} back to ${action.from}.`);
  renderUndoRedoControls();
  showToast(`${task.title} restored to ${action.from}`, [{ id: "redo", label: "Redo", handler: () => redoLastMove({ renderBoard }) }]);
}

export function redoLastMove({ renderBoard }) {
  const action = mockStores.TaskStore.redoHistory.pop();
  if (!action) {
    showToast("Nothing to redo");
    return;
  }
  const task = cardById(action.cardId);
  if (!task) return;
  applyMove(task, action.to, "redo", { renderBoard });
  mockStores.TaskStore.undoHistory.push(action);
  addActivity("card_moved", "Move redone", `${currentUser().name} redid move for ${task.title} to ${action.to}.`);
  renderUndoRedoControls();
  showToast(`${task.title} moved to ${action.to}`);
}

export function renderUndoRedoControls() {
  document.querySelectorAll("[data-undo-action]").forEach((button) => {
    button.disabled = mockStores.TaskStore.undoHistory.length === 0;
  });
  document.querySelectorAll("[data-redo-action]").forEach((button) => {
    button.disabled = mockStores.TaskStore.redoHistory.length === 0;
  });
}

export function initUndoRedo(renderBoard) {
  document.querySelectorAll("[data-undo-action]").forEach((button) => button.addEventListener("click", () => undoLastMove({ renderBoard })));
  document.querySelectorAll("[data-redo-action]").forEach((button) => button.addEventListener("click", () => redoLastMove({ renderBoard })));
  renderUndoRedoControls();
}
