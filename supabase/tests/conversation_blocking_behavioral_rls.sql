BEGIN;

DO $fixture_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id IN (
      '00000000-0000-4000-8000-000000000901'::uuid,
      '00000000-0000-4000-8000-000000000902'::uuid,
      '00000000-0000-4000-8000-000000000903'::uuid,
      '00000000-0000-4000-8000-000000000904'::uuid,
      '00000000-0000-4000-8000-000000000905'::uuid
    )
      OR lower(email) IN (
        'winggirl-conversation-user-a@example.invalid',
        'winggirl-conversation-user-b@example.invalid',
        'winggirl-conversation-user-c@example.invalid',
        'winggirl-conversation-user-d@example.invalid',
        'winggirl-conversation-user-e@example.invalid'
      )
  )
     OR EXISTS (
       SELECT 1
       FROM public.plans
       WHERE id = '00000000-0000-4000-8000-000000000911'::uuid
     )
  THEN
    RAISE EXCEPTION
      'Conversation blocking fixture collision: a synthetic user or plan already exists.';
  END IF;
END;
$fixture_guard$;

INSERT INTO auth.users (
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_anonymous
)
VALUES
  (
    '00000000-0000-4000-8000-000000000901',
    'authenticated',
    'authenticated',
    'winggirl-conversation-user-a@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Conversation User A"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000902',
    'authenticated',
    'authenticated',
    'winggirl-conversation-user-b@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Conversation User B"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000903',
    'authenticated',
    'authenticated',
    'winggirl-conversation-user-c@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Conversation User C"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000904',
    'authenticated',
    'authenticated',
    'winggirl-conversation-user-d@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Conversation User D"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000905',
    'authenticated',
    'authenticated',
    'winggirl-conversation-user-e@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Conversation User E"}',
    now(),
    now(),
    false
  );

INSERT INTO public.connections (requester_id, addressee_id, status)
VALUES
  (
    '00000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000902',
    'accepted'
  ),
  (
    '00000000-0000-4000-8000-000000000904',
    '00000000-0000-4000-8000-000000000905',
    'accepted'
  );

INSERT INTO public.plans (
  id,
  host_id,
  title,
  starts_at,
  activity,
  status,
  location_name,
  visibility
)
VALUES (
  '00000000-0000-4000-8000-000000000911',
  '00000000-0000-4000-8000-000000000901',
  'Conversation group plan',
  now() + interval '60 days',
  'Coffee',
  'upcoming',
  'Fixture Cafe',
  'invite_only'
);

INSERT INTO public.plan_members (plan_id, profile_id, status)
VALUES
  (
    '00000000-0000-4000-8000-000000000911',
    '00000000-0000-4000-8000-000000000902',
    'joined'
  ),
  (
    '00000000-0000-4000-8000-000000000911',
    '00000000-0000-4000-8000-000000000903',
    'joined'
  );

CREATE TEMP TABLE fixture_conversations (
  fixture_name text PRIMARY KEY,
  conversation_id uuid NOT NULL
);
GRANT SELECT, INSERT ON fixture_conversations TO authenticated;

WITH group_conversation AS (
  INSERT INTO public.conversations (created_by, plan_id, conversation_type)
  VALUES (
    '00000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000911',
    'group'
  )
  RETURNING id
)
INSERT INTO fixture_conversations (fixture_name, conversation_id)
SELECT 'group_abc', id FROM group_conversation;

INSERT INTO public.conversation_members (conversation_id, profile_id)
SELECT conversation_id, members.profile_id
FROM fixture_conversations
CROSS JOIN (VALUES
  ('00000000-0000-4000-8000-000000000901'::uuid),
  ('00000000-0000-4000-8000-000000000902'::uuid),
  ('00000000-0000-4000-8000-000000000903'::uuid)
) AS members(profile_id)
WHERE fixture_name = 'group_abc';

CREATE FUNCTION pg_temp.try_message_insert(
  target_conversation_id uuid,
  target_sender_id uuid,
  target_body text
)
RETURNS integer
LANGUAGE plpgsql
AS $function$
BEGIN
  BEGIN
    INSERT INTO public.messages (conversation_id, sender_id, body)
    VALUES (target_conversation_id, target_sender_id, target_body);
    RETURN 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN 0;
  END;
END;
$function$;

CREATE FUNCTION pg_temp.try_direct_table_creation(target_profile_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  new_conversation_id uuid;
BEGIN
  BEGIN
    INSERT INTO public.conversations (
      created_by,
      conversation_type,
      direct_recipient_id
    )
    VALUES (auth.uid(), 'direct', target_profile_id)
    RETURNING id INTO new_conversation_id;

    INSERT INTO public.conversation_members (conversation_id, profile_id)
    VALUES
      (new_conversation_id, auth.uid()),
      (new_conversation_id, target_profile_id);
    RETURN 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN 0;
  END;
END;
$function$;

CREATE FUNCTION pg_temp.try_add_conversation_member(
  target_conversation_id uuid,
  target_profile_id uuid
)
RETURNS integer
LANGUAGE plpgsql
AS $function$
BEGIN
  BEGIN
    INSERT INTO public.conversation_members (conversation_id, profile_id)
    VALUES (target_conversation_id, target_profile_id);
    RETURN 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN 0;
  END;
END;
$function$;

CREATE FUNCTION pg_temp.try_create_short_group()
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  constraint_state text;
  new_conversation_id uuid;
BEGIN
  BEGIN
    INSERT INTO public.conversations (created_by, conversation_type)
    VALUES (auth.uid(), 'group')
    RETURNING id INTO new_conversation_id;

    INSERT INTO public.conversation_members (conversation_id, profile_id)
    VALUES (new_conversation_id, auth.uid());

    SET CONSTRAINTS conversations_roster_check, conversation_members_roster_check IMMEDIATE;
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS constraint_state = RETURNED_SQLSTATE;
    RETURN constraint_state;
  END;

  RETURN 'accepted';
END;
$function$;

SELECT plan(68);

SELECT is(
  (SELECT count(*) FROM public.profiles
   WHERE id IN (
     '00000000-0000-4000-8000-000000000901'::uuid,
     '00000000-0000-4000-8000-000000000902'::uuid,
     '00000000-0000-4000-8000-000000000903'::uuid,
     '00000000-0000-4000-8000-000000000904'::uuid,
     '00000000-0000-4000-8000-000000000905'::uuid
   )),
  5::bigint,
  'Auth-user trigger creates all five fixture profiles'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.start_direct_conversation(uuid)',
    'EXECUTE'
  ),
  'Authenticated can execute start_direct_conversation'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.start_direct_conversation(uuid)',
    'EXECUTE'
  ),
  'Anon cannot execute start_direct_conversation'
);
SELECT ok(
  NOT has_function_privilege(
    'service_role',
    'public.start_direct_conversation(uuid)',
    'EXECUTE'
  ),
  'Service role cannot execute start_direct_conversation'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.create_group_conversation(uuid[])',
    'EXECUTE'
  ),
  'Authenticated can execute create_group_conversation'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.create_group_conversation(uuid[])',
    'EXECUTE'
  ),
  'Anon cannot execute create_group_conversation'
);
SELECT ok(
  NOT has_function_privilege(
    'service_role',
    'public.create_group_conversation(uuid[])',
    'EXECUTE'
  ),
  'Service role cannot execute create_group_conversation'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000901';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000901","role":"authenticated","aud":"authenticated"}';

SELECT is(
  public.start_direct_conversation(
    '00000000-0000-4000-8000-000000000902'::uuid
  ),
  public.start_direct_conversation(
    '00000000-0000-4000-8000-000000000902'::uuid
  ),
  'Repeated direct-start requests by User A return the same conversation'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'direct'
     AND created_by IN (
       '00000000-0000-4000-8000-000000000901'::uuid,
       '00000000-0000-4000-8000-000000000902'::uuid
     )
     AND direct_recipient_id IN (
       '00000000-0000-4000-8000-000000000901'::uuid,
       '00000000-0000-4000-8000-000000000902'::uuid
     )),
  1::bigint,
  'Only one direct conversation exists for the A-B pair'
);
SELECT is(
  (SELECT count(*)
   FROM public.conversation_members cm
   JOIN public.conversations c ON c.id = cm.conversation_id
   WHERE c.conversation_type = 'direct'
     AND c.created_by = '00000000-0000-4000-8000-000000000901'::uuid
     AND c.direct_recipient_id = '00000000-0000-4000-8000-000000000902'::uuid),
  2::bigint,
  'Direct conversation starts with exactly its two participants'
);

INSERT INTO pg_temp.fixture_conversations (fixture_name, conversation_id)
SELECT 'direct_ab', id
FROM public.conversations
WHERE conversation_type = 'direct'
  AND created_by = auth.uid()
  AND direct_recipient_id = '00000000-0000-4000-8000-000000000902'::uuid;

INSERT INTO public.messages (conversation_id, sender_id, body)
SELECT c.id, auth.uid(), 'Direct history before blocking'
FROM public.conversations c
WHERE c.conversation_type = 'direct'
  AND c.created_by = auth.uid()
  AND c.direct_recipient_id = '00000000-0000-4000-8000-000000000902'::uuid;

INSERT INTO public.messages (conversation_id, sender_id, body)
SELECT c.id, auth.uid(), 'Group history before blocking'
FROM public.conversations c
WHERE c.conversation_type = 'group'
  AND c.plan_id = '00000000-0000-4000-8000-000000000911'::uuid;

SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

SELECT is(
  (SELECT count(*) FROM public.conversations c
   WHERE c.conversation_type = 'direct'
     AND c.created_by = auth.uid()
     AND c.direct_recipient_id = '00000000-0000-4000-8000-000000000902'::uuid),
  1::bigint,
  'User A can read the existing direct conversation before blocking'
);
SELECT is(
  (SELECT count(*) FROM public.messages m
   JOIN public.conversations c ON c.id = m.conversation_id
   WHERE c.conversation_type = 'direct'
     AND c.created_by = auth.uid()
     AND c.direct_recipient_id = '00000000-0000-4000-8000-000000000902'::uuid),
  1::bigint,
  'User A can read direct conversation history before blocking'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'group'
     AND plan_id = '00000000-0000-4000-8000-000000000911'::uuid),
  1::bigint,
  'User A can read the group conversation'
);
SELECT is(
  (SELECT count(*) FROM public.messages m
   JOIN public.conversations c ON c.id = m.conversation_id
   WHERE c.conversation_type = 'group'
     AND c.plan_id = '00000000-0000-4000-8000-000000000911'::uuid),
  1::bigint,
  'User A can read group history'
);
SELECT is(
  pg_temp.try_direct_table_creation(
    '00000000-0000-4000-8000-000000000903'::uuid
  ),
  0,
  'Direct table writes cannot bypass the direct-conversation RPC'
);
SELECT is(
  pg_temp.try_add_conversation_member(
    (SELECT id FROM public.conversations
     WHERE conversation_type = 'direct'
       AND created_by = auth.uid()
       AND direct_recipient_id = '00000000-0000-4000-8000-000000000902'::uuid),
    '00000000-0000-4000-8000-000000000903'::uuid
  ),
  0,
  'Direct table writes cannot add a third direct-conversation member'
);
SELECT is(
  pg_temp.try_add_conversation_member(
    (SELECT id FROM public.conversations
     WHERE conversation_type = 'group'
       AND plan_id = '00000000-0000-4000-8000-000000000911'::uuid),
    '00000000-0000-4000-8000-000000000904'::uuid
  ),
  0,
  'Group members cannot directly add a nonmember'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000902';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000902","role":"authenticated","aud":"authenticated"}';

SELECT is(
  public.start_direct_conversation(
    '00000000-0000-4000-8000-000000000901'::uuid
  ),
  (SELECT id FROM public.conversations
   WHERE conversation_type = 'direct'
     AND created_by = '00000000-0000-4000-8000-000000000901'::uuid
     AND direct_recipient_id = '00000000-0000-4000-8000-000000000902'::uuid),
  'Reverse-order direct-start request returns the existing conversation'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'direct'
     AND created_by IN (
       '00000000-0000-4000-8000-000000000901'::uuid,
       '00000000-0000-4000-8000-000000000902'::uuid
     )
     AND direct_recipient_id IN (
       '00000000-0000-4000-8000-000000000901'::uuid,
       '00000000-0000-4000-8000-000000000902'::uuid
     )),
  1::bigint,
  'Reverse-order request does not create a duplicate direct conversation'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'direct'
     AND created_by = '00000000-0000-4000-8000-000000000901'::uuid
     AND direct_recipient_id = '00000000-0000-4000-8000-000000000902'::uuid),
  1::bigint,
  'User B can read the existing direct conversation before blocking'
);
SELECT is(
  (SELECT count(*) FROM public.messages m
   JOIN public.conversations c ON c.id = m.conversation_id
   WHERE c.conversation_type = 'direct'
     AND c.created_by = '00000000-0000-4000-8000-000000000901'::uuid
     AND c.direct_recipient_id = auth.uid()),
  1::bigint,
  'User B can read direct conversation history before blocking'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'group'
     AND plan_id = '00000000-0000-4000-8000-000000000911'::uuid),
  1::bigint,
  'User B can read the group conversation'
);
SELECT is(
  (SELECT count(*) FROM public.messages m
   JOIN public.conversations c ON c.id = m.conversation_id
   WHERE c.conversation_type = 'group'
     AND c.plan_id = '00000000-0000-4000-8000-000000000911'::uuid),
  1::bigint,
  'User B can read group history'
);

RESET ROLE;
INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES (
  '00000000-0000-4000-8000-000000000901',
  '00000000-0000-4000-8000-000000000902'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000901';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000901","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'direct'
     AND created_by = auth.uid()
     AND direct_recipient_id = '00000000-0000-4000-8000-000000000902'::uuid),
  0::bigint,
  'Blocker cannot read the existing direct conversation while blocked'
);
SELECT is(
  (SELECT count(*) FROM public.conversation_members cm
   JOIN public.conversations c ON c.id = cm.conversation_id
   WHERE c.conversation_type = 'direct'
     AND c.created_by = auth.uid()),
  0::bigint,
  'Blocker cannot read direct-conversation memberships while blocked'
);
SELECT is(
  (SELECT count(*) FROM public.messages m
   JOIN public.conversations c ON c.id = m.conversation_id
   WHERE c.conversation_type = 'direct'
     AND c.created_by = auth.uid()),
  0::bigint,
  'Blocker cannot read direct messages while blocked'
);
SELECT throws_ok(
  $$SELECT public.start_direct_conversation(
      '00000000-0000-4000-8000-000000000902'::uuid
    )$$,
  '42501',
  'Conversation unavailable.',
  'Blocker cannot start or retrieve a direct conversation while blocked'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'direct_ab'),
    auth.uid(),
    'Blocked direct message from A'
  ),
  0,
  'Blocker cannot send a direct message while blocked'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'group'
     AND plan_id = '00000000-0000-4000-8000-000000000911'::uuid),
  1::bigint,
  'Blocker continues to read the existing group conversation'
);
SELECT is(
  (SELECT count(*) FROM public.messages m
   JOIN public.conversations c ON c.id = m.conversation_id
   WHERE c.conversation_type = 'group'
     AND c.plan_id = '00000000-0000-4000-8000-000000000911'::uuid),
  1::bigint,
  'Blocker continues to read group history'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'group_abc'),
    auth.uid(),
    'Group message from A while blocking B'
  ),
  1,
  'Blocker can continue sending group messages'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000902';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000902","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'direct'
     AND created_by = '00000000-0000-4000-8000-000000000901'::uuid
     AND direct_recipient_id = auth.uid()),
  0::bigint,
  'Blocked user cannot read the existing direct conversation'
);
SELECT is(
  (SELECT count(*) FROM public.messages m
   JOIN public.conversations c ON c.id = m.conversation_id
   WHERE c.conversation_type = 'direct'
     AND c.created_by = '00000000-0000-4000-8000-000000000901'::uuid),
  0::bigint,
  'Blocked user cannot read direct messages'
);
SELECT throws_ok(
  $$SELECT public.start_direct_conversation(
      '00000000-0000-4000-8000-000000000901'::uuid
    )$$,
  '42501',
  'Conversation unavailable.',
  'Blocked user cannot start or retrieve a direct conversation'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'direct_ab'),
    auth.uid(),
    'Blocked direct message from B'
  ),
  0,
  'Blocked user cannot send a direct message'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'group'
     AND plan_id = '00000000-0000-4000-8000-000000000911'::uuid),
  1::bigint,
  'Blocked user retains access to the shared group conversation'
);
SELECT is(
  (SELECT count(*) FROM public.messages m
   JOIN public.conversations c ON c.id = m.conversation_id
   WHERE c.conversation_type = 'group'
     AND c.plan_id = '00000000-0000-4000-8000-000000000911'::uuid),
  2::bigint,
  'Blocked user reads group history including the message sent while blocked'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'group_abc'),
    auth.uid(),
    'Group message from B while blocking A'
  ),
  1,
  'Blocked user can continue sending group messages'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000903';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000903","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'group'
     AND plan_id = '00000000-0000-4000-8000-000000000911'::uuid),
  1::bigint,
  'Unblocked third group member retains access'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'group_abc'),
    auth.uid(),
    'Group message from C while A and B block'
  ),
  1,
  'Unblocked third group member can send group messages'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000904';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000904","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'group'
     AND plan_id = '00000000-0000-4000-8000-000000000911'::uuid),
  0::bigint,
  'Unrelated nonmember cannot read the group conversation'
);
SELECT is(
  (SELECT count(*) FROM public.messages m
   JOIN public.conversations c ON c.id = m.conversation_id
   WHERE c.conversation_type = 'group'
     AND c.plan_id = '00000000-0000-4000-8000-000000000911'::uuid),
  0::bigint,
  'Unrelated nonmember cannot read group messages'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'group_abc'),
    auth.uid(),
    'Unauthorized group message from D'
  ),
  0,
  'Unrelated nonmember cannot send group messages'
);
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000902';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000902","role":"authenticated","aud":"authenticated"}';

DELETE FROM public.blocks
WHERE blocker_id = auth.uid()
  AND blocked_id = '00000000-0000-4000-8000-000000000901'::uuid;

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM public.blocks
   WHERE blocker_id = '00000000-0000-4000-8000-000000000901'::uuid
     AND blocked_id = '00000000-0000-4000-8000-000000000902'::uuid),
  1::bigint,
  'Blocked user cannot remove the block created by User A'
);
SELECT is(
  (SELECT count(*) FROM public.conversation_members cm
   JOIN public.conversations c ON c.id = cm.conversation_id
   WHERE c.conversation_type = 'group'
     AND c.plan_id = '00000000-0000-4000-8000-000000000911'::uuid),
  3::bigint,
  'Blocking preserves all three group memberships'
);
SELECT is(
  (SELECT count(*) FROM public.messages m
   JOIN public.conversations c ON c.id = m.conversation_id
   WHERE c.conversation_type = 'group'
     AND c.plan_id = '00000000-0000-4000-8000-000000000911'::uuid),
  4::bigint,
  'Blocking preserves group history and all three members can send'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000901';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000901","role":"authenticated","aud":"authenticated"}';

DELETE FROM public.blocks
WHERE blocker_id = auth.uid()
  AND blocked_id = '00000000-0000-4000-8000-000000000902'::uuid;

RESET ROLE;
INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES (
  '00000000-0000-4000-8000-000000000902',
  '00000000-0000-4000-8000-000000000901'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000901';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000901","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'direct'
     AND created_by = auth.uid()
     AND direct_recipient_id = '00000000-0000-4000-8000-000000000902'::uuid),
  0::bigint,
  'Direct conversation is inaccessible when User B creates the block'
);
SELECT throws_ok(
  $$SELECT public.start_direct_conversation(
      '00000000-0000-4000-8000-000000000902'::uuid
    )$$,
  '42501',
  'Conversation unavailable.',
  'User A cannot start a direct conversation when User B blocks them'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'direct_ab'),
    auth.uid(),
    'A cannot send while B blocks'
  ),
  0,
  'User A cannot send direct messages when User B blocks them'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'group'
     AND plan_id = '00000000-0000-4000-8000-000000000911'::uuid),
  1::bigint,
  'The group remains accessible when User B blocks User A'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000902';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000902","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'direct'
     AND created_by = '00000000-0000-4000-8000-000000000901'::uuid
     AND direct_recipient_id = auth.uid()),
  0::bigint,
  'User B cannot access the direct conversation they blocked'
);
SELECT throws_ok(
  $$SELECT public.start_direct_conversation(
      '00000000-0000-4000-8000-000000000901'::uuid
    )$$,
  '42501',
  'Conversation unavailable.',
  'User B cannot start a direct conversation while their block exists'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'direct_ab'),
    auth.uid(),
    'B cannot send while B blocks A'
  ),
  0,
  'User B cannot send direct messages when User B creates the block'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'group'
     AND plan_id = '00000000-0000-4000-8000-000000000911'::uuid),
  1::bigint,
  'User B retains group access when User B blocks User A'
);

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM public.blocks
   WHERE blocker_id = '00000000-0000-4000-8000-000000000902'::uuid
     AND blocked_id = '00000000-0000-4000-8000-000000000901'::uuid),
  1::bigint,
  'Only User B can remove the reverse-direction block'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000902';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000902","role":"authenticated","aud":"authenticated"}';

DELETE FROM public.blocks
WHERE blocker_id = auth.uid()
  AND blocked_id = '00000000-0000-4000-8000-000000000901'::uuid;

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000901';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000901","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'direct'
     AND created_by = auth.uid()
     AND direct_recipient_id = '00000000-0000-4000-8000-000000000902'::uuid),
  1::bigint,
  'Unblocking restores direct-conversation access for User A'
);
SELECT is(
  (SELECT count(*) FROM public.messages m
   JOIN public.conversations c ON c.id = m.conversation_id
   WHERE c.conversation_type = 'direct'
     AND c.created_by = auth.uid()
     AND c.direct_recipient_id = '00000000-0000-4000-8000-000000000902'::uuid),
  1::bigint,
  'Unblocking restores access to existing direct history'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'direct_ab'),
    auth.uid(),
    'Direct message after unblock'
  ),
  1,
  'Unblocking restores direct messaging'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000902';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000902","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'direct'
     AND created_by = '00000000-0000-4000-8000-000000000901'::uuid
     AND direct_recipient_id = auth.uid()),
  1::bigint,
  'Unblocking restores direct-conversation access for User B'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000904';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000904","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'direct'
     AND created_by IN (
       '00000000-0000-4000-8000-000000000904'::uuid,
       '00000000-0000-4000-8000-000000000905'::uuid
     )
     AND direct_recipient_id IN (
       '00000000-0000-4000-8000-000000000904'::uuid,
       '00000000-0000-4000-8000-000000000905'::uuid
     )),
  0::bigint,
  'Separate duplicate-request pair begins without a direct conversation'
);
SELECT is(
  public.start_direct_conversation(
    '00000000-0000-4000-8000-000000000905'::uuid
  ),
  public.start_direct_conversation(
    '00000000-0000-4000-8000-000000000905'::uuid
  ),
  'Repeated requests for a separate pair return one conversation'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'direct'
     AND created_by IN (
       '00000000-0000-4000-8000-000000000904'::uuid,
       '00000000-0000-4000-8000-000000000905'::uuid
     )
     AND direct_recipient_id IN (
       '00000000-0000-4000-8000-000000000904'::uuid,
       '00000000-0000-4000-8000-000000000905'::uuid
     )),
  1::bigint,
  'Separate pair has exactly one direct conversation after repeated requests'
);

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM public.connections
   WHERE requester_id = '00000000-0000-4000-8000-000000000901'::uuid
     AND addressee_id = '00000000-0000-4000-8000-000000000902'::uuid
     AND status = 'accepted'),
  1::bigint,
  'Blocking and unblocking preserve the accepted connection record'
);
SELECT is(
  (SELECT count(*) FROM public.conversation_members cm
   JOIN public.conversations c ON c.id = cm.conversation_id
   WHERE c.conversation_type = 'direct'
     AND c.created_by = '00000000-0000-4000-8000-000000000901'::uuid
     AND c.direct_recipient_id = '00000000-0000-4000-8000-000000000902'::uuid),
  2::bigint,
  'Blocking and unblocking preserve both direct memberships'
);
SELECT is(
  (SELECT count(*) FROM public.conversation_members cm
   JOIN public.conversations c ON c.id = cm.conversation_id
   WHERE c.conversation_type = 'group'
     AND c.plan_id = '00000000-0000-4000-8000-000000000911'::uuid),
  3::bigint,
  'Group membership records remain intact after both block directions'
);
SELECT is(
  (SELECT count(*) FROM public.messages m
   JOIN public.conversations c ON c.id = m.conversation_id
   WHERE c.conversation_type = 'group'
     AND c.plan_id = '00000000-0000-4000-8000-000000000911'::uuid),
  4::bigint,
  'Group message history remains intact after both block directions'
);
SELECT is(
  (SELECT count(*) FROM public.messages m
   JOIN public.conversations c ON c.id = m.conversation_id
   WHERE c.conversation_type = 'direct'
     AND c.created_by = '00000000-0000-4000-8000-000000000901'::uuid
     AND c.direct_recipient_id = '00000000-0000-4000-8000-000000000902'::uuid),
  2::bigint,
  'Direct history remains intact and accepts new messages after unblocking'
);
SELECT is(
  (SELECT count(*) FROM public.blocks
   WHERE blocker_id IN (
     '00000000-0000-4000-8000-000000000901'::uuid,
     '00000000-0000-4000-8000-000000000902'::uuid
   )
     AND blocked_id IN (
       '00000000-0000-4000-8000-000000000901'::uuid,
       '00000000-0000-4000-8000-000000000902'::uuid
     )),
  0::bigint,
  'Both block owners can unblock and no block record remains'
);

SELECT * FROM finish();
ROLLBACK;
