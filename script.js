const users = [
  { name: "NN User", initials: "NN", color: "#2855FF" },
  { name: "User 02", initials: "02", color: "#D6FF00" },
  { name: "User 03", initials: "03", color: "#111111" },
  { name: "Guest User", initials: "GU", color: "#F05252" }
];

const columns = ["Backlog", "Todo", "In Progress", "Review", "Done"];

let tasks = [
  {
    id: "api-task",
    title: "API Task",
    description: "Define optimistic updates, retry states, and visible event confirmations for board movement.",
    column: "In Progress",
    assignee: "NN User",
    badges: ["LIVE", "EDITING"],
    state: "editing",
    comments: ["Sync payload is stable.", "Review optimistic movement after drawer edits."],
    history: ["Created in Backlog", "Moved to In Progress by NN User"]
  },
  {
    id: "design-system",
    title: "Design System",
    description: "Refine badge language, glass surfaces, typography rhythm, and status hierarchy.",
    column: "Todo",
    assignee: "User 02",
    badges: ["EDITING"],
    state: "editing",
    comments: ["Keep cobalt as the repeated product signal."],
    history: ["User 02 started editing"]
  },
  {
    id: "websocket-layer",
    title: "WebSocket Layer",
    description: "Simulate conflict detection, lock ownership, and event ordering for shared cards.",
    column: "Review",
    assignee: "User 03",
    badges: ["CONFLICT", "LIVE"],
    state: "conflict",
    comments: ["Conflict detected between reorder and title edit."],
    history: ["Conflict detected in WebSocket Layer"]
  },
  {
    id: "mobile-scroll",
    title: "Mobile Board Scroll",
    description: "Preserve five-column context with controlled horizontal movement on small screens.",
    column: "Backlog",
    assignee: "Guest User",
    badges: ["ONLINE"],
    state: "live",
    comments: ["Tablet width feels balanced."],
    history: ["Guest User opened mobile preview"]
  },
  {
    id: "permissions-model",
    title: "Permissions Model",
    description: "Show locked cards without hiding ownership, reason, or current collaborator.",
    column: "Backlog",
    assignee: "NN User",
    badges: ["LOCKED"],
    state: "locked",
    comments: ["Locked by NN User for schema review."],
    history: ["NN User locked Permissions Model"]
  },
  {
    id: "release-notes",
    title: "Release Notes",
    description: "Write short technical status notes for live product changes.",
    column: "Done",
    assignee: "User 02",
    badges: ["LIVE"],
    state: "live",
    comments: ["Version note drafted."],
    history: ["User 02 completed release notes"]
  }
];

let activities = [
  "NN User moved API Task to Review",
  "User 02 is editing Design System",
  "Conflict detected in WebSocket Layer",
  "Guest User joined realtime-kanban Board"
];

let selectedTaskId = null;
let draggedTaskId = null;
let workspaceBooted = false;

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

function initialsFor(name) {
  return users.find((user) => user.name === name)?.initials || "GU";
}

function colorFor(name) {
  return users.find((user) => user.name === name)?.color || "#2855FF";
}

function badgeClass(label) {
  return label.toLowerCase();
}

function renderAvatars() {
  if (!miniAvatars) return;
  miniAvatars.innerHTML = users
    .map(
      (user) =>
        `<span class="avatar" style="--ring:${user.color}" title="${user.name}">${user.initials}</span>`
    )
    .join("");
}

function renderBoard() {
  if (!board) return;
  board.innerHTML = columns
    .map((column) => {
      const columnTasks = tasks.filter((task) => task.column === column);
      const cards = columnTasks.length
        ? columnTasks.map(renderCard).join("")
        : `<div class="empty-state">Flow</div>`;

      return `
        <article class="column" data-column="${column}">
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
  const stateClass = task.state === "conflict" ? "conflict-state" : task.state === "locked" ? "locked-state" : "";
  return `
    <article class="task-card ${stateClass}" draggable="true" data-task-id="${task.id}" tabindex="0" aria-label="${task.title}">
      <div class="card-badges">
        ${task.badges.map((badge) => `<span class="status-badge ${badgeClass(badge)}">${badge}</span>`).join("")}
      </div>
      <div>
        <h3>${task.title}</h3>
        <p>${task.description}</p>
      </div>
      <div class="live-line" aria-hidden="true"></div>
      <div class="card-meta">
        <span class="assignee"><span class="tiny-avatar" style="--ring:${colorFor(task.assignee)}">${initialsFor(task.assignee)}</span>${task.assignee}</span>
        <span class="status-badge ${badgeClass(task.badges[0])}">${task.state.toUpperCase()}</span>
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
  const task = tasks.find((item) => item.id === taskId);
  if (!task || task.column === targetColumn) return;

  task.column = targetColumn;
  task.badges = Array.from(new Set(["LIVE", ...task.badges.filter((badge) => badge !== "LOCKED")]));
  if (task.state === "locked") task.state = "live";
  task.history.unshift(`Moved to ${targetColumn} by NN User`);
  addActivity(`NN User moved ${task.title} to ${targetColumn}`);
  renderBoard();
  if (selectedTaskId === taskId) openDrawer(taskId);
  if (announce) showToast(`${task.title} moved to ${targetColumn}`);
}

function renderActivity() {
  if (!activityFeed || !editingNow) return;
  activityFeed.innerHTML = activities
    .slice(0, 6)
    .map(
      (activity, index) => `
        <div class="activity-item ${index === 0 ? "new" : ""}">
          <strong>${activity.split(" ").slice(0, 2).join(" ")}</strong>
          <span>${activity}</span>
        </div>
      `
    )
    .join("");

  const editingTasks = tasks.filter((task) => task.badges.includes("EDITING") || task.state === "conflict");
  editingNow.innerHTML = editingTasks
    .slice(0, 3)
    .map(
      (task) => `
        <div class="editing-item">
          <strong>${task.assignee}</strong>
          <span>${task.state === "conflict" ? "Conflict on" : "Editing"} ${task.title}</span>
        </div>
      `
    )
    .join("");
}

function addActivity(message) {
  activities.unshift(message);
  activities = activities.slice(0, 10);
  if (lastChanged) lastChanged.textContent = "Last change just now";
  renderActivity();
}

function openDrawer(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task || !drawer || !drawerTitle || !drawerContent) return;

  selectedTaskId = taskId;
  drawerTitle.textContent = task.title;
  drawerContent.innerHTML = `
    <div class="drawer-block">
      <div class="card-badges">
        ${task.badges.map((badge) => `<span class="status-badge ${badgeClass(badge)}">${badge}</span>`).join("")}
      </div>
      <p>${task.description}</p>
    </div>
    <div class="drawer-block">
      <h4>Collaboration State</h4>
      <div class="drawer-row"><span>Status</span><strong>${task.state.toUpperCase()}</strong></div>
      <div class="drawer-row"><span>Assigned User</span><strong>${task.assignee}</strong></div>
      <div class="drawer-row"><span>Column</span><strong>${task.column}</strong></div>
    </div>
    <div class="drawer-block">
      <h4>Activity History</h4>
      ${task.history.map((item) => `<p>${item}</p>`).join("")}
    </div>
    <div class="drawer-block">
      <h4>Comments</h4>
      ${task.comments
        .map(
          (comment) => `
            <div class="comment">
              <span class="tiny-avatar" style="--ring:${colorFor(task.assignee)}">${initialsFor(task.assignee)}</span>
              <p>${comment}</p>
            </div>
          `
        )
        .join("")}
    </div>
  `;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
}

function closeTaskDrawer() {
  if (!drawer) return;
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
}

function showToast(message) {
  if (!toastStack) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span>${message}</span>${message.includes("moved") ? '<button type="button" data-undo>Undo</button>' : ""}`;
  toastStack.appendChild(toast);
  toast.querySelector("[data-undo]")?.addEventListener("click", () => {
    showToast("Move reverted in mock history");
    toast.remove();
  });
  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    window.setTimeout(() => toast.remove(), 240);
  }, 3600);
}

function randomRealtimeEvent() {
  const eventType = Math.floor(Math.random() * 4);
  const task = tasks[Math.floor(Math.random() * tasks.length)];
  const user = users[Math.floor(Math.random() * users.length)];

  if (eventType === 0) {
    task.assignee = user.name;
    task.state = "editing";
    task.badges = Array.from(new Set(["EDITING", "LIVE", ...task.badges.filter((badge) => badge !== "LOCKED")]));
    task.history.unshift(`${user.name} is editing ${task.title}`);
    addActivity(`${user.name} is editing ${task.title}`);
    showToast(`${user.name} started editing ${task.title}`);
  }

  if (eventType === 1) {
    task.state = "conflict";
    task.badges = Array.from(new Set(["CONFLICT", "LIVE", ...task.badges.filter((badge) => badge !== "LOCKED")]));
    task.history.unshift(`Conflict detected in ${task.title}`);
    addActivity(`Conflict detected in ${task.title}`);
    showToast(`Conflict detected in ${task.title}`);
  }

  if (eventType === 2) {
    task.state = "locked";
    task.badges = Array.from(new Set(["LOCKED", ...task.badges.filter((badge) => badge !== "EDITING")]));
    task.history.unshift(`${user.name} locked ${task.title}`);
    addActivity(`${user.name} locked ${task.title}`);
    showToast(`${task.title} is locked by ${user.name}`);
  }

  if (eventType === 3) {
    const targetColumn = columns[Math.floor(Math.random() * columns.length)];
    task.column = targetColumn;
    task.state = "live";
    task.badges = Array.from(new Set(["LIVE", "ONLINE"]));
    task.history.unshift(`${user.name} moved ${task.title} to ${targetColumn}`);
    addActivity(`${user.name} moved ${task.title} to ${targetColumn}`);
    showToast(`${task.title} moved to ${targetColumn}`);
  }

  renderBoard();
  if (selectedTaskId === task.id) openDrawer(task.id);
}

function bootWorkspace() {
  if (workspaceBooted) return;
  workspaceBooted = true;
  renderAvatars();
  renderBoard();
  renderActivity();

  window.setTimeout(() => showToast("Workspace synced with 4 online users"), 800);
  window.setInterval(randomRealtimeEvent, 6200);
  window.setInterval(() => {
    if (lastChanged) lastChanged.textContent = `Last change ${Math.floor(Math.random() * 4) + 1}s ago`;
  }, 2600);
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
  if (event.key === "Escape") {
    closeTaskDrawer();
    const modalRoot = document.getElementById("modalRoot");
    if (modalRoot) modalRoot.innerHTML = "";
    document.querySelectorAll("[data-custom-select].open").forEach((select) => closeCustomSelect(select));
  }
});

function initActiveNavigation() {
  const current = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav] a").forEach((link) => {
    if (link.getAttribute("href")?.split("/").pop() === current) link.classList.add("active");
  });
}

function openModal(title, body, actionLabel = "Done") {
  const root = document.getElementById("modalRoot");
  if (!root) return;
  root.innerHTML = `
    <div class="modal-backdrop" data-close-modal>
      <section class="modal glass" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <button class="icon-button modal-close" data-close-modal type="button" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
        <p class="kicker">realtime-kanban</p>
        <h2 id="modalTitle">${title}</h2>
        <p>${body}</p>
        <button class="button primary" data-close-modal type="button">${actionLabel}</button>
      </section>
    </div>
  `;
  root.querySelectorAll("[data-close-modal]").forEach((item) => item.addEventListener("click", (event) => {
    if (event.target === item || item.matches("button")) root.innerHTML = "";
  }));
  root.querySelector(".modal-close")?.focus();
}

function initInviteModal() {
  document.querySelectorAll("[data-open-invite]").forEach((button) => {
    button.addEventListener("click", () => openModal("Invite member", "Mock invite prepared for User 03 as Editor. Share link copied in prototype state.", "Send invite"));
  });
}

function initConflictModal() {
  document.querySelectorAll("[data-conflict-demo]").forEach((button) => {
    button.addEventListener("click", () => openModal("Conflict preview", "Versioned last-write-wins will keep the newest change, preserve rollback history, and show both authors before resolving.", "Resolve mock conflict"));
  });
}

function closeCustomSelect(select) {
  const trigger = select.querySelector("[data-custom-select-trigger]");
  select.classList.remove("open");
  trigger?.setAttribute("aria-expanded", "false");
}

function openCustomSelect(select) {
  const trigger = select.querySelector("[data-custom-select-trigger]");
  document.querySelectorAll("[data-custom-select].open").forEach((item) => {
    if (item !== select) closeCustomSelect(item);
  });
  select.classList.add("open");
  trigger?.setAttribute("aria-expanded", "true");
}

function setCustomSelectOption(select, option) {
  const valueInput = select.querySelector("[data-custom-select-value]");
  const title = select.querySelector("[data-custom-select-title]");
  const description = select.querySelector("[data-custom-select-description]");
  const options = Array.from(select.querySelectorAll("[data-custom-select-menu] [data-value]"));

  if (valueInput) valueInput.value = option.dataset.value || "";
  if (title) title.textContent = option.dataset.title || option.textContent.trim();
  if (description) description.textContent = option.dataset.description || "";

  options.forEach((item) => {
    const isActive = item === option;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-selected", String(isActive));
  });

  closeCustomSelect(select);
  showToast(`Conflict strategy set to ${option.dataset.title}`);
}

function initCustomSelects() {
  document.querySelectorAll("[data-custom-select]").forEach((select) => {
    const trigger = select.querySelector("[data-custom-select-trigger]");
    const options = Array.from(select.querySelectorAll("[data-custom-select-menu] [data-value]"));
    if (!trigger || !options.length) return;

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
  const syncText = document.querySelector("[data-sync-text]");
  const liveStatus = document.querySelector("[data-live-status]");
  const feed = document.querySelector("[data-realtime-feed]");
  if (!syncText && !liveStatus && !feed) return;

  const events = [
    "NN User editing Design System",
    "User 02 moved API Task to Review",
    "Guest User viewing board",
    "Presence synced across 4 members"
  ];
  let index = 0;

  window.setInterval(() => {
    index = (index + 1) % events.length;
    if (syncText) syncText.textContent = `Live · heartbeat ${index + 1}s ago`;
    if (liveStatus) liveStatus.textContent = index % 2 ? "SYNCED" : "LIVE";
    if (feed) {
      feed.prepend(Object.assign(document.createElement("span"), { textContent: events[index] }));
      while (feed.children.length > 3) feed.lastElementChild.remove();
    }
  }, 2800);
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
      showToast(`Mock role changed to ${next.toUpperCase()}`);
    });
  });
}

function initFilters() {
  const group = document.querySelector("[data-filter-group]");
  if (!group) return;
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

function initSearch() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  input.addEventListener("input", () => {
    const value = input.value.trim().toLowerCase();
    document.querySelectorAll("[data-search]").forEach((item) => {
      item.hidden = value && !item.dataset.search.includes(value);
    });
  });
}

function initNotifications() {
  document.querySelectorAll("[data-notification]").forEach((item) => {
    item.addEventListener("click", () => item.classList.toggle("unread"));
  });
}

function initOffline() {
  const retry = document.getElementById("retrySync");
  retry?.addEventListener("click", () => {
    document.getElementById("connectionBadge").textContent = "ONLINE";
    document.getElementById("connectionBadge").className = "status-badge live";
    document.getElementById("offlineQueue").innerHTML = '<div class="empty-state">Synced</div>';
    showToast("Offline queue replayed");
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
      window.location.href = "board.html";
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

function initStaticApp() {
  initActiveNavigation();
  initInviteModal();
  initConflictModal();
  initFilters();
  initSearch();
  initNotifications();
  initOffline();
  initAiAssistant();
  initBoardCards();
  initCustomSelects();
  initRealtimeStatus();
  initRoleToggles();
  if (document.body.dataset.page === "board") bootWorkspace();
  if (document.body.dataset.page && document.body.dataset.page !== "welcome") {
    window.setTimeout(() => showToast("Realtime mock channel connected"), 900);
  }
}

initStaticApp();
