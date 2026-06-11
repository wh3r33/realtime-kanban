export const boards = [
  { id: "board-main", name: "Product Roadmap", summary: "Priorities, milestones and launch sequencing.", cards: 28, members: 8, activity: 143, online: 3, columns: 5, updated: "Last activity 2m ago" },
  { id: "board-design", name: "Frontend Design", summary: "Premium surfaces, interaction polish and visual QA.", cards: 19, members: 5, activity: 87, online: 2, columns: 5, updated: "User 02 edited a card" },
  { id: "board-realtime", name: "Realtime Engine", summary: "Presence, locks, rollback and event delivery.", cards: 34, members: 6, activity: 121, online: 4, columns: 5, updated: "Conflict resolved 4m ago" },
  { id: "board-qa", name: "QA Review", summary: "Regression passes, blocked states and acceptance notes.", cards: 12, members: 4, activity: 56, online: 1, columns: 4, updated: "Guest User joined" }
];

export const columns = ["Backlog", "Todo", "In Progress", "Review", "Done"];

export const members = [
  { id: "u-nn", name: "NN User", email: "nn.user@example.com", initials: "NN", color: "#2855FF", role: "owner", presence: "online", activity: "Editing API Task" },
  { id: "u-02", name: "User 02", email: "user.02@example.com", initials: "02", color: "#D6FF00", role: "editor", presence: "online", activity: "Editing Design System" },
  { id: "u-03", name: "User 03", email: "user.03@example.com", initials: "03", color: "#111111", role: "viewer", presence: "away", activity: "Viewing Review column" },
  { id: "u-gu", name: "Guest User", email: "guest.user@example.com", initials: "GU", color: "#F05252", role: "viewer", presence: "offline", activity: "Accepted invite yesterday" }
];

export const cards = [
  { id: "api-task", boardId: "board-main", title: "API Task", description: "Define optimistic updates, retry states, and visible event confirmations for board movement.", column: "In Progress", position: 0, assigneeId: "u-nn", status: "editing", labels: ["LIVE", "EDITING"], history: ["Created in Backlog", "Moved to In Progress by NN User"], updatedAt: "just now" },
  { id: "design-system", boardId: "board-design", title: "Design System", description: "Refine badge language, glass surfaces, typography rhythm, and status hierarchy.", column: "Todo", position: 0, assigneeId: "u-02", status: "editing", labels: ["EDITING"], history: ["User 02 started editing"], updatedAt: "2m ago" },
  { id: "websocket-layer", boardId: "board-realtime", title: "WebSocket Layer", description: "Simulate conflict detection, lock ownership, and event ordering for shared cards.", column: "Review", position: 0, assigneeId: "u-03", status: "conflict", labels: ["CONFLICT", "LIVE"], history: ["Conflict detected in WebSocket Layer"], updatedAt: "4m ago" },
  { id: "mobile-scroll", boardId: "board-design", title: "Mobile Board Scroll", description: "Preserve five-column context with controlled horizontal movement on small screens.", column: "Backlog", position: 0, assigneeId: "u-gu", status: "live", labels: ["ONLINE"], history: ["Guest User opened mobile preview"], updatedAt: "8m ago" },
  { id: "permissions-model", boardId: "board-realtime", title: "Permissions Model", description: "Show locked cards without hiding ownership, reason, or current collaborator.", column: "Backlog", position: 0, assigneeId: "u-nn", status: "locked", labels: ["LOCKED"], history: ["NN User locked Permissions Model"], updatedAt: "11m ago" },
  { id: "release-notes", boardId: "board-main", title: "Release Notes", description: "Write short technical status notes for live product changes.", column: "Done", position: 0, assigneeId: "u-02", status: "live", labels: ["LIVE"], history: ["User 02 completed release notes"], updatedAt: "14m ago" }
];

export const notifications = [
  { id: "note-conflict", type: "conflict", title: "Conflict requires review", body: "WebSocket Layer has two competing edits.", createdAt: "4m ago", unread: true },
  { id: "note-invite", type: "invite", title: "Invite accepted", body: "Guest User joined QA Review.", createdAt: "18m ago", unread: true },
  { id: "note-sync", type: "sync", title: "Sync restored", body: "Realtime channel replay completed without rejected mutations.", createdAt: "31m ago", unread: false }
];

export const comments = [
  { id: "comment-1", cardId: "api-task", authorId: "u-nn", body: "Sync payload is stable.", createdAt: "9m ago" },
  { id: "comment-2", cardId: "api-task", authorId: "u-02", body: "Review optimistic movement after drawer edits.", createdAt: "5m ago" },
  { id: "comment-3", cardId: "design-system", authorId: "u-02", body: "Keep cobalt as the repeated product signal.", createdAt: "12m ago" },
  { id: "comment-4", cardId: "websocket-layer", authorId: "u-03", body: "Conflict detected between reorder and title edit.", createdAt: "4m ago" }
];

export const editingUsers = [
  { userId: "u-nn", cardId: "api-task", duration: "1m 12s", mode: "editing" },
  { userId: "u-02", cardId: "design-system", duration: "3m 04s", mode: "editing" },
  { userId: "u-03", cardId: "websocket-layer", duration: "4m 30s", mode: "viewing" }
];

export const locks = [
  { cardId: "permissions-model", userId: "u-nn", reason: "Schema review", duration: "6m 22s" }
];

export const activityEvents = [
  { id: "evt-1", type: "card_moved", actorId: "u-nn", title: "Card moved", body: "NN User moved API Task to Review.", createdAt: "now" },
  { id: "evt-2", type: "card_edited", actorId: "u-02", title: "Card edited", body: "User 02 is editing Design System.", createdAt: "2m" },
  { id: "evt-3", type: "conflict_detected", actorId: "u-03", title: "Conflict detected", body: "WebSocket Layer has two competing edits.", createdAt: "4m" },
  { id: "evt-4", type: "invite_accepted", actorId: "u-gu", title: "Invite accepted", body: "Guest User joined realtime-kanban Board.", createdAt: "18m" }
];

export function badgeClass(value) {
  return String(value).toLowerCase().replace(/\s+/g, "-");
}
