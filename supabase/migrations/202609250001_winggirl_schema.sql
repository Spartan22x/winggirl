create extension if not exists pgcrypto;

create type public.interest_kind as enum ('interest', 'activity');
create type public.connection_status as enum ('pending', 'accepted', 'declined');
create type public.plan_status as enum ('upcoming', 'invited', 'past', 'joined');
create type public.plan_member_status as enum ('invited', 'joined', 'declined');
create type public.report_status as enum ('open', 'reviewed', 'closed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 80),
  age smallint check (age is null or age between 18 and 120),
  bio text check (bio is null or char_length(bio) <= 1000),
  avatar_color text not null default '#172535' check (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interests (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  kind public.interest_kind not null default 'interest',
  created_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  area text not null,
  vibe text not null,
  note text not null,
  created_at timestamptz not null default now()
);

create table public.profile_interests (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  interest_id uuid not null references public.interests(id) on delete cascade,
  primary key (profile_id, interest_id)
);

create table public.availability (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  available_date date not null default current_date,
  is_available boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (profile_id, available_date)
);

create table public.connections (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status public.connection_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  starts_at timestamptz not null,
  activity text not null check (char_length(activity) between 1 and 80),
  status public.plan_status not null default 'upcoming',
  location_name text not null check (char_length(location_name) between 1 and 160),
  location_area text,
  location_vibe text,
  location_note text,
  note text,
  created_at timestamptz not null default now()
);

create table public.plan_members (
  plan_id uuid not null references public.plans(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status public.plan_member_status not null default 'invited',
  created_at timestamptz not null default now(),
  primary key (plan_id, profile_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_profile_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 120),
  details text check (details is null or char_length(details) <= 4000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_profile_id)
);

create index profile_interests_interest_id_idx on public.profile_interests (interest_id);
create index availability_date_available_idx on public.availability (available_date, is_available);
create index connections_addressee_status_idx on public.connections (addressee_id, status);
create index plans_host_id_starts_at_idx on public.plans (host_id, starts_at);
create index plan_members_profile_id_idx on public.plan_members (profile_id);
create index conversation_members_profile_id_idx on public.conversation_members (profile_id);
create index messages_conversation_id_created_at_idx on public.messages (conversation_id, created_at);
create index blocks_blocked_id_idx on public.blocks (blocked_id);
create index reports_reported_profile_id_idx on public.reports (reported_profile_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger availability_set_updated_at before update on public.availability for each row execute function public.set_updated_at();
create trigger connections_set_updated_at before update on public.connections for each row execute function public.set_updated_at();

create or replace function public.is_blocked_between(first_id uuid, second_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = first_id and blocked_id = second_id)
       or (blocker_id = second_id and blocked_id = first_id)
  );
$$;

create or replace function public.is_plan_member(target_plan_id uuid, target_profile_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.plans p where p.id = target_plan_id and p.host_id = target_profile_id
  ) or exists (
    select 1 from public.plan_members pm where pm.plan_id = target_plan_id and pm.profile_id = target_profile_id and pm.status <> 'declined'
  );
$$;

create or replace function public.is_conversation_member(target_conversation_id uuid, target_profile_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_members cm where cm.conversation_id = target_conversation_id and cm.profile_id = target_profile_id
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'first_name', 'Wing'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.interests enable row level security;
alter table public.locations enable row level security;
alter table public.profile_interests enable row level security;
alter table public.availability enable row level security;
alter table public.connections enable row level security;
alter table public.plans enable row level security;
alter table public.plan_members enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create policy profiles_read_allowed on public.profiles for select to authenticated
  using (id = auth.uid() or not public.is_blocked_between(auth.uid(), id));
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id = auth.uid());

create policy interests_read_authenticated on public.interests for select to authenticated using (true);
create policy locations_read_authenticated on public.locations for select to authenticated using (true);
create policy profile_interests_read_allowed on public.profile_interests for select to authenticated
  using (profile_id = auth.uid() or not public.is_blocked_between(auth.uid(), profile_id));
create policy profile_interests_manage_self on public.profile_interests for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy availability_read_allowed on public.availability for select to authenticated
  using (profile_id = auth.uid() or (is_available and not public.is_blocked_between(auth.uid(), profile_id)));
create policy availability_manage_self on public.availability for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy connections_read_own on public.connections for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy connections_create_self on public.connections for insert to authenticated
  with check (requester_id = auth.uid() and not public.is_blocked_between(auth.uid(), addressee_id));
create policy connections_update_participant on public.connections for update to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());
create policy connections_delete_participant on public.connections for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy plans_read_member on public.plans for select to authenticated
  using (public.is_plan_member(id) and not public.is_blocked_between(auth.uid(), host_id));
create policy plans_create_self on public.plans for insert to authenticated with check (host_id = auth.uid());
create policy plans_update_host on public.plans for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy plans_delete_host on public.plans for delete to authenticated using (host_id = auth.uid());

create policy plan_members_read_member on public.plan_members for select to authenticated
  using (public.is_plan_member(plan_id));
create policy plan_members_create_host_or_self on public.plan_members for insert to authenticated
  with check (profile_id = auth.uid() or exists (select 1 from public.plans where id = plan_id and host_id = auth.uid()));
create policy plan_members_update_member on public.plan_members for update to authenticated
  using (profile_id = auth.uid() or exists (select 1 from public.plans where id = plan_id and host_id = auth.uid()))
  with check (profile_id = auth.uid() or exists (select 1 from public.plans where id = plan_id and host_id = auth.uid()));
create policy plan_members_delete_host_or_self on public.plan_members for delete to authenticated
  using (profile_id = auth.uid() or exists (select 1 from public.plans where id = plan_id and host_id = auth.uid()));

create policy conversations_read_member on public.conversations for select to authenticated using (public.is_conversation_member(id));
create policy conversations_create_self on public.conversations for insert to authenticated with check (created_by = auth.uid());
create policy conversation_members_read_member on public.conversation_members for select to authenticated using (public.is_conversation_member(conversation_id));
create policy conversation_members_join_authorized on public.conversation_members for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.created_by = auth.uid() or (c.plan_id is not null and public.is_plan_member(c.plan_id)))
    )
  );
create policy conversation_members_leave_self on public.conversation_members for delete to authenticated using (profile_id = auth.uid());

create policy messages_read_member on public.messages for select to authenticated using (public.is_conversation_member(conversation_id));
create policy messages_send_member on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));

create policy blocks_read_own on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy blocks_create_self on public.blocks for insert to authenticated with check (blocker_id = auth.uid() and blocked_id <> auth.uid());
create policy blocks_delete_self on public.blocks for delete to authenticated using (blocker_id = auth.uid());

create policy reports_create_self on public.reports for insert to authenticated with check (reporter_id = auth.uid() and reporter_id <> reported_profile_id);
create policy reports_read_own on public.reports for select to authenticated using (reporter_id = auth.uid());

insert into public.interests (name, kind) values
  ('Dinner', 'activity'), ('Drinks', 'activity'), ('Coffee', 'activity'), ('Fitness', 'activity'),
  ('Walk', 'activity'), ('Live music', 'activity'), ('Shopping', 'activity'), ('Something spontaneous', 'activity'),
  ('Museums', 'interest'), ('Books', 'interest'), ('Brunch', 'interest'), ('Yoga', 'interest'),
  ('Art', 'interest'), ('Wellness', 'interest'), ('Pilates', 'interest'), ('Dining', 'interest')
on conflict (name) do nothing;

insert into public.locations (name, area, vibe, note) values
  ('Rosewood Café', 'Downtown', 'Warm, low-key', 'Great for coffee or a quick catch-up'),
  ('Marlow Wine Bar', 'The Village', 'Lively but relaxed', 'Easy for a first plan'),
  ('Luna Park Trail', 'Riverside', 'Open and breezy', 'Perfect for a walk plus coffee'),
  ('Sora Kitchen', 'Old Town', 'Cozy and social', 'A go-to dinner spot'),
  ('Cinder & Co.', 'Arts District', 'Creative and buzzing', 'Good for live music and friends')
on conflict (name) do nothing;