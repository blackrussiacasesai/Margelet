-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  username text unique,
  phone text,
  avatar_url text,
  about text,
  birthday date,
  glow_color text default 'gradient',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages_app (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  participants text[] not null,
  sender_email text not null,
  body text not null,
  sent_at bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages(conversation_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_conversations_updated_at on public.conversations;
create trigger trg_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.messages_app enable row level security;

-- profiles policies
create policy if not exists "profiles_select_own_or_public"
on public.profiles
for select
using (true);

create policy if not exists "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- conversations policies
create policy if not exists "conversations_select_participant"
on public.conversations
for select
using (
  exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = conversations.id
      and cp.user_id = auth.uid()
  )
);

create policy if not exists "conversations_insert_authenticated"
on public.conversations
for insert
with check (auth.uid() is not null);

-- participants policies
create policy if not exists "participants_select_own"
on public.conversation_participants
for select
using (user_id = auth.uid());

create policy if not exists "participants_insert_authenticated"
on public.conversation_participants
for insert
with check (auth.uid() is not null);

-- messages policies
create policy if not exists "messages_select_participant"
on public.messages
for select
using (
  exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
  )
);

create policy if not exists "messages_insert_sender_participant"
on public.messages
for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
  )
);

-- lightweight chat table policies for current frontend
create policy if not exists "messages_app_select_participant"
on public.messages_app
for select
using ((auth.jwt() ->> 'email') = any(participants));

create policy if not exists "messages_app_insert_sender_participant"
on public.messages_app
for insert
with check (
  (auth.jwt() ->> 'email') = sender_email
  and (auth.jwt() ->> 'email') = any(participants)
);

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.messages_app;
