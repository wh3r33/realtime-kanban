# realtime-kanban Architecture

The active application is a Vite-powered Vue 3 app. Prototype/mock files remain as reference material, but the runtime source of truth is Vue Router, Pinia, Vue components, and Supabase service adapters under `src/`.

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

## Routing

Canonical routes are board-scoped:

```text
/boards
/boards/:boardId
/boards/:boardId/activity
/boards/:boardId/members
/boards/:boardId/settings
```

Legacy flat routes redirect to `/boards` so an empty database does not invent `board-main`.

## State Management

- `auth`: Supabase auth user/profile, current board role, setup-required state.
- `boards`: real boards, selected board ID, real columns, board settings flags.
- `cards`: real cards, selected card, card CRUD, move persistence, undo/redo labels, realtime subscription handle.
- `members`: real board members and roles. Presence, editing users, and locks are empty until implemented.
- `ui`: sync state, real activity logs, empty notifications, toasts, theme, loading/error flags.

Stores initialize with empty arrays. They do not import `src/data/mockData.js`.

## Service Layer

- `src/services/supabaseClient.js`
  - Creates the Supabase client.
  - Exposes `getCurrentUser()` and `getCurrentProfile()`.
- `src/services/boardRepository.js`
  - `listBoardsForCurrentUser()`
  - `createBoard(title, description)`
  - `getBoard(boardId)`
  - `getBoardColumns(boardId)`
  - `getBoardCards(boardId)`
  - `createDefaultColumns(boardId)`
- `src/services/cardRepository.js`
  - `createCard(boardId, columnId, payload)`
  - `updateCard(cardId, payload)`
  - `deleteCard(cardId)`
  - `moveCard(cardId, columnId, position)`
- `src/services/memberRepository.js`
  - `listBoardMembers(boardId)`
  - `getCurrentUserBoardRole(boardId)`
- `src/services/activityRepository.js`
  - `listBoardActivity(boardId)`
  - `createActivityLog(boardId, action, entityType, entityId, oldData, newData)`

The repositories use the provided schema columns: `boards.owner_id`, `columns.board_id`, `cards.board_id`, `cards.column_id`, `cards.assigned_to`, `cards.created_by`, `board_members.role`, `activity_logs.old_data`, and `activity_logs.new_data`.

## Board Behavior

`BoardsView.vue` loads boards from `listBoardsForCurrentUser()`. If none exist, it renders an empty state and a create-board form. Creating a board inserts:

- `boards`
- owner row in `board_members`
- default `columns`: Todo, In Progress, Review, Done
- `activity_logs` row for `board_created`

`BoardView.vue` loads board, columns, cards, members, and activity by route id. If a board has no columns, it shows an action to create default columns. Empty columns show empty states instead of cards.

## Realtime

`src/services/realtimeService.js` subscribes to board-scoped `postgres_changes` for:

- `cards`
- `columns`
- `activity_logs`
- `board_members`

When Supabase is not configured, the app reports setup required. BroadcastChannel remains available only as a local multi-tab fallback after real board state is loaded. The UI does not show “LIVE” unless the store reports a Supabase subscription.

## Partial Features

- Presence is not implemented. Online/editing indicators are hidden or labelled “Presence not connected.”
- RLS policies are not included. Settings labels say RLS policy is required.
- Production auth depends on Supabase project configuration and `public.handle_new_user()`.
- Comments are not part of the provided schema, so no comments are displayed.
- Notifications and invitations are not connected to a schema table.
