BEGIN;

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.connections AS connection
    WHERE connection.status = 'accepted'
      AND (
        (
          connection.requester_id = actor_id
          AND connection.addressee_id = target_profile_id
        )
        OR (
          connection.requester_id = target_profile_id
          AND connection.addressee_id = actor_id
        )
      )
  ) THEN
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

DROP POLICY conversations_read_member ON public.conversations;
CREATE POLICY conversations_read_member
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    public.is_conversation_member(id)
    AND (
      conversation_type = 'group'
      OR (
        NOT public.is_blocked_between(created_by, direct_recipient_id)
        AND EXISTS (
          SELECT 1
          FROM public.connections AS connection
          WHERE connection.status = 'accepted'
            AND (
              (
                connection.requester_id = created_by
                AND connection.addressee_id = direct_recipient_id
              )
              OR (
                connection.requester_id = direct_recipient_id
                AND connection.addressee_id = created_by
              )
            )
        )
      )
    )
  );

DROP POLICY conversation_members_read_member
  ON public.conversation_members;
CREATE POLICY conversation_members_read_member
  ON public.conversation_members
  FOR SELECT
  TO authenticated
  USING (
    public.is_conversation_member(conversation_id)
    AND EXISTS (
      SELECT 1
      FROM public.conversations AS conversation
      WHERE conversation.id = conversation_id
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
      FROM public.conversations AS conversation
      WHERE conversation.id = conversation_id
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
      FROM public.conversations AS conversation
      WHERE conversation.id = conversation_id
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
    )
  );

COMMIT;
