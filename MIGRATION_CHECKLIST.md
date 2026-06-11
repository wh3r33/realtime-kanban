# realtime-kanban Migration Checklist

## Completed

- [x] Vue 3 app shell with Vite.
- [x] Vue Router installed and configured.
- [x] Canonical board-scoped routes under `/boards/:boardId`.
- [x] Compatibility redirects point to `/boards` without inventing a default board.
- [x] Pinia installed and active.
- [x] Supabase client setup with setup-required state when env vars are missing.
- [x] `getCurrentUser()` and `getCurrentProfile()`.
- [x] Repository layer for boards, cards, members, and activity.
- [x] Boards dashboard loads real boards from Supabase.
- [x] Empty `/boards` state when the database has no boards.
- [x] Board creation inserts board, owner membership, default columns, and activity log.
- [x] Board page loads real board, columns, and cards.
- [x] Empty column states without fake cards.
- [x] Card create, update, delete, and move write to Supabase.
- [x] Card movement writes `column_id` and `position`.
- [x] Members page shows only real `board_members` joined with `users`.
- [x] Activity page and rail load from `activity_logs`.
- [x] Active runtime no longer imports `src/data/mockData.js`.
- [x] Misleading fake online/editing/status labels removed or replaced with honest partial/setup states.
- [x] `npm run build`.
- [x] `npm run check`.

## Partial

- [ ] Realtime: basic Supabase `postgres_changes` subscriptions exist for cards, columns, activity logs, and board members. Remote changes currently trigger reloads rather than fine-grained patching.
- [ ] Presence: not implemented. The UI says “Presence not connected” or hides online/editing details.
- [ ] RLS: policies are not provided in this repo. UI no longer claims “RLS ACTIVE.”
- [ ] Production auth: Supabase auth is wired, but final behavior depends on project settings and `public.handle_new_user()`.
- [ ] Comments: not connected because comments are not in the provided schema.
- [ ] Notifications and invitations: empty/unconnected.
- [ ] Bonus analytics, search, offline, and AI assistant routes are placeholders.
- [ ] Automated accessibility and responsive regression checks are not installed.

## Current Route Map

| Route | View |
|---|---|
| `/` | `WelcomeView` |
| `/auth/login` | `AuthView` |
| `/auth/register` | `AuthView` |
| `/auth/forgot-password` | `AuthView` |
| `/auth/invitations/:token` | `AuthView` |
| `/boards` | `BoardsView` |
| `/boards/:boardId` | `BoardView` |
| `/boards/:boardId/activity` | `ActivityView` |
| `/boards/:boardId/members` | `MembersView` |
| `/boards/:boardId/settings` | `SettingsView` |
| `/profile` | `ProfileView` |
| `/bonus/notifications` | `NotificationsView` |
| `/bonus/analytics` | `PlaceholderView` |
| `/bonus/search` | `PlaceholderView` |
| `/bonus/offline` | `PlaceholderView` |
| `/bonus/ai-assistant` | `PlaceholderView` |
| `/403` | `SystemStateView` |
| `/404` | `SystemStateView` |
| `/loading` | `SystemStateView` |

## Manual Validation

1. Start with empty Supabase tables.
2. Open `/boards`.
3. Confirm no fake boards are visible.
4. Create a new board.
5. Confirm board appears from Supabase.
6. Open board.
7. Confirm default columns exist.
8. Add card.
9. Refresh page.
10. Confirm card persists from Supabase.
11. Move card.
12. Refresh page.
13. Confirm column and position persist.
14. Open members.
15. Confirm only real members are shown.
16. Open activity.
17. Confirm only real activity logs are shown.
18. Confirm no fake online/editing users appear.
