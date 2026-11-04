BEGIN;

CREATE OR REPLACE FUNCTION public.is_blocked_between(
  first_id uuid,
  second_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (
       auth.uid() IS NULL
       OR (
         auth.uid() IS DISTINCT FROM first_id
         AND auth.uid() IS DISTINCT FROM second_id
       )
     ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.blocks AS block
    WHERE (block.blocker_id = first_id AND block.blocked_id = second_id)
       OR (block.blocker_id = second_id AND block.blocked_id = first_id)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_plan_member(
  target_plan_id uuid,
  target_profile_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (
       auth.uid() IS NULL
       OR target_profile_id IS DISTINCT FROM auth.uid()
     ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.plans AS plan
    WHERE plan.id = target_plan_id
      AND plan.host_id = target_profile_id
  ) OR EXISTS (
    SELECT 1
    FROM public.plan_members AS member
    WHERE member.plan_id = target_plan_id
      AND member.profile_id = target_profile_id
      AND member.status <> 'declined'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_conversation_member(
  target_conversation_id uuid,
  target_profile_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (
       auth.uid() IS NULL
       OR target_profile_id IS DISTINCT FROM auth.uid()
     ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.conversation_members AS member
    JOIN public.conversations AS conversation
      ON conversation.id = member.conversation_id
    WHERE member.conversation_id = target_conversation_id
      AND member.profile_id = target_profile_id
      AND (
        conversation.conversation_type = 'group'
        OR (
          NOT public.is_blocked_between(
            conversation.created_by,
            conversation.direct_recipient_id
          )
          AND EXISTS (
            SELECT 1
            FROM public.connections AS connection
            WHERE connection.status = 'accepted'
              AND (
                (
                  connection.requester_id = conversation.created_by
                  AND connection.addressee_id =
                    conversation.direct_recipient_id
                )
                OR (
                  connection.requester_id =
                    conversation.direct_recipient_id
                  AND connection.addressee_id = conversation.created_by
                )
              )
          )
        )
      )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_open_plan_visible_for_user(
  target_plan_id uuid,
  target_profile_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (
       auth.uid() IS NULL
       OR target_profile_id IS DISTINCT FROM auth.uid()
     ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.plans AS plan
    WHERE plan.id = target_plan_id
      AND plan.visibility = 'open'
      AND plan.host_id <> target_profile_id
      AND plan.status IN ('upcoming', 'invited', 'joined')
      AND plan.starts_at > now()
      AND NOT public.is_blocked_between(target_profile_id, plan.host_id)
      AND EXISTS (
        SELECT 1
        FROM public.connections AS connection
        WHERE (
          (
            connection.requester_id = target_profile_id
            AND connection.addressee_id = plan.host_id
          )
          OR (
            connection.requester_id = plan.host_id
            AND connection.addressee_id = target_profile_id
          )
        )
          AND connection.status = 'accepted'
      )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_group_conversation(
  member_profile_ids uuid[],
  target_plan_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  conversation_id uuid;
  profile_count bigint;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  IF member_profile_ids IS NULL
     OR pg_catalog.cardinality(member_profile_ids) < 3
     OR pg_catalog.array_position(member_profile_ids, NULL) IS NOT NULL
     OR NOT actor_id = ANY(member_profile_ids)
     OR target_plan_id IS NULL THEN
    RAISE EXCEPTION
      'A group conversation requires at least three distinct plan members including the caller.'
      USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.count(DISTINCT member_id)
  INTO profile_count
  FROM pg_catalog.unnest(member_profile_ids) AS members(member_id);

  IF profile_count <> pg_catalog.cardinality(member_profile_ids) THEN
    RAISE EXCEPTION 'Group conversation members must be unique.'
      USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.count(*)
  INTO profile_count
  FROM public.profiles AS profile
  WHERE profile.id = ANY(member_profile_ids);

  IF profile_count <> pg_catalog.cardinality(member_profile_ids) THEN
    RAISE EXCEPTION 'A group conversation participant does not exist.'
      USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(member_profile_ids) AS members(member_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.plans AS plan
      WHERE plan.id = target_plan_id
        AND plan.host_id = members.member_id
    )
      AND NOT EXISTS (
        SELECT 1
        FROM public.plan_members AS member
        WHERE member.plan_id = target_plan_id
          AND member.profile_id = members.member_id
          AND member.status <> 'declined'
      )
  ) THEN
    RAISE EXCEPTION 'Group conversation participants must belong to the plan.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.conversations (created_by, plan_id, conversation_type)
  VALUES (actor_id, target_plan_id, 'group')
  RETURNING id INTO conversation_id;

  INSERT INTO public.conversation_members (conversation_id, profile_id)
  SELECT conversation_id, members.member_id
  FROM pg_catalog.unnest(member_profile_ids) AS members(member_id);

  RETURN conversation_id;
END;
$function$;

REVOKE ALL
  ON FUNCTION public.is_blocked_between(uuid, uuid),
              public.is_plan_member(uuid, uuid),
              public.is_conversation_member(uuid, uuid),
              public.is_open_plan_visible_for_user(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE
  ON FUNCTION public.is_blocked_between(uuid, uuid),
              public.is_plan_member(uuid, uuid),
              public.is_conversation_member(uuid, uuid),
              public.is_open_plan_visible_for_user(uuid, uuid)
  TO authenticated, service_role;

REVOKE ALL
  ON FUNCTION public.create_group_conversation(uuid[], uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE
  ON FUNCTION public.create_group_conversation(uuid[], uuid)
  TO authenticated;

COMMIT;
