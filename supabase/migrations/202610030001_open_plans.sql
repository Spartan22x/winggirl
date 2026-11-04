create type public.plan_visibility as enum ('invite_only', 'open');

alter table public.plans
  add column if not exists visibility public.plan_visibility not null default 'invite_only',
  add column if not exists secondary_activity text check (secondary_activity is null or char_length(secondary_activity) between 1 and 80);

update public.plans
set visibility = 'invite_only'
where visibility is null;

create or replace function public.is_open_plan_visible_for_user(target_plan_id uuid, target_profile_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.plans p
    where p.id = target_plan_id
      and p.visibility = 'open'
      and p.host_id <> target_profile_id
      and p.status in ('upcoming', 'invited', 'joined')
      and p.starts_at > now()
      and not public.is_blocked_between(target_profile_id, p.host_id)
      and exists (
        select 1 from public.connections c
        where (
          (c.requester_id = target_profile_id and c.addressee_id = p.host_id)
          or (c.requester_id = p.host_id and c.addressee_id = target_profile_id)
        )
        and c.status = 'accepted'
      )
  );
$$;

drop policy if exists plans_read_member on public.plans;
create policy plans_read_member on public.plans for select to authenticated
  using (
    (public.is_plan_member(id) and not public.is_blocked_between(auth.uid(), host_id))
    or public.is_open_plan_visible_for_user(id, auth.uid())
  );

drop policy if exists plan_members_create_host_or_self on public.plan_members;
drop policy if exists plan_members_create_host_only on public.plan_members;
create policy plan_members_create_host_only on public.plan_members for insert to authenticated
  with check (
    profile_id <> auth.uid()
    and status = 'invited'
    and exists (
      select 1 from public.plans p
      where p.id = plan_id
        and p.host_id = auth.uid()
        and p.visibility = 'invite_only'
        and p.status in ('upcoming', 'invited', 'joined')
        and p.starts_at > now()
    )
  );

create policy plan_members_join_open_plan on public.plan_members for insert to authenticated
  with check (
    profile_id = auth.uid()
    and status = 'joined'
    and exists (
      select 1 from public.plans p
      where p.id = plan_id
        and p.host_id <> auth.uid()
        and p.visibility = 'open'
        and p.status in ('upcoming', 'invited', 'joined')
        and p.starts_at > now()
        and not public.is_blocked_between(auth.uid(), p.host_id)
        and exists (
          select 1 from public.connections c
          where (
            (c.requester_id = auth.uid() and c.addressee_id = p.host_id)
            or (c.requester_id = p.host_id and c.addressee_id = auth.uid())
          )
          and c.status = 'accepted'
        )
    )
  );

drop policy if exists plan_members_accept_invitation_or_host_update on public.plan_members;
create policy plan_members_accept_invitation_or_host_update on public.plan_members for update to authenticated
  using (
    exists (select 1 from public.plans p where p.id = plan_id and p.host_id = auth.uid())
    or (
      profile_id = auth.uid()
      and status = 'invited'
      and exists (
        select 1 from public.plans p
        where p.id = plan_id
          and p.host_id <> auth.uid()
          and p.status in ('upcoming', 'joined', 'invited')
          and p.starts_at > now()
      )
    )
  )
  with check (
    exists (select 1 from public.plans p where p.id = plan_id and p.host_id = auth.uid())
    or (
      profile_id = auth.uid()
      and status = 'joined'
      and exists (
        select 1 from public.plans p
        where p.id = plan_id
          and p.host_id <> auth.uid()
          and p.status in ('upcoming', 'joined', 'invited')
          and p.starts_at > now()
      )
    )
  );

drop policy if exists plan_members_delete_host_or_self on public.plan_members;
drop policy if exists plan_members_delete_host_or_joined_self on public.plan_members;
create policy plan_members_delete_host_or_joined_self on public.plan_members for delete to authenticated
  using (
    exists (select 1 from public.plans p where p.id = plan_id and p.host_id = auth.uid())
    or (
      profile_id = auth.uid()
      and status = 'joined'
      and exists (
        select 1 from public.plans p
        where p.id = plan_id
          and p.host_id <> auth.uid()
          and p.status in ('upcoming', 'joined', 'invited')
          and p.starts_at > now()
      )
    )
  );
