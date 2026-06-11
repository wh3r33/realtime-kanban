# realtime-kanban

realtime-kanban is a static HTML/CSS/JavaScript prototype for a collaborative kanban workspace. It models board navigation, cards, presence, activity, invitations, conflicts, offline queue behavior, notifications, and bonus utility views before migration to Vue.

## Current Stack

- HTML pages in root, `authentication/`, `workspace/`, `bonus/`, and `system/`
- Shared CSS in `styles.css`
- Vanilla ES modules under `js/`, loaded through `js/app.js`
- Mock data and mock store objects in `js/data/mockStores.js`
- Local static assets in `assets/`

`script.js` is now a legacy reference file only. Static pages should load `js/app.js` with `type="module"`.

## Run Locally

```bash
python3 -m http.server 8000
```

Open `http://127.0.0.1:8000/`.

The prototype can also be inspected as static files, but running a local server is preferred because future Vue/Vite migration will use route-based navigation.

## Page Map

| Static page | Future Vue route |
|---|---|
| `index.html` | `/` |
| `authentication/login.html` | `/auth/login` |
| `authentication/register.html` | `/auth/register` |
| `authentication/forgot-password.html` | `/auth/forgot-password` |
| `authentication/accept-invitation.html` | `/auth/invitations/:token` |
| `workspace/boards.html` | `/boards` |
| `workspace/board.html?boardId=board-main` | `/boards/:boardId` |
| `workspace/activity.html?boardId=board-main` | `/boards/:boardId/activity` |
| `workspace/members.html?boardId=board-main` | `/boards/:boardId/members` |
| `workspace/settings.html?boardId=board-main` | `/boards/:boardId/settings` |
| `workspace/profile.html` | `/profile` |
| `bonus/ai-assistant.html` | `/bonus/ai-assistant` |
| `bonus/analytics.html` | `/bonus/analytics` |
| `bonus/search.html` | `/bonus/search` |
| `bonus/notifications.html` | `/bonus/notifications` |
| `bonus/offline.html` | `/bonus/offline` |
| `system/403.html` | `/403` |
| `system/404.html` | `/404` |
| `system/loading.html` | loading/suspense state |

## Implemented Prototype Features

- Multiple board cards with mock board IDs
- Board-scoped static navigation through centralized router helpers and `boardId` query params
- Kanban columns and task cards
- Drag-and-drop card movement with undo/redo history
- Task drawer with details, comments, locks, editing state, and activity history
- Activity feed and activity filters
- Member, role, invitation, notification, search, analytics, AI assistant, and offline queue screens
- Modal, toast, custom select, badge, avatar, and button patterns
- Basic keyboard and focus handling for modal, drawer, and custom select interactions

## Module Map

```text
js/data/mockStores.js      mock store data and selectors
js/core/router.js          static route bridge and future Vue Router metadata
js/core/dom.js             focus helpers and aria-live region setup
js/core/events.js          global Escape and focus-trap coordination
js/ui/                     toast, modal, drawer, dropdown primitives
js/features/               board, tasks, comments, activity, members, settings,
                           search, notifications, offline, invites, conflicts, ai
js/app.js                  composition root for static pages
```

Template strings are isolated inside feature modules and named after future Vue component boundaries, for example `renderTaskCardTemplate`, `renderBoardColumnTemplate`, `renderActivityItemTemplate`, `renderNotificationTemplate`, and `renderSearchResultTemplate`.

## Validation

```bash
node --check js/app.js
node tools/audit-js.mjs
node tools/audit-links.mjs
node tools/audit-routes.mjs
```

Optional static smoke test:

```bash
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000/`.

## Mock-Only Features

- Authentication and session state
- Realtime transport, presence channels, edit locks, and sync heartbeats
- Role enforcement and permissions
- Invitation tokens and invitation delivery
- Conflict reconciliation
- Offline persistence and replay
- AI generation
- Analytics calculations
- Notification delivery and persistence

## Team Responsibility Placeholders

- Product owner: TBD
- Frontend lead: TBD
- Backend/API lead: TBD
- Realtime/Supabase owner: TBD
- Design system owner: TBD
- Accessibility reviewer: TBD
- QA owner: TBD

## Future Vue Migration Note

Do not migrate directly from page-level DOM scripting to a final backend implementation. First migrate the current mock data and behavior into Vue 3, Vite, Vue Router, and Pinia while preserving the existing UI. Then replace mock actions with API, Supabase Realtime, and RLS-backed behavior in separate phases.
