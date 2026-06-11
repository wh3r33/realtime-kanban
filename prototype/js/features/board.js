import { boardScopedHref } from "../core/router.js";
import { badgeClass, mockStores, userById } from "../data/mockStores.js";
import { showToast } from "../ui/toast.js";
import { addActivity, renderActivity, setSyncState } from "./activity.js";
import { moveTask, openTaskDrawer, renderTaskCardTemplate } from "./tasks.js";

let draggedTaskId = null;
let workspaceBooted = false;

export function renderBoardColumnTemplate(column, columnTasks) {
  const cards = columnTasks.length
    ? columnTasks.map(renderTaskCardTemplate).join("")
    : `<div class="empty-state informative"><strong>No cards here</strong><span>Drop a card into ${column} or wait for a teammate movement.</span></div>`;
  return `
    <!-- Future Vue component: BoardColumn -->
    <article class="column" data-component="BoardColumn" data-column="${column}">
      <header class="column-header">
        <h3 class="column-title">${column}</h3>
        <span class="column-count">${columnTasks.length}</span>
      </header>
      <div class="card-list">${cards}</div>
    </article>
  `;
}

export function renderAvatars() {
  const miniAvatars = document.getElementById("miniAvatars");
  if (!miniAvatars) return;
  const users = mockStores.PresenceStore.users;
  const onlineCount = users.filter((user) => user.presence === "online").length;
  const presenceText = miniAvatars.parentElement?.querySelector("span:nth-child(2)");
  if (presenceText) presenceText.textContent = `${onlineCount} online`;
  miniAvatars.innerHTML = users
    .map((user) => `<span class="avatar ${user.presence}" style="--ring:${user.color}" title="${user.name} · ${user.presence}">${user.initials}</span>`)
    .join("");
}

export function renderBoard() {
  const board = document.getElementById("board");
  if (!board) return;
  const currentBoardId = mockStores.BoardStore.selectedBoardId;
  board.innerHTML = mockStores.BoardStore.columns
    .map((column) => renderBoardColumnTemplate(column, mockStores.TaskStore.cards.filter((task) => task.boardId === currentBoardId && task.column === column)))
    .join("");
  bindCardEvents();
  bindColumnEvents();
}

function bindCardEvents() {
  document.querySelectorAll(".task-card").forEach((card) => {
    card.addEventListener("click", () => openTaskDrawer(card.dataset.taskId));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openTaskDrawer(card.dataset.taskId);
      }
    });
    card.addEventListener("dragstart", () => {
      draggedTaskId = card.dataset.taskId;
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => {
      draggedTaskId = null;
      card.classList.remove("dragging");
    });
  });
}

function bindColumnEvents() {
  document.querySelectorAll(".column").forEach((column) => {
    column.addEventListener("dragover", (event) => {
      event.preventDefault();
      column.classList.add("drag-over");
    });
    column.addEventListener("dragleave", () => column.classList.remove("drag-over"));
    column.addEventListener("drop", () => {
      column.classList.remove("drag-over");
      moveTask(draggedTaskId, column.dataset.column, true, { renderBoard });
    });
  });
}

function upsertEditing(userId, cardId, mode) {
  mockStores.PresenceStore.editingUsers = [
    { userId, cardId, duration: "0m 04s", mode },
    ...mockStores.PresenceStore.editingUsers.filter((item) => item.userId !== userId)
  ].slice(0, 4);
}

export function randomRealtimeEvent({ openConflictModal }) {
  const task = mockStores.TaskStore.cards[Math.floor(Math.random() * mockStores.TaskStore.cards.length)];
  const user = mockStores.PresenceStore.users[Math.floor(Math.random() * mockStores.PresenceStore.users.length)];
  const eventType = Math.floor(Math.random() * 4);
  setSyncState("syncing", "Syncing · applying event");

  if (eventType === 0) {
    task.assigneeId = user.id;
    task.status = "editing";
    task.labels = Array.from(new Set(["EDITING", "LIVE", ...task.labels.filter((badge) => badge !== "LOCKED")]));
    upsertEditing(user.id, task.id, "editing");
    task.history.unshift(`${user.name} is editing ${task.title}`);
    addActivity("card_edited", "Card edited", `${user.name} is editing ${task.title}.`, user.id);
  }
  if (eventType === 1) {
    task.status = "conflict";
    task.labels = Array.from(new Set(["CONFLICT", "LIVE", ...task.labels.filter((badge) => badge !== "LOCKED")]));
    task.history.unshift(`Conflict detected in ${task.title}`);
    addActivity("conflict_detected", "Conflict detected", `Competing edits detected on ${task.title}.`, user.id);
    showToast(`Conflict detected in ${task.title}`, [{ id: "resolve", label: "Review", handler: () => openConflictModal(task.id) }]);
  }
  if (eventType === 2) {
    task.status = "locked";
    task.labels = Array.from(new Set(["LOCKED", ...task.labels.filter((badge) => badge !== "EDITING")]));
    mockStores.PresenceStore.locks = [{ cardId: task.id, userId: user.id, reason: "Active edit", duration: "0m 12s" }, ...mockStores.PresenceStore.locks.filter((lock) => lock.cardId !== task.id)];
    task.history.unshift(`${user.name} locked ${task.title}`);
    addActivity("card_edited", "Card locked", `${task.title} is locked by ${user.name}.`, user.id);
  }
  if (eventType === 3) {
    const targetColumn = mockStores.BoardStore.columns[Math.floor(Math.random() * mockStores.BoardStore.columns.length)];
    task.column = targetColumn;
    task.status = "live";
    task.labels = Array.from(new Set(["LIVE", "ONLINE"]));
    task.history.unshift(`${user.name} moved ${task.title} to ${targetColumn}`);
    addActivity("card_moved", "Card moved", `${user.name} moved ${task.title} to ${targetColumn}.`, user.id);
  }

  renderBoard();
  renderActivity();
  if (mockStores.TaskStore.selectedCardId === task.id) openTaskDrawer(task.id);
  window.setTimeout(() => setSyncState("synced", "Synced · heartbeat just now"), 700);
}

export function bootWorkspace({ openConflictModal }) {
  if (workspaceBooted) return;
  workspaceBooted = true;
  renderAvatars();
  renderBoard();
  renderActivity();
  window.setTimeout(() => showToast("Workspace synced with live mock state"), 800);
  window.setInterval(() => randomRealtimeEvent({ openConflictModal }), 9000);
  window.setInterval(() => {
    const lastChanged = document.getElementById("lastChanged");
    if (lastChanged) lastChanged.textContent = `Last change ${Math.floor(Math.random() * 4) + 1}s ago`;
  }, 3200);
}

export function initBoardCards() {
  document.querySelectorAll(".board-card[data-board]").forEach((card) => {
    const openBoard = () => {
      const boardId = card.dataset.boardId || mockStores.BoardStore.boards.find((item) => item.name === card.dataset.board)?.id || mockStores.BoardStore.boards[0].id;
      window.location.href = boardScopedHref("board.html", boardId);
    };
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.addEventListener("click", openBoard);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openBoard();
      }
    });
  });
}
