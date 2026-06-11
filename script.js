const nowLabel = () => "just now";

// Future Vue stores: split this mock object into Pinia stores during migration.
const mockStores = {
  AuthStore: {
    currentUserId: "u-nn",
    session: { status: "authenticated", workspaceId: "workspace-main" },
    invitation: { activeInviteId: "invite-02", status: "pending" }
  },
  BoardStore: {
    selectedBoardId: "board-main",
    columns: ["Backlog", "Todo", "In Progress", "Review", "Done"],
    boardSettings: {
      language: localStorage.getItem("rk_language") || "en",
      conflictStrategy: "versioned",
      visibility: "private"
    },
    boards: [
      { id: "board-main", name: "Product Roadmap", summary: "Priorities, milestones and launch sequencing.", cards: 28, online: 3, columns: 5, updated: "Last activity 2m ago" },
      { id: "board-design", name: "Frontend Design", summary: "Premium surfaces, interaction polish and visual QA.", cards: 19, online: 2, columns: 5, updated: "User 02 edited a card" },
      { id: "board-realtime", name: "Realtime Engine", summary: "Presence, locks, rollback and event delivery.", cards: 34, online: 4, columns: 5, updated: "Conflict resolved 4m ago" },
      { id: "board-qa", name: "QA Review", summary: "Regression passes, blocked states and acceptance notes.", cards: 12, online: 1, columns: 4, updated: "Guest User joined" }
    ]
  },
  TaskStore: {
    selectedCardId: null,
    undoHistory: [],
    redoHistory: [],
    comments: [
      { id: "comment-1", cardId: "api-task", authorId: "u-nn", body: "Sync payload is stable.", createdAt: "9m ago" },
      { id: "comment-2", cardId: "api-task", authorId: "u-02", body: "Review optimistic movement after drawer edits.", createdAt: "5m ago" },
      { id: "comment-3", cardId: "design-system", authorId: "u-02", body: "Keep cobalt as the repeated product signal.", createdAt: "12m ago" },
      { id: "comment-4", cardId: "websocket-layer", authorId: "u-03", body: "Conflict detected between reorder and title edit.", createdAt: "4m ago" }
    ],
    cards: [
      {
        id: "api-task",
        boardId: "board-main",
        title: "API Task",
        description: "Define optimistic updates, retry states, and visible event confirmations for board movement.",
        column: "In Progress",
        assigneeId: "u-nn",
        status: "editing",
        labels: ["LIVE", "EDITING"],
        history: ["Created in Backlog", "Moved to In Progress by NN User"],
        updatedAt: "just now"
      },
      {
        id: "design-system",
        boardId: "board-design",
        title: "Design System",
        description: "Refine badge language, glass surfaces, typography rhythm, and status hierarchy.",
        column: "Todo",
        assigneeId: "u-02",
        status: "editing",
        labels: ["EDITING"],
        history: ["User 02 started editing"],
        updatedAt: "2m ago"
      },
      {
        id: "websocket-layer",
        boardId: "board-realtime",
        title: "WebSocket Layer",
        description: "Simulate conflict detection, lock ownership, and event ordering for shared cards.",
        column: "Review",
        assigneeId: "u-03",
        status: "conflict",
        labels: ["CONFLICT", "LIVE"],
        history: ["Conflict detected in WebSocket Layer"],
        updatedAt: "4m ago"
      },
      {
        id: "mobile-scroll",
        boardId: "board-design",
        title: "Mobile Board Scroll",
        description: "Preserve five-column context with controlled horizontal movement on small screens.",
        column: "Backlog",
        assigneeId: "u-gu",
        status: "live",
        labels: ["ONLINE"],
        history: ["Guest User opened mobile preview"],
        updatedAt: "8m ago"
      },
      {
        id: "permissions-model",
        boardId: "board-realtime",
        title: "Permissions Model",
        description: "Show locked cards without hiding ownership, reason, or current collaborator.",
        column: "Backlog",
        assigneeId: "u-nn",
        status: "locked",
        labels: ["LOCKED"],
        history: ["NN User locked Permissions Model"],
        updatedAt: "11m ago"
      },
      {
        id: "release-notes",
        boardId: "board-main",
        title: "Release Notes",
        description: "Write short technical status notes for live product changes.",
        column: "Done",
        assigneeId: "u-02",
        status: "live",
        labels: ["LIVE"],
        history: ["User 02 completed release notes"],
        updatedAt: "14m ago"
      }
    ]
  },
  PresenceStore: {
    syncState: "synced",
    onlineUsers: ["u-nn", "u-02"],
    users: [
      { id: "u-nn", name: "NN User", email: "nn.user@example.com", initials: "NN", color: "#2855FF", role: "owner", presence: "online", activity: "Editing API Task" },
      { id: "u-02", name: "User 02", email: "user.02@example.com", initials: "02", color: "#D6FF00", role: "editor", presence: "online", activity: "Editing Design System" },
      { id: "u-03", name: "User 03", email: "user.03@example.com", initials: "03", color: "#111111", role: "viewer", presence: "away", activity: "Viewing Review column" },
      { id: "u-gu", name: "Guest User", email: "guest.user@example.com", initials: "GU", color: "#F05252", role: "viewer", presence: "offline", activity: "Accepted invite yesterday" }
    ],
    editingUsers: [
      { userId: "u-nn", cardId: "api-task", duration: "1m 12s", mode: "editing" },
      { userId: "u-02", cardId: "design-system", duration: "3m 04s", mode: "editing" },
      { userId: "u-03", cardId: "websocket-layer", duration: "4m 30s", mode: "viewing" }
    ],
    locks: [
      { cardId: "permissions-model", userId: "u-nn", reason: "Schema review", duration: "6m 22s" }
    ]
  },
  ActivityStore: {
    filters: { type: "all" },
    events: [
      { id: "evt-1", type: "card_moved", actorId: "u-nn", title: "Card moved", body: "NN User moved API Task to Review.", createdAt: "now" },
      { id: "evt-2", type: "card_edited", actorId: "u-02", title: "Card edited", body: "User 02 is editing Design System.", createdAt: "2m" },
      { id: "evt-3", type: "conflict_detected", actorId: "u-03", title: "Conflict detected", body: "WebSocket Layer has two competing edits.", createdAt: "4m" },
      { id: "evt-4", type: "invite_accepted", actorId: "u-gu", title: "Invite accepted", body: "Guest User joined realtime-kanban Board.", createdAt: "18m" }
    ]
  },
  NotificationStore: {
    notifications: [
      { id: "note-1", type: "card_moved", title: "Card moved", body: "NN User moved API Task to Review.", createdAt: "now", unread: true },
      { id: "note-2", type: "comment_added", title: "Comment added", body: "User 02 commented on Design System.", createdAt: "2m", unread: true },
      { id: "note-3", type: "conflict_detected", title: "Conflict detected", body: "WebSocket Layer has two competing edits.", createdAt: "4m", unread: true },
      { id: "note-4", type: "invite_accepted", title: "Invite accepted", body: "User 03 joined as Editor.", createdAt: "18m", unread: false },
      { id: "note-5", type: "sync_restored", title: "Sync restored", body: "Offline queue was replayed successfully.", createdAt: "24m", unread: false }
    ]
  },
  SettingsStore: {
    language: localStorage.getItem("rk_language") || "en",
    theme: "paper",
    conflictStrategy: "versioned"
  },
  InvitationStore: {
    invites: [
      { id: "invite-01", email: "user.03@example.com", role: "editor", status: "pending", invitedBy: "NN User", createdAt: "10m ago" },
      { id: "invite-02", email: "guest.user@example.com", role: "viewer", status: "accepted", invitedBy: "NN User", createdAt: "yesterday" }
    ]
  },
  OfflineStore: {
    connection: "offline",
    pendingQueue: [
      { id: "offline-1", type: "card_moved", label: "Move API Task to Review", status: "queued" },
      { id: "offline-2", type: "comment_added", label: "Add comment to Design System", status: "queued" },
      { id: "offline-3", type: "card_edited", label: "Update WebSocket Layer label", status: "queued" }
    ]
  },
  ConflictStore: {
    activeConflict: {
      id: "conflict-websocket",
      cardId: "websocket-layer",
      field: "Description",
      mine: "Use optimistic updates with local rollback checkpoints.",
      server: "Use server event order with versioned rollback checkpoints.",
      merged: "Use optimistic updates with server event order and versioned rollback checkpoints."
    }
  }
};

window.realtimeKanbanMockStores = mockStores;

let draggedTaskId = null;
let workspaceBooted = false;
let commentDraftCounter = 10;
let lastModalTrigger = null;
let lastDrawerTrigger = null;
let lastSelectTrigger = null;

const welcome = document.getElementById("welcome");
const workspace = document.getElementById("workspace");
const enterButton = document.getElementById("enterWorkspace");
const board = document.getElementById("board");
const miniAvatars = document.getElementById("miniAvatars");
const activityFeed = document.getElementById("activityFeed");
const editingNow = document.getElementById("editingNow");
const toastStack = document.getElementById("toastStack");
const drawer = document.getElementById("taskDrawer");
const drawerTitle = document.getElementById("drawerTitle");
const drawerContent = document.getElementById("drawerContent");
const closeDrawer = document.getElementById("closeDrawer");
const lastChanged = document.getElementById("lastChanged");
const focusableSelector = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

function currentUser() {
  return userById(mockStores.AuthStore.currentUserId);
}

function userById(id) {
  return mockStores.PresenceStore.users.find((user) => user.id === id) || mockStores.PresenceStore.users[0];
}

function cardById(id) {
  return mockStores.TaskStore.cards.find((card) => card.id === id);
}

function boardById(id) {
  return mockStores.BoardStore.boards.find((boardItem) => boardItem.id === id);
}

function selectedBoard() {
  return boardById(mockStores.BoardStore.selectedBoardId) || mockStores.BoardStore.boards[0];
}

function selectedBoardIdFromUrl() {
  const requestedBoardId = new URLSearchParams(window.location.search).get("boardId");
  return boardById(requestedBoardId)?.id || mockStores.BoardStore.boards[0]?.id || "board-main";
}

function boardScopedHref(fileName, boardId = mockStores.BoardStore.selectedBoardId) {
  return `${fileName}?boardId=${encodeURIComponent(boardId)}`;
}

function initSelectedBoard() {
  if (["board", "activity", "members", "settings"].includes(document.body.dataset.page)) {
    mockStores.BoardStore.selectedBoardId = selectedBoardIdFromUrl();
  }
}

function syncBoardRouteLinks() {
  const id = mockStores.BoardStore.selectedBoardId || selectedBoardIdFromUrl();
  const routeFiles = {
    board: "board.html",
    activity: "activity.html",
    members: "members.html",
    settings: "settings.html"
  };
  document.querySelectorAll("[data-board-route]").forEach((link) => {
    const fileName = routeFiles[link.dataset.boardRoute];
    if (fileName) link.setAttribute("href", boardScopedHref(fileName, id));
  });
}

function renderSelectedBoardMeta() {
  const currentBoard = selectedBoard();
  document.querySelectorAll("[data-selected-board-label]").forEach((node) => {
    node.textContent = currentBoard.name;
  });
  document.querySelectorAll("[data-selected-board-title]").forEach((node) => {
    node.textContent = currentBoard.name;
  });
  document.querySelectorAll("[data-selected-board-summary]").forEach((node) => {
    node.textContent = currentBoard.summary;
  });
}

function focusFirstInteractive(container) {
  const target = container?.querySelector(focusableSelector);
  target?.focus();
}

function restoreFocus(node) {
  if (node && document.contains(node) && typeof node.focus === "function") node.focus();
}

function trapFocus(event, container) {
  if (event.key !== "Tab" || !container) return;
  const focusable = Array.from(container.querySelectorAll(focusableSelector)).filter((node) => !node.hasAttribute("disabled"));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function commentsFor(cardId) {
  return mockStores.TaskStore.comments.filter((comment) => comment.cardId === cardId);
}

function badgeClass(label) {
  return String(label).toLowerCase().replace(/\s+/g, "-");
}

function setSyncState(state, detail) {
  mockStores.PresenceStore.syncState = state;
  document.querySelectorAll("[data-sync-text]").forEach((node) => {
    node.textContent = detail || `${state.charAt(0).toUpperCase()}${state.slice(1)} · ${nowLabel()}`;
  });
  document.querySelectorAll("[data-live-status], [data-sync-state]").forEach((node) => {
    node.textContent = state.toUpperCase();
    node.className = `status-badge ${badgeClass(state)}`;
  });
}

function addActivity(type, title, body, actorId = mockStores.AuthStore.currentUserId) {
  const event = {
    id: `evt-${Date.now()}`,
    type,
    actorId,
    title,
    body,
    createdAt: nowLabel()
  };
  mockStores.ActivityStore.events.unshift(event);
  mockStores.ActivityStore.events = mockStores.ActivityStore.events.slice(0, 20);
  if (lastChanged) lastChanged.textContent = `Last change ${nowLabel()}`;
  renderActivity();
  renderActivityPage();
}

function showToast(message, actions = []) {
  if (!toastStack) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <span>${message}</span>
    ${actions.map((action) => `<button type="button" data-toast-action="${action.id}">${action.label}</button>`).join("")}
  `;
  toastStack.appendChild(toast);
  actions.forEach((action) => {
    toast.querySelector(`[data-toast-action="${action.id}"]`)?.addEventListener("click", () => {
      action.handler?.();
      toast.remove();
    });
  });
  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    window.setTimeout(() => toast.remove(), 240);
  }, 4600);
}

function renderAvatars() {
  if (!miniAvatars) return;
  const users = mockStores.PresenceStore.users;
  const onlineCount = users.filter((user) => user.presence === "online").length;
  const presenceText = miniAvatars.parentElement?.querySelector("span:nth-child(2)");
  if (presenceText) presenceText.textContent = `${onlineCount} online`;
  miniAvatars.innerHTML = users
    .map((user) => `<span class="avatar ${user.presence}" style="--ring:${user.color}" title="${user.name} · ${user.presence}">${user.initials}</span>`)
    .join("");
}

function renderBoard() {
  if (!board) return;
  const currentBoardId = mockStores.BoardStore.selectedBoardId;
  board.innerHTML = mockStores.BoardStore.columns
    .map((column) => {
      // Future Vue component: BoardColumn receives board-scoped cards as props.
      const columnTasks = mockStores.TaskStore.cards.filter((task) => task.boardId === currentBoardId && task.column === column);
      const cards = columnTasks.length
        ? columnTasks.map(renderCard).join("")
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
    })
    .join("");

  bindCardEvents();
  bindColumnEvents();
}

function renderCard(task) {
  // Future Vue component: TaskCard.
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

function bindCardEvents() {
  document.querySelectorAll(".task-card").forEach((card) => {
    card.addEventListener("click", () => openDrawer(card.dataset.taskId));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDrawer(card.dataset.taskId);
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
      moveTask(draggedTaskId, column.dataset.column, true);
    });
  });
}

function moveTask(taskId, targetColumn, announce = false) {
  // Future Vue store: TaskStore.moveCard.
  const task = cardById(taskId);
  if (!task || task.column === targetColumn) return;

  const previousColumn = task.column;
  const action = {
    id: `move-${Date.now()}`,
    cardId: task.id,
    from: previousColumn,
    to: targetColumn,
    title: task.title
  };
  mockStores.TaskStore.undoHistory.push(action);
  mockStores.TaskStore.redoHistory = [];

  applyMove(task, targetColumn, "move");
  addActivity("card_moved", "Card moved", `${currentUser().name} moved ${task.title} to ${targetColumn}.`);
  renderUndoRedoControls();
  if (announce) {
    showToast(`${task.title} moved to ${targetColumn}`, [{ id: "undo", label: "Undo", handler: undoLastMove }]);
  }
}

function applyMove(task, targetColumn, mode) {
  task.column = targetColumn;
  task.status = task.status === "locked" ? "live" : task.status;
  task.labels = Array.from(new Set(["LIVE", ...(task.labels || []).filter((badge) => badge !== "LOCKED")]));
  task.updatedAt = nowLabel();
  task.history.unshift(`${mode === "redo" ? "Redone" : mode === "undo" ? "Reverted" : "Moved"} to ${targetColumn} by ${currentUser().name}`);
  renderBoard();
  if (mockStores.TaskStore.selectedCardId === task.id) openDrawer(task.id);
}

function undoLastMove() {
  // Future Vue store: TaskStore.undoLastMove.
  const action = mockStores.TaskStore.undoHistory.pop();
  if (!action) {
    showToast("Nothing to undo");
    return;
  }
  const task = cardById(action.cardId);
  if (!task) return;
  applyMove(task, action.from, "undo");
  mockStores.TaskStore.redoHistory.push(action);
  addActivity("card_moved", "Move reverted", `${currentUser().name} moved ${task.title} back to ${action.from}.`);
  renderUndoRedoControls();
  showToast(`${task.title} restored to ${action.from}`, [{ id: "redo", label: "Redo", handler: redoLastMove }]);
}

function redoLastMove() {
  // Future Vue store: TaskStore.redoLastMove.
  const action = mockStores.TaskStore.redoHistory.pop();
  if (!action) {
    showToast("Nothing to redo");
    return;
  }
  const task = cardById(action.cardId);
  if (!task) return;
  applyMove(task, action.to, "redo");
  mockStores.TaskStore.undoHistory.push(action);
  addActivity("card_moved", "Move redone", `${currentUser().name} redid move for ${task.title} to ${action.to}.`);
  renderUndoRedoControls();
  showToast(`${task.title} moved to ${action.to}`);
}

function renderUndoRedoControls() {
  document.querySelectorAll("[data-undo-action]").forEach((button) => {
    button.disabled = mockStores.TaskStore.undoHistory.length === 0;
  });
  document.querySelectorAll("[data-redo-action]").forEach((button) => {
    button.disabled = mockStores.TaskStore.redoHistory.length === 0;
  });
}

function renderActivity() {
  if (!activityFeed || !editingNow) return;
  activityFeed.innerHTML = mockStores.ActivityStore.events
    .slice(0, 6)
    .map((activity, index) => `
      <div class="activity-item ${index === 0 ? "new" : ""}">
        <strong>${activity.title}</strong>
        <span>${activity.body}</span>
        <time>${activity.createdAt}</time>
      </div>
    `)
    .join("");

  editingNow.innerHTML = mockStores.PresenceStore.editingUsers
    .slice(0, 4)
    .map((presence) => {
      const user = userById(presence.userId);
      const task = cardById(presence.cardId);
      return `
        <div class="editing-item">
          <strong>${user.name}</strong>
          <span>${presence.mode === "viewing" ? "Viewing" : "Editing"} ${task?.title || "board"} · ${presence.duration}</span>
        </div>
      `;
    })
    .join("");
}

function openDrawer(taskId) {
  const task = cardById(taskId);
  if (!task || !drawer || !drawerTitle || !drawerContent) return;

  lastDrawerTrigger = document.activeElement;
  const assignee = userById(task.assigneeId);
  const editor = mockStores.PresenceStore.editingUsers.find((item) => item.cardId === task.id);
  const lock = mockStores.PresenceStore.locks.find((item) => item.cardId === task.id);
  mockStores.TaskStore.selectedCardId = taskId;
  drawerTitle.textContent = task.title;
  drawerContent.innerHTML = `
    <div class="drawer-block">
      <div class="card-badges">
        ${task.labels.map((badge) => `<span class="status-badge ${badgeClass(badge)}">${badge}</span>`).join("")}
      </div>
      <p>${task.description}</p>
    </div>
    <div class="drawer-block">
      <h4>Collaboration State</h4>
      <div class="drawer-row"><span>Status</span><strong>${task.status.toUpperCase()}</strong></div>
      <div class="drawer-row"><span>Assigned User</span><strong>${assignee.name}</strong></div>
      <div class="drawer-row"><span>Column</span><strong>${task.column}</strong></div>
      ${editor ? `<div class="drawer-row"><span>Editing</span><strong>${userById(editor.userId).name} · ${editor.duration}</strong></div>` : ""}
      ${lock ? `<div class="drawer-row"><span>Lock</span><strong>${userById(lock.userId).name} · ${lock.reason}</strong></div>` : ""}
    </div>
    <div class="drawer-block">
      <h4>Activity History</h4>
      ${task.history.map((item) => `<p>${item}</p>`).join("")}
    </div>
    <div class="drawer-block" data-component="CommentList">
      <h4>Comments</h4>
      <div class="comment-list" data-comment-list>
        ${renderComments(task.id)}
      </div>
      <form class="comment-form" data-comment-form>
        <label class="sr-only" for="commentDraft">Add comment</label>
        <textarea class="input textarea compact-textarea" id="commentDraft" data-comment-input placeholder="Add a local mock comment"></textarea>
        <button class="button primary" type="submit">Add comment</button>
      </form>
    </div>
  `;
  bindDrawerCommentEvents(task.id);
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  focusFirstInteractive(drawer);
}

function renderComments(cardId) {
  const comments = commentsFor(cardId);
  if (!comments.length) {
    return `<div class="empty-state informative compact"><strong>No comments yet</strong><span>Add a note for teammates reviewing this card.</span></div>`;
  }
  return comments
    .map((comment) => {
      const author = userById(comment.authorId);
      return `
        <div class="comment" data-comment-id="${comment.id}">
          <span class="tiny-avatar" style="--ring:${author.color}">${author.initials}</span>
          <p>${comment.body}<small>${author.name} · ${comment.createdAt}</small></p>
          <button class="icon-button small" type="button" data-delete-comment="${comment.id}" aria-label="Delete comment">×</button>
        </div>
      `;
    })
    .join("");
}

function bindDrawerCommentEvents(cardId) {
  drawerContent.querySelector("[data-comment-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = drawerContent.querySelector("[data-comment-input]");
    const body = input.value.trim();
    if (!body) {
      showToast("Write a comment before adding it");
      return;
    }
    const comment = {
      id: `comment-${commentDraftCounter++}`,
      cardId,
      authorId: mockStores.AuthStore.currentUserId,
      body,
      createdAt: nowLabel()
    };
    mockStores.TaskStore.comments.unshift(comment);
    cardById(cardId).history.unshift(`${currentUser().name} commented ${nowLabel()}`);
    addActivity("comment_added", "Comment added", `${currentUser().name} commented on ${cardById(cardId).title}.`);
    input.value = "";
    openDrawer(cardId);
    showToast("Comment added locally");
  });

  drawerContent.querySelectorAll("[data-delete-comment]").forEach((button) => {
    button.addEventListener("click", () => {
      mockStores.TaskStore.comments = mockStores.TaskStore.comments.filter((comment) => comment.id !== button.dataset.deleteComment);
      addActivity("comment_deleted", "Comment deleted", `${currentUser().name} deleted a comment on ${cardById(cardId).title}.`);
      openDrawer(cardId);
      showToast("Comment deleted");
    });
  });
}

function closeTaskDrawer() {
  if (!drawer) return;
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  restoreFocus(lastDrawerTrigger);
  lastDrawerTrigger = null;
}

function randomRealtimeEvent() {
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
  if (mockStores.TaskStore.selectedCardId === task.id) openDrawer(task.id);
  window.setTimeout(() => setSyncState("synced", "Synced · heartbeat just now"), 700);
}

function upsertEditing(userId, cardId, mode) {
  mockStores.PresenceStore.editingUsers = [
    { userId, cardId, duration: "0m 04s", mode },
    ...mockStores.PresenceStore.editingUsers.filter((item) => item.userId !== userId)
  ].slice(0, 4);
}

function bootWorkspace() {
  if (workspaceBooted) return;
  workspaceBooted = true;
  renderAvatars();
  renderBoard();
  renderActivity();
  renderUndoRedoControls();
  window.setTimeout(() => showToast("Workspace synced with live mock state"), 800);
  window.setInterval(randomRealtimeEvent, 9000);
  window.setInterval(() => {
    if (lastChanged) lastChanged.textContent = `Last change ${Math.floor(Math.random() * 4) + 1}s ago`;
  }, 3200);
}

function closeModal() {
  const modalRoot = document.getElementById("modalRoot");
  if (modalRoot) modalRoot.innerHTML = "";
  restoreFocus(lastModalTrigger);
  lastModalTrigger = null;
}

function openModal(title, body, actions = [{ label: "Done", handler: closeModal, style: "primary" }]) {
  const root = document.getElementById("modalRoot");
  if (!root) return;
  lastModalTrigger = document.activeElement;
  root.innerHTML = `
    <div class="modal-backdrop" data-close-modal>
      <section class="modal glass" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <button class="icon-button modal-close" data-close-modal type="button" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
        <p class="kicker">realtime-kanban</p>
        <h2 id="modalTitle">${title}</h2>
        <div class="modal-body">${body}</div>
        <div class="modal-actions">
          ${actions.map((action, index) => `<button class="button ${action.style || "secondary"}" data-modal-action="${index}" type="button">${action.label}</button>`).join("")}
        </div>
      </section>
    </div>
  `;
  root.querySelector("[data-close-modal]")?.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-modal]")) closeModal();
  });
  root.querySelector(".modal-close")?.addEventListener("click", closeModal);
  actions.forEach((action, index) => {
    root.querySelector(`[data-modal-action="${index}"]`)?.addEventListener("click", () => action.handler?.());
  });
  focusFirstInteractive(root.querySelector(".modal"));
}

function openInviteModal() {
  const body = `
    <form class="modal-form" data-invite-form>
      <label>Email<input class="input" name="email" type="email" value="new.member@example.com" required /></label>
      <label>Role
        <select class="input" name="role">
          <option value="viewer">Viewer</option>
          <option value="editor" selected>Editor</option>
        </select>
      </label>
    </form>
  `;
  openModal("Invite member", body, [
    { label: "Cancel", handler: closeModal, style: "secondary" },
    {
      label: "Create invite",
      style: "primary",
      handler: () => {
        const form = document.querySelector("[data-invite-form]");
        const formData = new FormData(form);
        createInvite(formData.get("email"), formData.get("role"));
        closeModal();
      }
    }
  ]);
}

function createInvite(email, role) {
  if (!email) {
    showToast("Invite requires an email");
    return;
  }
  mockStores.InvitationStore.invites.unshift({
    id: `invite-${Date.now()}`,
    email,
    role,
    status: "pending",
    invitedBy: currentUser().name,
    createdAt: nowLabel()
  });
  addActivity("invite_sent", "Invite sent", `${currentUser().name} invited ${email} as ${role}.`);
  renderInvites();
  showToast(`Invite created for ${email}`);
}

function acceptInvite(inviteId) {
  const invite = mockStores.InvitationStore.invites.find((item) => item.id === inviteId) || mockStores.InvitationStore.invites[0];
  if (!invite) return;
  invite.status = "accepted";
  mockStores.AuthStore.invitation.status = "accepted";
  addActivity("invite_accepted", "Invite accepted", `${invite.email} accepted ${invite.role} access.`);
  renderInvites();
  showToast("Invitation accepted");
}

function revokeInvite(inviteId) {
  const invite = mockStores.InvitationStore.invites.find((item) => item.id === inviteId);
  mockStores.InvitationStore.invites = mockStores.InvitationStore.invites.filter((item) => item.id !== inviteId);
  addActivity("invite_revoked", "Invite revoked", `${currentUser().name} revoked invite for ${invite?.email || "member"}.`);
  renderInvites();
  showToast("Invite revoked");
}

function renderInvites() {
  const containers = document.querySelectorAll("[data-invite-list]");
  containers.forEach((container) => {
    const invites = mockStores.InvitationStore.invites;
    container.innerHTML = invites.length
      ? invites.map((invite) => `
        <article class="invite-row" data-invite-id="${invite.id}">
          <div>
            <strong>${invite.email}</strong>
            <span>${invite.role.toUpperCase()} · ${invite.status} · ${invite.createdAt}</span>
          </div>
          <div class="inline-actions">
            ${invite.status === "pending" ? `<button class="button secondary" type="button" data-accept-invite="${invite.id}">Accept</button>` : ""}
            <button class="button secondary" type="button" data-revoke-invite="${invite.id}">Revoke</button>
          </div>
        </article>
      `).join("")
      : `<div class="empty-state informative compact"><strong>No pending invites</strong><span>Create one when a teammate needs board access.</span></div>`;
  });
  document.querySelectorAll("[data-accept-invite]").forEach((button) => button.addEventListener("click", () => acceptInvite(button.dataset.acceptInvite)));
  document.querySelectorAll("[data-revoke-invite]").forEach((button) => button.addEventListener("click", () => revokeInvite(button.dataset.revokeInvite)));
}

function openConflictModal(cardId = "websocket-layer") {
  const conflict = { ...mockStores.ConflictStore.activeConflict, cardId };
  const task = cardById(conflict.cardId) || cardById("websocket-layer");
  const body = `
    <div class="conflict-preview">
      <div><span>Card</span><strong>${task.title}</strong></div>
      <div><span>Field</span><strong>${conflict.field}</strong></div>
      <article><strong>Mine</strong><p>${conflict.mine}</p></article>
      <article><strong>Server</strong><p>${conflict.server}</p></article>
      <article><strong>Merged</strong><p>${conflict.merged}</p></article>
    </div>
  `;
  openModal("Resolve conflict", body, [
    { label: "Keep Mine", handler: () => resolveConflict(task.id, conflict.mine, "kept local version"), style: "secondary" },
    { label: "Use Server Version", handler: () => resolveConflict(task.id, conflict.server, "used server version"), style: "secondary" },
    { label: "Merge Changes", handler: () => resolveConflict(task.id, conflict.merged, "merged both versions"), style: "primary" }
  ]);
}

function resolveConflict(cardId, description, resolution) {
  const task = cardById(cardId);
  if (!task) return;
  task.description = description;
  task.status = "live";
  task.labels = Array.from(new Set(["LIVE", ...task.labels.filter((badge) => badge !== "CONFLICT")]));
  task.history.unshift(`${currentUser().name} ${resolution}`);
  addActivity("conflict_resolved", "Conflict resolved", `${currentUser().name} ${resolution} on ${task.title}.`);
  renderBoard();
  if (mockStores.TaskStore.selectedCardId === cardId) openDrawer(cardId);
  closeModal();
  showToast(`Conflict resolved: ${resolution}`);
}

function renderSearchResults() {
  const root = document.getElementById("searchResults");
  const input = document.getElementById("searchInput");
  if (!root || !input) return;
  const query = input.value.trim().toLowerCase();
  const boardFilter = document.querySelector("[data-search-board]")?.value || "any";
  const statusFilter = document.querySelector("[data-search-status]")?.value || "any";
  const memberFilter = document.querySelector("[data-search-member]")?.value || "any";
  const labelFilter = document.querySelector("[data-search-label]")?.value || "any";

  const taskResults = mockStores.TaskStore.cards.map((card) => {
    const boardItem = boardById(card.boardId);
    const user = userById(card.assigneeId);
    return {
      kind: "TASK",
      title: card.title,
      body: `${card.column} on ${boardItem?.name || "Workspace"}, assigned to ${user.name}.`,
      board: card.boardId,
      status: card.status,
      member: card.assigneeId,
      labels: card.labels.map(badgeClass),
      haystack: `${card.title} ${card.description} ${card.column} ${boardItem?.name} ${user.name} ${card.status} ${card.labels.join(" ")}`.toLowerCase()
    };
  });
  const boardResults = mockStores.BoardStore.boards.map((boardItem) => ({
    kind: "BOARD",
    title: boardItem.name,
    body: `${boardItem.cards} cards, ${boardItem.online} online collaborators.`,
    board: boardItem.id,
    status: "live",
    member: "any",
    labels: ["online"],
    haystack: `${boardItem.name} ${boardItem.summary} board online`.toLowerCase()
  }));
  const memberResults = mockStores.PresenceStore.users.map((user) => ({
    kind: "USER",
    title: user.name,
    body: `${user.role} · ${user.presence} · ${user.activity}.`,
    board: "any",
    status: user.presence,
    member: user.id,
    labels: [user.role, user.presence],
    haystack: `${user.name} ${user.email} ${user.role} ${user.presence} ${user.activity}`.toLowerCase()
  }));

  const results = [...taskResults, ...boardResults, ...memberResults].filter((item) => {
    const matchesQuery = !query || item.haystack.includes(query);
    const matchesBoard = boardFilter === "any" || item.board === boardFilter;
    const matchesStatus = statusFilter === "any" || item.status === statusFilter;
    const matchesMember = memberFilter === "any" || item.member === memberFilter;
    const matchesLabel = labelFilter === "any" || item.labels.includes(labelFilter);
    return matchesQuery && matchesBoard && matchesStatus && matchesMember && matchesLabel;
  });

  root.innerHTML = results.length
    ? results.map((item) => `
      <article class="result-card" data-component="SearchResultCard">
        <span class="status-badge ${badgeClass(item.kind === "TASK" ? item.status : item.kind)}">${item.kind}</span>
        <h2>${item.title}</h2>
        <p>${item.body}</p>
      </article>
    `).join("")
    : `<div class="empty-state informative"><strong>No results match</strong><span>Clear a filter or search for a card title, board, member, or status.</span></div>`;
}

function initSearch() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  input.addEventListener("input", renderSearchResults);
  document.querySelectorAll("[data-search-board], [data-search-status], [data-search-member], [data-search-label]").forEach((select) => {
    select.addEventListener("change", renderSearchResults);
  });
  renderSearchResults();
}

function renderOfflineQueue() {
  const queue = document.getElementById("offlineQueue");
  const badge = document.getElementById("connectionBadge");
  const summary = document.querySelector("[data-offline-summary]");
  if (badge) {
    badge.textContent = mockStores.OfflineStore.connection.toUpperCase();
    badge.className = `status-badge ${badgeClass(mockStores.OfflineStore.connection)}`;
  }
  if (summary) {
    summary.textContent = `${mockStores.OfflineStore.pendingQueue.length} local changes waiting. Connection is ${mockStores.OfflineStore.connection}.`;
  }
  if (!queue) return;
  queue.innerHTML = mockStores.OfflineStore.pendingQueue.length
    ? mockStores.OfflineStore.pendingQueue.map((item) => `
      <div class="queue-item" data-component="OfflineQueueItem">
        <span class="status-badge ${badgeClass(item.status)}">${item.status}</span>
        <strong>${item.label}</strong>
      </div>
    `).join("")
    : `<div class="empty-state informative"><strong>Queue clear</strong><span>All local actions have been replayed into the mock realtime channel.</span></div>`;
}

function initOffline() {
  if (document.body.dataset.page !== "offline") return;
  renderOfflineQueue();
  document.getElementById("simulateOffline")?.addEventListener("click", () => {
    mockStores.OfflineStore.connection = "offline";
    if (!mockStores.OfflineStore.pendingQueue.length) {
      mockStores.OfflineStore.pendingQueue = [
        { id: `offline-${Date.now()}`, type: "card_moved", label: "Move Release Notes to Done", status: "queued" }
      ];
    }
    setSyncState("offline", "Offline · local queue active");
    renderOfflineQueue();
    showToast("Offline simulation enabled");
  });
  document.getElementById("retrySync")?.addEventListener("click", () => {
    mockStores.OfflineStore.connection = "reconnecting";
    mockStores.OfflineStore.pendingQueue = mockStores.OfflineStore.pendingQueue.map((item) => ({ ...item, status: "syncing" }));
    setSyncState("reconnecting", "Reconnecting · replaying queue");
    renderOfflineQueue();
    showToast("Retrying sync");
    window.setTimeout(() => {
      mockStores.OfflineStore.connection = "synced";
      mockStores.OfflineStore.pendingQueue = [];
      setSyncState("synced", "Synced · queue replayed");
      addActivity("sync_restored", "Sync restored", "Offline queue was replayed successfully.");
      renderOfflineQueue();
      showToast("Offline queue replayed");
    }, 900);
  });
}

function renderNotifications() {
  const list = document.querySelector("[data-notification-list]");
  if (!list) return;
  list.innerHTML = mockStores.NotificationStore.notifications.map((note) => `
    <article class="notification ${note.unread ? "unread" : ""} ${note.type.includes("conflict") ? "conflict" : ""}" data-notification="${note.id}" data-component="NotificationItem" role="button" tabindex="0" aria-label="Toggle notification: ${note.title}">
      <strong>${note.title}</strong>
      <p>${note.body}</p>
      <time>${note.createdAt}</time>
    </article>
  `).join("");
  initNotifications();
}

function initNotifications() {
  document.querySelectorAll("[data-notification]").forEach((item) => {
    const toggleNotification = () => {
      const note = mockStores.NotificationStore.notifications.find((entry) => entry.id === item.dataset.notification);
      if (note) note.unread = !note.unread;
      item.classList.toggle("unread");
    };
    item.addEventListener("click", toggleNotification);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleNotification();
      }
    });
  });
}

function renderActivityPage() {
  const timeline = document.querySelector("[data-activity-timeline]");
  if (!timeline) return;
  const typeMap = {
    card_moved: "cards",
    card_edited: "cards",
    card_created: "cards",
    comment_added: "cards",
    comment_deleted: "cards",
    invite_sent: "members",
    invite_accepted: "members",
    invite_revoked: "members",
    conflict_detected: "conflicts",
    conflict_resolved: "conflicts",
    sync_restored: "system"
  };
  timeline.innerHTML = mockStores.ActivityStore.events.map((event) => {
    const actor = userById(event.actorId);
    return `
      <article data-type="${typeMap[event.type] || "system"}">
        <span class="tiny-avatar" style="--ring:${actor.color}">${actor.initials}</span>
        <div><strong>${event.title}</strong><p>${event.body}</p><time>${event.createdAt}</time></div>
      </article>
    `;
  }).join("");
}

function initFilters() {
  const group = document.querySelector("[data-filter-group]");
  if (!group) return;
  renderActivityPage();
  group.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    group.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    const filter = button.dataset.filter;
    document.querySelectorAll(".timeline article").forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.type !== filter;
    });
  });
}

function initAiAssistant() {
  const output = document.getElementById("aiOutput");
  document.getElementById("generateAi")?.addEventListener("click", () => {
    output.innerHTML = "<li>Confirm realtime payload shape</li><li>Add rollback checkpoint</li><li>Write card movement tests</li><li>Request editor review</li>";
    showToast("AI checklist generated");
  });
  document.querySelectorAll("[data-ai-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-ai-mode]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    });
  });
}

function initBoardCards() {
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

function initSettingsLanguage() {
  if (document.body.dataset.page !== "settings") return;
  const select = document.querySelector('[data-select-kind="language"]');
  if (!select) return;
  const option = select.querySelector(`[data-value="${mockStores.SettingsStore.language}"]`) || select.querySelector('[data-value="en"]');
  if (option) setCustomSelectOption(select, option, { silent: true });
}

function closeCustomSelect(select) {
  const trigger = select.querySelector("[data-custom-select-trigger]");
  select.classList.remove("open");
  trigger?.setAttribute("aria-expanded", "false");
}

function closeCustomSelectAndRestore(select) {
  closeCustomSelect(select);
  restoreFocus(lastSelectTrigger || select.querySelector("[data-custom-select-trigger]"));
  lastSelectTrigger = null;
}

function openCustomSelect(select) {
  const trigger = select.querySelector("[data-custom-select-trigger]");
  document.querySelectorAll("[data-custom-select].open").forEach((item) => {
    if (item !== select) closeCustomSelect(item);
  });
  lastSelectTrigger = trigger;
  select.classList.add("open");
  trigger?.setAttribute("aria-expanded", "true");
}

function setCustomSelectOption(select, option, config = {}) {
  const valueInput = select.querySelector("[data-custom-select-value]");
  const title = select.querySelector("[data-custom-select-title]");
  const description = select.querySelector("[data-custom-select-description]");
  const options = Array.from(select.querySelectorAll("[data-custom-select-menu] [data-value]"));
  const nextValue = option.dataset.value || "";

  if (valueInput) valueInput.value = nextValue;
  if (title) title.textContent = option.dataset.title || option.textContent.trim();
  if (description) description.textContent = option.dataset.description || "";

  options.forEach((item) => {
    const isActive = item === option;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-selected", String(isActive));
  });

  closeCustomSelect(select);
  if (config.silent) return;

  if (select.dataset.selectKind === "language") {
    mockStores.SettingsStore.language = nextValue;
    localStorage.setItem("rk_language", nextValue);
    showToast(nextValue === "ru" ? "Язык изменён на русский" : "Language changed to English");
    return;
  }

  mockStores.SettingsStore.conflictStrategy = nextValue;
  showToast(`Conflict strategy set to ${option.dataset.title}`);
}

function initCustomSelects() {
  document.querySelectorAll("[data-custom-select]").forEach((select) => {
    const trigger = select.querySelector("[data-custom-select-trigger]");
    const options = Array.from(select.querySelectorAll("[data-custom-select-menu] [data-value]"));
    if (!trigger || !options.length) return;
    if (!trigger.getAttribute("aria-label")) {
      trigger.setAttribute("aria-label", trigger.textContent.trim().replace(/\s+/g, " "));
    }

    trigger.addEventListener("click", () => {
      if (select.classList.contains("open")) closeCustomSelect(select);
      else openCustomSelect(select);
    });

    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCustomSelect(select);
        options.find((option) => option.classList.contains("active"))?.focus();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeCustomSelect(select);
      }
    });

    options.forEach((option, index) => {
      option.addEventListener("click", () => setCustomSelectOption(select, option));
      option.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setCustomSelectOption(select, option);
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          options[(index + 1) % options.length].focus();
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          options[(index - 1 + options.length) % options.length].focus();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          closeCustomSelectAndRestore(select);
        }
      });
    });
  });

  document.addEventListener("click", (event) => {
    document.querySelectorAll("[data-custom-select].open").forEach((select) => {
      if (!select.contains(event.target)) closeCustomSelect(select);
    });
  });
}

function initRealtimeStatus() {
  setSyncState(mockStores.PresenceStore.syncState, "Synced · heartbeat just now");
  const feed = document.querySelector("[data-realtime-feed]");
  if (!feed) return;
  feed.innerHTML = mockStores.PresenceStore.editingUsers.map((presence) => {
    const user = userById(presence.userId);
    const task = cardById(presence.cardId);
    return `<span>${user.name} ${presence.mode} ${task?.title || "board"}</span>`;
  }).join("");
  window.setInterval(() => {
    setSyncState("synced", `Synced · heartbeat ${Math.floor(Math.random() * 4) + 1}s ago`);
  }, 4200);
}

function initRoleToggles() {
  const roleOrder = ["viewer", "editor"];
  document.querySelectorAll("[data-role-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const current = roleOrder.find((role) => button.classList.contains(role)) || "viewer";
      const next = roleOrder[(roleOrder.indexOf(current) + 1) % roleOrder.length];
      roleOrder.forEach((role) => button.classList.remove(role));
      button.classList.add(next);
      button.textContent = next.toUpperCase();
      addActivity("member_role_changed", "Role changed", `${currentUser().name} changed a member role to ${next}.`);
      showToast(`Mock role changed to ${next.toUpperCase()}`);
    });
  });
}

function initUndoRedo() {
  document.querySelectorAll("[data-undo-action]").forEach((button) => button.addEventListener("click", undoLastMove));
  document.querySelectorAll("[data-redo-action]").forEach((button) => button.addEventListener("click", redoLastMove));
  renderUndoRedoControls();
}

enterButton?.addEventListener("click", () => {
  window.location.href = "workspace/boards.html";
});

if (new URLSearchParams(window.location.search).get("workspace") === "1") {
  if (welcome) welcome.hidden = true;
  if (workspace) {
    workspace.hidden = false;
    workspace.classList.add("active");
  }
  bootWorkspace();
}

closeDrawer?.addEventListener("click", closeTaskDrawer);

document.addEventListener("keydown", (event) => {
  const activeModal = document.querySelector(".modal");
  const activeDrawer = drawer?.classList.contains("open") ? drawer : null;
  if (activeModal) trapFocus(event, activeModal);
  else if (activeDrawer) trapFocus(event, activeDrawer);

  if (event.key === "Escape") {
    closeTaskDrawer();
    closeModal();
    document.querySelectorAll("[data-custom-select].open").forEach((select) => closeCustomSelectAndRestore(select));
  }
});

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
  document.querySelector("[data-accept-invitation]")?.addEventListener("click", (event) => {
    event.preventDefault();
    acceptInvite("invite-01");
    window.setTimeout(() => {
      window.location.href = "../workspace/board.html";
    }, 500);
  });
}

function initStaticApp() {
  initSelectedBoard();
  syncBoardRouteLinks();
  renderSelectedBoardMeta();
  initActiveNavigation();
  document.querySelectorAll("[data-open-invite]").forEach((button) => button.addEventListener("click", openInviteModal));
  document.querySelectorAll("[data-conflict-demo]").forEach((button) => button.addEventListener("click", () => openConflictModal()));
  initFilters();
  initSearch();
  renderNotifications();
  initOffline();
  initAiAssistant();
  initBoardCards();
  initSettingsLanguage();
  initCustomSelects();
  initRealtimeStatus();
  initRoleToggles();
  initUndoRedo();
  initAuthForms();
  renderInvites();
  if (document.body.dataset.page === "board") bootWorkspace();
  if (document.body.dataset.page && !["welcome", "board"].includes(document.body.dataset.page)) {
    window.setTimeout(() => showToast("Realtime mock channel connected"), 900);
  }
}

initStaticApp();
