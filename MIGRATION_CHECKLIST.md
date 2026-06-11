# realtime-kanban Migration Checklist

## Completed

- [x] Vue 3 app shell with Vite.
- [x] Vue Router installed and configured.
- [x] Canonical board-scoped routes under `/boards/:boardId`.
- [x] Compatibility redirects for earlier flat Vue routes.
- [x] Pinia installed and active.
- [x] Board, card, member, auth, and UI stores.
- [x] Core component architecture: `AppShell`, `TopBar`, `BoardView`, `TaskCard`, `TaskDrawer`, `ActivityRail`, `ToastStack`.
- [x] Boards dashboard migrated to Vue.
- [x] Board state, selected card, activity feed, toasts, and settings flow through Vue state.
- [x] Native drag/drop card movement.
- [x] Cross-column movement.
- [x] Per-column card positions persisted in Pinia state.
- [x] Undo and redo for card movement.
- [x] Persistence adapter prepared for Supabase card movement.
- [x] Notifications route backed by Pinia.
- [x] Loading, 403, and 404 system state views.
- [x] Empty states for columns and filtered activity.
- [x] Responsive CSS for desktop, tablet, and mobile.
- [x] Dark mode via Pinia, local storage, and `data-theme`.
- [x] Focus-visible styles and reduced-motion CSS.
- [x] Keyboard movement controls for cards.
- [x] `.env.example`.
- [x] GitHub Actions build workflow.
- [x] Branch strategy documentation.
- [x] Architecture diagram source.
- [x] Screenshots checklist.
- [x] Demo video checklist.
- [x] Project defense checklist.

## Partial

- [ ] Auth views are route placeholders and still need full forms.
- [ ] Bonus analytics, search, offline, and AI assistant routes are placeholders.
- [ ] Drag/drop supports keyboard left/right movement but not full roving tabindex pickup/drop behavior.
- [ ] Error handling is present as system states and store flags, but no backend error mapping exists yet.
- [ ] Environment variables are documented, but Supabase schema and deployed project are not connected.
- [ ] Automated accessibility and responsive regression checks are not installed.

## Missing

- [ ] Component tests for board movement, drawer state, conflicts, notifications, and route guards.
- [ ] Real authentication.
- [ ] Supabase schema, migrations, realtime subscriptions, and RLS policies.
- [ ] Production deployment configuration.

## Current Route Map

| Route | View |
|---|---|
| `/` | `WelcomeView` |
| `/auth/login` | `PlaceholderView` |
| `/auth/register` | `PlaceholderView` |
| `/auth/forgot-password` | `PlaceholderView` |
| `/auth/invitations/:token` | `PlaceholderView` |
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

## Store Contracts

- `AuthStore`: current user, session, invitation.
- `BoardStore`: boards, selected board ID, columns, board settings.
- `CardsStore`: cards, comments, selected card, undo/redo history, movement persistence.
- `MembersStore`: members, editing users, locks.
- `UiStore`: sync state, activity events, notifications, toasts, theme, loading/error flags.

## Supabase Tasks

- Create schema for boards, columns, cards, comments, activity, notifications, invitations, and card movements.
- Replace local movement log in `cardRepository` with verified table writes.
- Subscribe to board-scoped card insert/update/delete/move events.
- Subscribe to comment and activity inserts.
- Publish presence join/leave and editing/viewing state.
- Add optimistic rollback when server persistence fails.
- Add RLS policies for board membership and role-based mutations.

## Validation

```bash
npm install
npm run build
```

Optional:

```bash
npm run check
```
