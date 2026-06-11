export const nowLabel = () => "just now";

export const mockStores = {
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
      { id: "api-task", boardId: "board-main", title: "API Task", description: "Define optimistic updates, retry states, and visible event confirmations for board movement.", column: "In Progress", assigneeId: "u-nn", status: "editing", labels: ["LIVE", "EDITING"], history: ["Created in Backlog", "Moved to In Progress by NN User"], updatedAt: "just now" },
      { id: "design-system", boardId: "board-design", title: "Design System", description: "Refine badge language, glass surfaces, typography rhythm, and status hierarchy.", column: "Todo", assigneeId: "u-02", status: "editing", labels: ["EDITING"], history: ["User 02 started editing"], updatedAt: "2m ago" },
      { id: "websocket-layer", boardId: "board-realtime", title: "WebSocket Layer", description: "Simulate conflict detection, lock ownership, and event ordering for shared cards.", column: "Review", assigneeId: "u-03", status: "conflict", labels: ["CONFLICT", "LIVE"], history: ["Conflict detected in WebSocket Layer"], updatedAt: "4m ago" },
      { id: "mobile-scroll", boardId: "board-design", title: "Mobile Board Scroll", description: "Preserve five-column context with controlled horizontal movement on small screens.", column: "Backlog", assigneeId: "u-gu", status: "live", labels: ["ONLINE"], history: ["Guest User opened mobile preview"], updatedAt: "8m ago" },
      { id: "permissions-model", boardId: "board-realtime", title: "Permissions Model", description: "Show locked cards without hiding ownership, reason, or current collaborator.", column: "Backlog", assigneeId: "u-nn", status: "locked", labels: ["LOCKED"], history: ["NN User locked Permissions Model"], updatedAt: "11m ago" },
      { id: "release-notes", boardId: "board-main", title: "Release Notes", description: "Write short technical status notes for live product changes.", column: "Done", assigneeId: "u-02", status: "live", labels: ["LIVE"], history: ["User 02 completed release notes"], updatedAt: "14m ago" }
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
    locks: [{ cardId: "permissions-model", userId: "u-nn", reason: "Schema review", duration: "6m 22s" }]
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

export function userById(id) {
  return mockStores.PresenceStore.users.find((user) => user.id === id) || mockStores.PresenceStore.users[0];
}

export function currentUser() {
  return userById(mockStores.AuthStore.currentUserId);
}

export function cardById(id) {
  return mockStores.TaskStore.cards.find((card) => card.id === id);
}

export function boardById(id) {
  return mockStores.BoardStore.boards.find((boardItem) => boardItem.id === id);
}

export function selectedBoard() {
  return boardById(mockStores.BoardStore.selectedBoardId) || mockStores.BoardStore.boards[0];
}

export function commentsFor(cardId) {
  return mockStores.TaskStore.comments.filter((comment) => comment.cardId === cardId);
}

export function badgeClass(label) {
  return String(label).toLowerCase().replace(/\s+/g, "-");
}
