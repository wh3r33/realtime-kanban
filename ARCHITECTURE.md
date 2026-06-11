# realtime-kanban Frontend Architecture

This prototype remains HTML, CSS, and vanilla JavaScript. It is structured to make the next migration step to Vue 3, Pinia, and Vue Router predictable without changing the current design language.

## Component Tree

```text
App
  AppShell
    TopBar
      MainNav
      PresenceCluster
      ProfileButton
    ToastStack
    Modal

  AuthLayout
    AuthBrandPane
    AuthFormCard
    InvitationPreview

  WorkspaceLayout
    BoardHeader
    Board
      BoardColumn
        TaskCard
    ActivityRail
    TaskDrawer
      CommentList
      CommentForm

  BoardsView
    BoardCard
    CreateBoardCard
    RecentActivityPanel

  ActivityView
    ActivityFilters
    ActivityFeed
      ActivityEventItem

  MembersView
    PresenceStrip
    MemberCard
    RoleBadge
    InviteList

  SettingsView
    SettingsSection
    CustomSelect
    SyncStatusPanel
    DangerZone

  BonusViews
    AiAssistantPanel
    AnalyticsCard
    SearchFilters
    SearchResultCard
    NotificationItem
    OfflineQueue

  SystemViews
    ErrorState
    LoadingState
```

## Vue Router Structure

```text
/                         -> redirect to /boards or marketing welcome
/auth/login               -> LoginView
/auth/register            -> RegisterView
/auth/forgot-password     -> ForgotPasswordView
/auth/invitations/:token  -> AcceptInvitationView

/boards                   -> BoardsView
/boards/:boardId          -> BoardView
/boards/:boardId/activity -> ActivityView
/boards/:boardId/members  -> MembersView
/boards/:boardId/settings -> SettingsView
/profile                  -> ProfileView

/bonus/ai-assistant       -> AiAssistantView
/bonus/analytics          -> AnalyticsView
/bonus/search             -> SearchView
/bonus/notifications      -> NotificationsView
/bonus/offline            -> OfflineView

/403                      -> ForbiddenView
/:pathMatch(.*)*          -> NotFoundView
```

The current static pages map cleanly. Board-scoped pages use `?boardId=<id>` as a static prototype bridge so Vue Router can later replace it with `/boards/:boardId` route params.

## Future Pinia Stores

### AuthStore

- `currentUserId`
- `currentUser`
- `session`
- `invitation`
- actions: `login`, `logout`, `acceptInvitation`

### BoardStore

- `boards`
- `selectedBoardId`
- `selectedBoard`
- `columns`
- `boardSettings`
- actions: `selectBoard`, `createBoard`, `updateBoardSettings`

### TaskStore

- `cards`
- `selectedCardId`
- `selectedCard`
- `comments`
- `undoHistory`
- `redoHistory`
- actions: `moveCard`, `undoLastMove`, `redoLastMove`, `addComment`, `deleteComment`, `resolveConflict`

### PresenceStore

- `users`
- `onlineUsers`
- `editingUsers`
- `locks`
- `syncState`
- actions: `joinPresence`, `leavePresence`, `setEditing`, `setLock`, `setSyncState`

### ActivityStore

- `events`
- `filters`
- actions: `addEvent`, `filterEvents`, `replayEvents`

### NotificationStore

- `notifications`
- `unreadCount`
- actions: `markRead`, `toggleUnread`, `pushNotification`

### SettingsStore

- `language`
- `theme`
- `conflictStrategy`
- actions: `setLanguage`, `setTheme`, `setConflictStrategy`

### InvitationStore

- `invites`
- actions: `createInvite`, `acceptInvite`, `revokeInvite`

### OfflineStore

- `connection`
- `pendingQueue`
- actions: `simulateOffline`, `queueAction`, `retrySync`, `clearQueue`

## Data Models

### Board

```ts
type Board = {
  id: string
  name: string
  summary: string
  columns: number
  cards: number
  online: number
  updated: string
}
```

### Column

```ts
type Column = {
  id: string
  boardId: string
  name: string
  position: number
}
```

### Card

```ts
type Card = {
  id: string
  boardId: string
  title: string
  description: string
  column: string
  assigneeId: string
  status: "live" | "editing" | "locked" | "conflict"
  labels: string[]
  history: string[]
  updatedAt: string
}
```

### User

```ts
type User = {
  id: string
  name: string
  email: string
  initials: string
  color: string
  role: Role
  presence: "online" | "away" | "offline"
  activity: string
}
```

### Member

```ts
type Member = {
  userId: string
  boardId: string
  role: Role
  joinedAt: string
}
```

### Role

```ts
type Role = "owner" | "editor" | "viewer"
```

### Comment

```ts
type Comment = {
  id: string
  cardId: string
  authorId: string
  body: string
  createdAt: string
}
```

### Notification

```ts
type Notification = {
  id: string
  type: string
  title: string
  body: string
  createdAt: string
  unread: boolean
}
```

### ActivityEvent

```ts
type ActivityEvent = {
  id: string
  type:
    | "card_created"
    | "card_edited"
    | "card_moved"
    | "comment_added"
    | "invite_sent"
    | "invite_accepted"
    | "conflict_detected"
    | "conflict_resolved"
    | "sync_restored"
  actorId: string
  title: string
  body: string
  createdAt: string
}
```

### Conflict

```ts
type Conflict = {
  id: string
  cardId: string
  field: string
  mine: string
  server: string
  merged: string
}
```

### OfflineAction

```ts
type OfflineAction = {
  id: string
  type: string
  label: string
  status: "queued" | "syncing" | "synced" | "failed"
}
```

## Realtime Strategy

Optimistic updates:

- Apply card moves, comments, and role changes immediately in the UI.
- Push an `ActivityEvent` locally at the same time.
- Store reversible card movement in `undoHistory`.
- Clear `redoHistory` after a new card movement.

Rollback:

- Every optimistic move stores `{ cardId, from, to, title }`.
- Undo applies `from`, pushes the action to `redoHistory`, and emits a local activity event.
- Redo applies `to`, pushes the action back to `undoHistory`, and emits a local activity event.

Conflict handling:

- Conflicts are represented as a `Conflict` with `mine`, `server`, and `merged` values.
- Resolution choices are `Keep Mine`, `Use Server Version`, and `Merge Changes`.
- A resolution updates the card, removes the conflict label, restores `live` status, and writes an activity event.

Presence:

- Presence has four visible states: `online`, `away`, `offline`, and active `editing/viewing`.
- Editing ownership lives in `PresenceStore.editingUsers`.
- Card locks live in `PresenceStore.locks` and should block edits for non-owners during the backend phase.

Activity events:

- Every important local action writes one event.
- Event types include card created, card edited, card moved, invite sent, invite accepted, conflict detected, and sync restored.
- The board rail and Activity page should consume the same event source.

Sync states:

- Supported states: `syncing`, `synced`, `offline`, and `reconnecting`.
- Offline actions remain visible in `OfflineStore.pendingQueue`.
- Retry sync marks items `syncing`, then clears the queue and emits `sync_restored`.

## Migration Plan

### Phase 1: Static Structure to Vue Shell

- Create Vue app shell, router, layouts, and design tokens.
- Port `AppShell`, `TopBar`, `ToastStack`, and `Modal`.
- Keep mock data identical to `mockStores` during the first pass.

### Phase 2: Pinia Store Migration

- Convert `mockStores` into Pinia stores.
- Replace DOM query renderers with computed state and component props.
- Preserve undo/redo and conflict logic as store actions.

### Phase 3: Feature Views

- Migrate Board, TaskDrawer, Comments, Search, Members, Invitations, Offline Center, and Notifications.
- Replace the static `boardId` query bridge with Vue Router params for board-scoped pages.
- Add component tests around store actions and view rendering.

### Phase 4: Realtime Backend Integration

- Connect Supabase Realtime or WebSocket events.
- Replace mock intervals with channel subscriptions.
- Add backend-backed auth, memberships, roles, optimistic mutation rollback, and server conflict reconciliation.

## Current Prototype Notes

- The active implementation is the root file set. There should be no nested duplicate `realtime-kanban/` project tree before migration.
- The original `Faith` font is not available from the current font import. The prototype now uses `Playfair Display` with Georgia and Times as fallbacks for the small amount of display typography.
- The visual system intentionally keeps cobalt/accent status language and the existing restrained paper workspace, but glass treatment is limited to navigation and overlays.
