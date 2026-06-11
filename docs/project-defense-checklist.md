# Project Defense Checklist

- Explain why Vue Router uses canonical board-scoped routes under `/boards/:boardId`.
- Explain why Pinia owns board, card, member, auth, and UI state.
- Show how card movement updates both `column` and `position`.
- Explain the repository adapter boundary in `src/services/cardRepository.js`.
- Identify which features are mock-only before Supabase integration.
- Show `.env.example` and explain the required Supabase variables.
- Show GitHub Actions CI and the local build command.
- Discuss accessibility coverage: focus states, live announcements, empty states, and keyboard movement controls.
- Discuss remaining risks: no automated component tests, mock auth, and no real RLS validation yet.
