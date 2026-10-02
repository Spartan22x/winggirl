alter type public.plan_status add value if not exists 'cancelled';

create or replace function public.prevent_plan_member_identity_change()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.plan_id is distinct from old.plan_id or new.profile_id is distinct from old.profile_id then
    raise exception 'Plan membership identity cannot be changed';
  end if;
  return new;
end;
$$;

create trigger plan_members_identity_immutable
before update on public.plan_members
for each row execute function public.prevent_plan_member_identity_change();

drop policy plan_members_create_host_or_self on public.plan_members;
create policy plan_members_create_host_only on public.plan_members for insert to authenticated
  with check (profile_id <> auth.uid() and status = 'invited' and exists (
    select 1 from public.plans p
    where p.id = plan_id
      and p.host_id = auth.uid()
      and p.status in ('upcoming', 'invited', 'joined')
      and p.starts_at > now()
  ));

drop policy plan_members_update_member on public.plan_members;
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

drop policy plan_members_delete_host_or_self on public.plan_members;
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
