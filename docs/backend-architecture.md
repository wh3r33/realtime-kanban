# Backend Architecture

## Stack

- Supabase Auth
- PostgreSQL
- Realtime
- RLS
- RPC Functions

## Roles

- Owner
- Editor
- Viewer

## Main Tables

- profiles
- boards
- board_members
- columns
- cards
- activity_logs
- board_invites

## Realtime

- cards
- columns
- activity_logs

## Conflict Strategy

Version-based optimistic locking.