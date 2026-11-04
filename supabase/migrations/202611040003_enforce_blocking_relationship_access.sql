BEGIN;

CREATE TYPE public.conversation_type AS ENUM ('direct', 'group');

ALTER TABLE public.conversations
  ADD COLUMN conversation_type public.conversation_type NOT NULL DEFAULT 'group',
  ADD COLUMN direct_recipient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT conversations_type_recipient_check CHECK (
    (conversation_type = 'group' AND direct_recipient_id IS NULL)
    OR (
      conversation_type = 'direct'
      AND direct_recipient_id IS NOT NULL
      AND direct_recipient_id <> created_by
    )
  );

CREATE UNIQUE INDEX conversations_direct_pair_uidx
  ON public.conversations (
    LEAST(created_by, direct_recipient_id),
    GREATEST(created_by, direct_recipient_id)
  )
  WHERE conversation_type = 'direct';

CREATE OR REPLACE FUNCTION public.enforce_conversation_roster()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  target_conversation_ids uuid[];
  target_conversation_id uuid;
  target_type public.conversation_type;
  target_creator uuid;
  target_recipient uuid;
  member_count bigint;
  participant_member_count bigint;
BEGIN
  IF TG_TABLE_NAME = 'conversations' THEN
    target_conversation_ids := ARRAY[NEW.id];
  ELSIF TG_OP = 'INSERT' THEN
    target_conversation_ids := ARRAY[NEW.conversation_id];
  ELSIF TG_OP = 'DELETE' THEN
    target_conversation_ids := ARRAY[OLD.conversation_id];
  ELSE
    target_conversation_ids := ARRAY[OLD.conversation_id, NEW.conversation_id];
  END IF;

  FOREACH target_conversation_id IN ARRAY target_conversation_ids LOOP
    SELECT c.conversation_type, c.created_by, c.direct_recipient_id
    INTO target_type, target_creator, target_recipient
    FROM public.conversations AS c
    WHERE c.id = target_conversation_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    SELECT
      pg_catalog.count(*),
      pg_catalog.count(*) FILTER (
        WHERE cm.profile_id IN (target_creator, target_recipient)
      )
    INTO member_count, participant_member_count
    FROM public.conversation_members AS cm
    WHERE cm.conversation_id = target_conversation_id;

    IF target_type = 'direct' THEN
      IF member_count <> 2 OR participant_member_count <> 2 THEN
        RAISE EXCEPTION
          'A direct conversation must have exactly its two designated participants.'
          USING ERRCODE = '23514';
      END IF;
    ELSIF member_count < 3 THEN
      RAISE EXCEPTION
        'A group conversation must have at least three members.'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  RETURN NULL;
END;
$function$;

REVOKE ALL
  ON FUNCTION public.enforce_conversation_roster()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE CONSTRAINT TRIGGER conversations_roster_check
AFTER INSERT OR UPDATE ON public.conversations
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_conversation_roster();

CREATE CONSTRAINT TRIGGER conversation_members_roster_check
AFTER INSERT OR UPDATE OR DELETE ON public.conversation_members
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.enforce_conversation_roster();

DROP POLICY connections_read_own ON public.connections;
CREATE POLICY connections_read_own
  ON public.connections
  FOR SELECT
  TO authenticated
  USING (
    (requester_id = auth.uid() OR addressee_id = auth.uid())
    AND NOT public.is_blocked_between(auth.uid(), requester_id)
    AND NOT public.is_blocked_between(auth.uid(), addressee_id)
  );

DROP POLICY plan_members_create_host_only ON public.plan_members;
CREATE POLICY plan_members_create_host_only
  ON public.plan_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id <> auth.uid()
    AND status = 'invited'
    AND NOT public.is_blocked_between(auth.uid(), profile_id)
    AND EXISTS (
      SELECT 1
      FROM public.plans AS p
      WHERE p.id = plan_id
        AND p.host_id = auth.uid()
        AND p.visibility = 'invite_only'
        AND p.status IN ('upcoming', 'invited', 'joined')
        AND p.starts_at > now()
    )
  );

CREATE OR REPLACE FUNCTION public.start_direct_conversation(target_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  pair_lock_key text;
  conversation_id uuid;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  IF target_profile_id IS NULL OR target_profile_id = actor_id THEN
    RAISE EXCEPTION 'A direct conversation must target another profile.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = target_profile_id
  ) THEN
    RAISE EXCEPTION 'Target profile does not exist.'
      USING ERRCODE = 'P0002';
  END IF;

  IF public.is_blocked_between(actor_id, target_profile_id) THEN
    RAISE EXCEPTION 'Conversation unavailable.'
      USING ERRCODE = '42501';
  END IF;

  pair_lock_key :=
    LEAST(actor_id, target_profile_id)::text
    || ':'
    || GREATEST(actor_id, target_profile_id)::text;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pair_lock_key, 0)
  );

  SELECT c.id
  INTO conversation_id
  FROM public.conversations AS c
  WHERE c.conversation_type = 'direct'
    AND (
      (c.created_by = actor_id AND c.direct_recipient_id = target_profile_id)
      OR (c.created_by = target_profile_id AND c.direct_recipient_id = actor_id)
    )
  FOR UPDATE;

  IF FOUND THEN
    RETURN conversation_id;
  END IF;

  INSERT INTO public.conversations (
    created_by,
    direct_recipient_id,
    conversation_type
  )
  VALUES (
    actor_id,
    target_profile_id,
    'direct'
  )
  RETURNING id INTO conversation_id;

  INSERT INTO public.conversation_members (conversation_id, profile_id)
  VALUES
    (conversation_id, actor_id),
    (conversation_id, target_profile_id);

  RETURN conversation_id;
END;
$function$;

REVOKE ALL
  ON FUNCTION public.start_direct_conversation(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE
  ON FUNCTION public.start_direct_conversation(uuid)
  TO authenticated;

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
  FROM public.profiles AS p
  WHERE p.id = ANY(member_profile_ids);

  IF profile_count <> pg_catalog.cardinality(member_profile_ids) THEN
    RAISE EXCEPTION 'A group conversation participant does not exist.'
      USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(member_profile_ids) AS members(member_id)
    WHERE NOT public.is_plan_member(target_plan_id, members.member_id)
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
  ON FUNCTION public.create_group_conversation(uuid[], uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE
  ON FUNCTION public.create_group_conversation(uuid[], uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.is_group_conversation_join_authorized(
  target_conversation_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations AS c
    WHERE c.id = target_conversation_id
      AND c.conversation_type = 'group'
      AND (
        c.created_by = auth.uid()
        OR (
          c.plan_id IS NOT NULL
          AND public.is_plan_member(c.plan_id)
        )
      )
  );
$function$;

REVOKE ALL
  ON FUNCTION public.is_group_conversation_join_authorized(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE
  ON FUNCTION public.is_group_conversation_join_authorized(uuid)
  TO authenticated;

DROP POLICY conversations_create_self ON public.conversations;
CREATE POLICY conversations_create_self
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND conversation_type = 'group'
  );

DROP POLICY conversation_members_join_authorized ON public.conversation_members;
CREATE POLICY conversation_members_join_authorized
  ON public.conversation_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND public.is_group_conversation_join_authorized(conversation_id)
  );

DROP POLICY conversation_members_leave_self ON public.conversation_members;
CREATE POLICY conversation_members_leave_self
  ON public.conversation_members
  FOR DELETE
  TO authenticated
  USING (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversations AS c
      WHERE c.id = conversation_id
        AND c.conversation_type = 'group'
    )
  );

DROP POLICY conversations_read_member ON public.conversations;
CREATE POLICY conversations_read_member
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    public.is_conversation_member(id)
    AND (
      conversation_type = 'group'
      OR NOT public.is_blocked_between(created_by, direct_recipient_id)
    )
  );

DROP POLICY conversation_members_read_member ON public.conversation_members;
CREATE POLICY conversation_members_read_member
  ON public.conversation_members
  FOR SELECT
  TO authenticated
  USING (
    public.is_conversation_member(conversation_id)
    AND EXISTS (
      SELECT 1
      FROM public.conversations AS c
      WHERE c.id = conversation_id
        AND (
          c.conversation_type = 'group'
          OR NOT public.is_blocked_between(c.created_by, c.direct_recipient_id)
        )
    )
  );

DROP POLICY messages_read_member ON public.messages;
CREATE POLICY messages_read_member
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    public.is_conversation_member(conversation_id)
    AND EXISTS (
      SELECT 1
      FROM public.conversations AS c
      WHERE c.id = conversation_id
        AND (
          c.conversation_type = 'group'
          OR NOT public.is_blocked_between(c.created_by, c.direct_recipient_id)
        )
    )
  );

DROP POLICY messages_send_member ON public.messages;
CREATE POLICY messages_send_member
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_member(conversation_id)
    AND EXISTS (
      SELECT 1
      FROM public.conversations AS c
      WHERE c.id = conversation_id
        AND (
          c.conversation_type = 'group'
          OR NOT public.is_blocked_between(c.created_by, c.direct_recipient_id)
        )
    )
  );

COMMIT;
