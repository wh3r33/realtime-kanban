# realtime-kanban Architecture

The active application is a Vite-powered Vue 3 app. The `prototype/` directory is retained as a reference for copy, layout, and feature parity, but product behavior now runs through Vue Router, Pinia, Vue components, and service adapters under `src/`.

## Runtime Composition

```text
src/main.js
  createApp(App)
    Pinia
    Vue Router
    global CSS tokens

App.vue
  RouterView

AppShell.vue
  TopBar
  ActivityRail
  workspace RouterView
  TaskDrawer
  ToastStack
```

## Component Hierarchy

```text
App
  WelcomeView
  AppShell
    TopBar
      board-scoped navigation
      undo/redo
      theme toggle
      notification link
    RouterView
      BoardsView
      BoardView
        BoardColumn
          TaskCard
        empty column state
        movement aria-live region
      ActivityView
      MembersView
      SettingsView
      ProfileView
      NotificationsView
      PlaceholderView
      SystemStateView
    ActivityRail
    TaskDrawer
    ToastStack
```

`BoardColumn` is currently an inline boundary inside `BoardView.vue`, matching the existing architecture without introducing a thin duplicate component.

## Routing

Canonical routes are board-scoped:

```text
/boards
/boards/:boardId
/boards/:boardId/activity
/boards/:boardId/members
/boards/:boardId/settings
/profile
/bonus/notifications
/bonus/analytics
/bonus/search
/bonus/offline
/bonus/ai-assistant
/auth/login
/auth/register
/auth/forgot-password
/auth/invitations/:token
/403
/404
/loading
```

`src/router/index.js` also keeps compatibility redirects from the earlier flat Vue routes (`/board`, `/activity`, `/members`, `/settings`). Route guards validate mock authentication state and known board IDs.

## State Management

Pinia stores own all active app state:

- `auth`: mock session, current workspace, invitation state.
- `boards`: boards, selected board ID, columns, board settings.
- `cards`: cards, comments, selected card, undo/redo movement history, movement persistence errors.
- `members`: member records, editing presence, locks.
- `ui`: sync state, activity events, notifications, toasts, loading/error flags, theme.

The stores clone mock data at initialization so runtime mutations do not mutate imported module data.

## Drag And Drop

`BoardView.vue` handles native drag/drop and keyboard movement controls. Both paths call `cardsStore.moveTask(cardId, targetColumn, toIndex)`.

The cards store updates:

- `column`
- per-column `position`
- `updatedAt`
- history entries
- undo/redo stacks

Movement announcements are written to an `aria-live` region, and card movement controls provide a keyboard alternative to pointer drag and drop.

## Persistence Boundary

`src/services/cardRepository.js` is the persistence adapter for card movement.

Current behavior:

- If Supabase env vars are missing, movement events are written to `localStorage`.
- If Supabase env vars are present, the adapter writes to a future `card_movements` table through `@supabase/supabase-js`.

This keeps Vue state independent from the eventual backend shape and gives Supabase integration a single replacement point.

## Future Supabase Integration

Expected tables/channels:

- `boards`, `columns`, `cards`, `comments`
- `activity_events`
- `notifications`
- `invitations`
- `card_movements`
- board-scoped realtime channels using `boardId`
- presence channels for online/editing/lock state

Expected RLS policies:

- Board membership required for reads.
- Owner/editor permissions required for mutations.
- Viewer mutations blocked at the database layer.
- Activity, notification, and invitation rows scoped to accessible boards.

## Prototype Reference

The `prototype/` directory remains useful for parity checks and future migration of bonus/auth views. It must not become a second runtime source of truth.
