BEGIN;

DROP FUNCTION public.create_group_conversation(uuid[], uuid);

CREATE FUNCTION public.create_group_conversation(
  invitee_profile_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  conversation_id uuid;
  invitee_count bigint;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  IF invitee_profile_ids IS NULL
     OR pg_catalog.cardinality(invitee_profile_ids) < 2
     OR pg_catalog.array_position(invitee_profile_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'A group conversation requires at least two invitees.'
      USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.count(DISTINCT invitee_id)
  INTO invitee_count
  FROM pg_catalog.unnest(invitee_profile_ids) AS invitees(invitee_id);

  IF invitee_count <> pg_catalog.cardinality(invitee_profile_ids) THEN
    RAISE EXCEPTION 'Group invitees must be unique.'
      USING ERRCODE = '22023';
  END IF;

  IF actor_id = ANY(invitee_profile_ids) THEN
    RAISE EXCEPTION 'The creator must not be included in the invitee list.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(invitee_profile_ids) AS invitees(invitee_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.id = invitees.invitee_id
    )
      OR public.is_blocked_between(actor_id, invitees.invitee_id)
      OR NOT EXISTS (
        SELECT 1
        FROM public.connections AS connection
        WHERE connection.status = 'accepted'
          AND (
            (
              connection.requester_id = actor_id
              AND connection.addressee_id = invitees.invitee_id
            )
            OR (
              connection.requester_id = invitees.invitee_id
              AND connection.addressee_id = actor_id
            )
          )
      )
  ) THEN
    RAISE EXCEPTION 'One or more selected connections are unavailable.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.conversations (created_by, plan_id, conversation_type)
  VALUES (actor_id, NULL, 'group')
  RETURNING id INTO conversation_id;

  INSERT INTO public.conversation_members (conversation_id, profile_id)
  SELECT conversation_id, invitees.invitee_id
  FROM pg_catalog.unnest(invitee_profile_ids) AS invitees(invitee_id)
  UNION ALL
  SELECT conversation_id, actor_id;

  RETURN conversation_id;
END;
$function$;

REVOKE ALL
  ON FUNCTION public.create_group_conversation(uuid[])
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE
  ON FUNCTION public.create_group_conversation(uuid[])
  TO authenticated;

COMMIT;
