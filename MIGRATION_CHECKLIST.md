# realtime-kanban Migration Checklist

This checklist keeps the current static prototype ready for a later Vue 3, Vite, Pinia, and Vue Router migration. Do not treat it as a request to migrate now.

## Readiness Checklist

- [x] Static page tree is shallow and active at the repo root.
- [x] Shared CSS tokens exist in `styles.css`.
- [x] Mock state exists in `script.js`.
- [x] Static pages expose `data-page` and future `data-route` metadata.
- [x] Board pages support `boardId` query params as a bridge to route params.
- [ ] Replace direct DOM renderers with Vue components.
- [ ] Replace global mutable mock stores with Pinia stores.
- [ ] Add route guards for auth, membership, and board access.
- [ ] Add component tests for board movement, drawer state, conflicts, and invites.
- [ ] Add accessibility regression checks.
- [ ] Add responsive regression checks.

## Vue Router Route Map

| Route | View |
|---|---|
| `/` | WelcomeView or redirect to `/boards` |
| `/auth/login` | LoginView |
| `/auth/register` | RegisterView |
| `/auth/forgot-password` | ForgotPasswordView |
| `/auth/invitations/:token` | AcceptInvitationView |
| `/boards` | BoardsView |
| `/boards/:boardId` | BoardView |
| `/boards/:boardId/activity` | ActivityView |
| `/boards/:boardId/members` | MembersView |
| `/boards/:boardId/settings` | SettingsView |
| `/profile` | ProfileView |
| `/bonus/ai-assistant` | AiAssistantView |
| `/bonus/analytics` | AnalyticsView |
| `/bonus/search` | SearchView |
| `/bonus/notifications` | NotificationsView |
| `/bonus/offline` | OfflineView |
| `/403` | ForbiddenView |
| `/404` | NotFoundView |
| `/:pathMatch(.*)*` | NotFoundView |

## Pinia Stores

- `AuthStore`: current user, session, invitation token, login/logout/accept invitation actions.
- `BoardStore`: boards, selected board ID, board settings, board-scoped columns.
- `TaskStore`: cards, selected card, comments, undo history, redo history, movement and conflict actions.
- `PresenceStore`: online users, editing users, locks, sync state, channel lifecycle.
- `ActivityStore`: activity events, filters, event publishing, event replay.
- `NotificationStore`: notifications, unread count, read/unread actions.
- `SettingsStore`: language, theme, conflict strategy, persisted preferences.
- `InvitationStore`: pending invites, accepted invites, create/revoke/accept actions.
- `OfflineStore`: connection state, pending queue, retry and replay actions.

## Component Extraction List

Global:
- `AppShell`
- `TopBar`
- `MainNav`
- `Modal`
- `Toast`
- `Button`
- `Avatar`
- `Badge`
- `Dropdown`

Workspace:
- `BoardHeader`
- `BoardColumn`
- `TaskCard`
- `TaskDrawer`
- `CommentList`
- `CommentForm`
- `ActivityRail`
- `PresenceStrip`

Members:
- `MemberCard`
- `RoleBadge`
- `InviteList`

Settings:
- `SettingsSection`
- `CustomSelect`
- `SyncStatusPanel`
- `DangerZone`

Bonus:
- `AiAssistantPanel`
- `AnalyticsCard`
- `NotificationItem`
- `SearchResultCard`
- `OfflineQueue`

System/Auth:
- `AuthLayout`
- `AuthFormCard`
- `InvitationPreview`
- `ErrorState`
- `LoadingState`

## Backend/API Contracts Needed

- Auth session contract: current user, workspace membership, role, invite token state.
- Board contract: list boards, get board by ID, update board settings.
- Column contract: list columns by board, reorder columns when needed.
- Card contract: list cards by board, create/update/move/delete cards.
- Comment contract: list/add/delete comments by card.
- Activity contract: append events, list events by board, filter events.
- Notification contract: list notifications, mark read/unread, unread count.
- Invitation contract: create invite, accept token, revoke invite.
- Conflict contract: compare local/server values, resolve with selected strategy.
- Offline contract: queue mutation, retry mutation, reconcile result.

## Supabase Realtime Tasks

- Define board channels by `boardId`.
- Subscribe to card insert/update/delete/move events.
- Subscribe to comment insert/delete events.
- Subscribe to activity event inserts.
- Publish presence join/leave and editing/viewing state.
- Publish and clear card lock state.
- Handle reconnect and replay missed events.
- Add optimistic update rollback when server rejection or conflict occurs.

## RLS Tasks

- Enforce board membership on board, column, card, comment, activity, invite, and notification tables.
- Enforce owner/editor/viewer permissions.
- Block viewer mutations at the database layer.
- Restrict invite creation and revocation to owners or configured editors.
- Ensure presence and activity rows are scoped to boards the user can access.
- Add policies for conflict and offline replay mutations.

## Accessibility Tasks

- Keep visible focus states for all interactive controls.
- Preserve modal focus trap, initial focus, Escape close, and return focus.
- Treat task drawer as a dialog-like surface with `aria-modal`, initial focus, Escape close, and return focus.
- Preserve custom select keyboard handling for Enter, Escape, ArrowDown, and ArrowUp.
- Add keyboard alternatives for drag-and-drop before production.
- Ensure clickable cards and notifications have button-equivalent semantics and keyboard activation.
- Verify color contrast against WCAG AA.

## Responsive Tasks

- Verify desktop, tablet, and mobile layouts for all routes.
- Confirm top navigation does not clip primary actions.
- Confirm board horizontal scrolling works on touch devices.
- Confirm activity rail and toast stack do not overlap critical controls.
- Confirm task drawer is usable on narrow screens.
- Confirm custom select menus are not clipped.

## Migration Order

1. Create Vite/Vue app shell and route table.
2. Move design tokens and global CSS into the Vue app without visual redesign.
3. Port `mockStores` into Pinia stores with the same data shape.
4. Port global components: `AppShell`, `TopBar`, `MainNav`, `Modal`, `Toast`, `Button`, `Avatar`, `Badge`, `Dropdown`.
5. Port board-scoped routes and selected board lookup from route params.
6. Port board, columns, cards, drawer, comments, undo/redo, and conflict modal.
7. Port members, settings, activity, search, notifications, offline, analytics, and AI views.
8. Add tests around stores, route params, and component rendering.
9. Integrate backend APIs.
10. Integrate Supabase Realtime and RLS.
