# realtime-kanban

Vue 3 collaborative kanban app with Vue Router, Pinia, and Supabase-backed boards, columns, cards, board members, and activity logs.

The legacy mock dataset remains in `src/data/mockData.js` as reference only. Active runtime code must not import it.

## Stack

- Vue 3 and Vite
- Vue Router 4
- Pinia
- Supabase JS client
- CSS tokens and global styles in `src/assets/styles/`

## Run Locally

```bash
npm install
npm run dev
```

Build validation:

```bash
npm run build
npm run check
```

## Environment

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

When these values are absent, the app shows a setup-required state. It does not fall back to demo boards, users, cards, presence, notifications, or activity.

## Supabase Status

Completed:

- Supabase client setup with `getCurrentUser()` and `getCurrentProfile()`.
- Repository layer for `boards`, `columns`, `cards`, `board_members`, and `activity_logs`.
- `/boards` loads real boards for the current user.
- Board creation inserts `boards`, owner `board_members`, default columns, and a board-created activity log.
- `/boards/:boardId` loads real board, columns, cards, members, and activity.
- Card create, update, delete, and move write to `public.cards` and create `activity_logs`.
- Members page shows only real `board_members` joined with `public.users`.
- Empty database states are honest.

Partial:

- Realtime uses basic board-scoped Supabase `postgres_changes` subscriptions when configured. BroadcastChannel remains only as local multi-tab fallback.
- Presence is not implemented; online/editing sections are hidden or marked “Presence not connected.”
- RLS policies are not provided in this repo; UI labels do not claim RLS is active.
- Production auth depends on Supabase auth configuration and `public.handle_new_user()`.
- Comments, invitations, notifications, analytics, search, offline, and AI assistant are not connected to the provided schema.

## Routes

| Route | Status | View |
|---|---:|---|
| `/` | completed | welcome |
| `/boards` | completed | Supabase board dashboard |
| `/boards/:boardId` | completed | Supabase kanban board |
| `/boards/:boardId/activity` | completed | activity log timeline |
| `/boards/:boardId/members` | completed | real board members and roles |
| `/boards/:boardId/settings` | partial | board settings/status |
| `/profile` | partial | Supabase profile display and local preferences |
| `/bonus/notifications` | partial | empty until notifications are connected |
| `/auth/login` | partial | Supabase auth form |
| `/auth/register` | partial | Supabase registration form |
| `/auth/forgot-password` | partial | Supabase reset request |

Legacy aliases such as `/board`, `/activity`, `/members`, and `/settings` redirect to `/boards`.

## Manual Validation

1. Start with empty Supabase tables.
2. Open `/boards`.
3. Confirm no fake boards are visible.
4. Create a new board.
5. Confirm the board appears from Supabase.
6. Open the board.
7. Confirm default columns exist.
8. Add a card.
9. Refresh the page.
10. Confirm the card persists from Supabase.
11. Move the card.
12. Refresh the page.
13. Confirm `column_id` and `position` persist.
14. Open members.
15. Confirm only real members are shown.
16. Open activity.
17. Confirm only real activity logs are shown.
18. Confirm no fake online/editing users appear.

## Documentation

- [Architecture](ARCHITECTURE.md)
- [Migration checklist](MIGRATION_CHECKLIST.md)
