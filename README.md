# realtime-kanban

Vue 3 collaborative kanban prototype with board-scoped routing, Pinia state, cross-column card movement, notifications, responsive layouts, dark mode, and a thin persistence adapter ready for Supabase.

The legacy static prototype remains in `prototype/` as migration reference material. The active app is the Vite/Vue runtime in `src/`.

## Stack

- Vue 3 and Vite
- Vue Router 4
- Pinia
- Supabase JS client, currently optional and gated by environment variables
- CSS tokens and global styles in `src/assets/styles/`

## Run Locally

```bash
npm install
npm run dev
```

Build validation:

```bash
npm run build
```

`npm run check` currently aliases the production build. No lint script exists yet.

## Environment

Copy `.env.example` when Supabase integration begins:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

When these values are absent, card movement persistence uses local mock storage. When they are present, `src/services/cardRepository.js` is ready to write movement rows through the Supabase client.

## Routes

| Route | Status | View |
|---|---:|---|
| `/` | completed | welcome |
| `/boards` | completed | board dashboard |
| `/boards/:boardId` | completed | kanban board |
| `/boards/:boardId/activity` | completed | activity timeline |
| `/boards/:boardId/members` | completed | members and roles |
| `/boards/:boardId/settings` | completed | board settings |
| `/profile` | completed | profile preferences |
| `/bonus/notifications` | completed | notification list |
| `/bonus/analytics` | partial | placeholder |
| `/bonus/search` | partial | placeholder |
| `/bonus/offline` | partial | placeholder |
| `/bonus/ai-assistant` | partial | placeholder |
| `/auth/login` | partial | placeholder |
| `/auth/register` | partial | placeholder |
| `/auth/forgot-password` | partial | placeholder |
| `/auth/invitations/:token` | partial | placeholder |
| `/403`, `/404`, `/loading` | completed | system states |

Legacy aliases such as `/board`, `/activity`, `/members`, and `/settings` redirect to the default board-scoped route.

## Core Behavior

- Boards, cards, members, auth session, notifications, activity, and UI preferences live in Pinia.
- Card drag and drop moves cards across columns and stores per-column `position`.
- Undo and redo share the same card movement action path.
- Keyboard card movement uses left/right controls on each card and announces movement through an `aria-live` region.
- Notifications can be marked read from the notifications route.
- Dark mode is stored in local storage and applied through `data-theme`.

## Documentation

- [Architecture](ARCHITECTURE.md)
- [Migration checklist](MIGRATION_CHECKLIST.md)
- [Branch strategy](BRANCH_STRATEGY.md)
- [Architecture diagram source](docs/architecture-diagram.mmd)
- [Screenshots checklist](docs/screenshots-checklist.md)
- [Demo video checklist](docs/demo-video-checklist.md)
- [Project defense checklist](docs/project-defense-checklist.md)
