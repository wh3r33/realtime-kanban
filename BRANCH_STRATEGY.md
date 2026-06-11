# Branch Strategy

## Branches

- `main`: production-ready code. Every merge must pass CI and build locally.
- `develop`: integration branch for migration work before release.
- `feature/<scope>`: focused implementation branches, for example `feature/vue-router-board-routes`.
- `fix/<scope>`: production or release fixes.
- `docs/<scope>`: documentation-only changes.

## Pull Request Rules

- Keep PRs scoped to one migration area or one defect.
- Include validation output from `npm run build`.
- Update `README.md`, `ARCHITECTURE.md`, or `MIGRATION_CHECKLIST.md` when behavior, routes, state shape, or DevOps changes.
- Do not merge prototype-only changes as product behavior unless the Vue implementation is updated too.

## Release Flow

1. Branch from `develop`.
2. Implement and validate locally.
3. Open a PR into `develop`.
4. Promote `develop` to `main` after CI passes and the demo checklist is complete.
