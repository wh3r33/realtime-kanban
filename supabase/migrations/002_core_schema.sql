create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    name text,
    avatar_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.boards (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    owner_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.board_members (
    id uuid primary key default gen_random_uuid(),
    board_id uuid not null references public.boards(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    role text not null check (role in ('owner', 'editor', 'viewer')),
    invited_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    unique(board_id, user_id)
);

create table public.columns (
    id uuid primary key default gen_random_uuid(),
    board_id uuid not null references public.boards(id) on delete cascade,
    title text not null,
    position numeric not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.cards (
    id uuid primary key default gen_random_uuid(),
    board_id uuid not null references public.boards(id) on delete cascade,
    column_id uuid not null references public.columns(id) on delete cascade,
    title text not null,
    description text,
    position numeric not null,
    assigned_to uuid references public.profiles(id),
    created_by uuid references public.profiles(id),
    updated_by uuid references public.profiles(id),
    labels jsonb not null default '[]'::jsonb,
    status text not null default 'active' check (status in ('active', 'archived', 'deleted')),
    version integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.activity_logs (
    id uuid primary key default gen_random_uuid(),
    board_id uuid not null references public.boards(id) on delete cascade,
    user_id uuid references public.profiles(id),
    action text not null,
    entity_type text not null,
    entity_id uuid,
    old_data jsonb,
    new_data jsonb,
    created_at timestamptz not null default now()
);

create table public.board_invites (
    id uuid primary key default gen_random_uuid(),
    board_id uuid not null references public.boards(id) on delete cascade,
    email text not null,
    role text not null check (role in ('editor', 'viewer')),
    token text not null unique default replace(gen_random_uuid()::text, '-', ''),
    invited_by uuid not null references public.profiles(id),
    expires_at timestamptz not null default now() + interval '7 days',
    accepted_at timestamptz,
    created_at timestamptz not null default now()
);