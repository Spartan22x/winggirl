BEGIN;

DO $fixture_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id BETWEEN
      '00000000-0000-4000-8000-000000000801'::uuid
      AND '00000000-0000-4000-8000-000000000807'::uuid
      OR lower(email) IN (
        'winggirl-group-create-a@example.invalid',
        'winggirl-group-create-b@example.invalid',
        'winggirl-group-create-c@example.invalid',
        'winggirl-group-create-pending@example.invalid',
        'winggirl-group-create-declined@example.invalid',
        'winggirl-group-create-unconnected@example.invalid',
        'winggirl-group-create-blocked@example.invalid'
      )
  ) THEN
    RAISE EXCEPTION
      'Group creation fixture collision: a synthetic user ID or email already exists.';
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
    '00000000-0000-4000-8000-000000000801',
    'authenticated',
    'authenticated',
    'winggirl-group-create-a@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Group Creator"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000802',
    'authenticated',
    'authenticated',
    'winggirl-group-create-b@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Group Invitee B"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000803',
    'authenticated',
    'authenticated',
    'winggirl-group-create-c@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Group Invitee C"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000804',
    'authenticated',
    'authenticated',
    'winggirl-group-create-pending@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Group Pending"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000805',
    'authenticated',
    'authenticated',
    'winggirl-group-create-declined@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Group Declined"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000806',
    'authenticated',
    'authenticated',
    'winggirl-group-create-unconnected@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Group Unconnected"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000807',
    'authenticated',
    'authenticated',
    'winggirl-group-create-blocked@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Group Blocked"}',
    now(),
    now(),
    false
  );

INSERT INTO public.connections (requester_id, addressee_id, status)
VALUES
  (
    '00000000-0000-4000-8000-000000000801',
    '00000000-0000-4000-8000-000000000802',
    'accepted'
  ),
  (
    '00000000-0000-4000-8000-000000000803',
    '00000000-0000-4000-8000-000000000801',
    'accepted'
  ),
  (
    '00000000-0000-4000-8000-000000000801',
    '00000000-0000-4000-8000-000000000804',
    'pending'
  ),
  (
    '00000000-0000-4000-8000-000000000801',
    '00000000-0000-4000-8000-000000000805',
    'declined'
  ),
  (
    '00000000-0000-4000-8000-000000000801',
    '00000000-0000-4000-8000-000000000807',
    'accepted'
  );

CREATE TEMP TABLE fixture_conversations (
  fixture_name text PRIMARY KEY,
  conversation_id uuid NOT NULL
);
GRANT SELECT, INSERT ON fixture_conversations TO authenticated;

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

CREATE FUNCTION pg_temp.fail_group_membership_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'Forced group membership failure.'
    USING ERRCODE = 'P0001';
END;
$function$;

CREATE FUNCTION pg_temp.try_group_creation(invitee_profile_ids uuid[])
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  error_state text;
  error_message text;
BEGIN
  BEGIN
    PERFORM public.create_group_conversation(invitee_profile_ids);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      error_state = RETURNED_SQLSTATE,
      error_message = MESSAGE_TEXT;
    RETURN error_state || ':' || error_message;
  END;

  RETURN 'success';
END;
$function$;

SELECT plan(33);

SELECT is(
  (SELECT count(*) FROM public.profiles
   WHERE id BETWEEN
     '00000000-0000-4000-8000-000000000801'::uuid
     AND '00000000-0000-4000-8000-000000000807'::uuid),
  7::bigint,
  'Auth-user trigger creates all group creation fixture profiles'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.create_group_conversation(uuid[])',
    'EXECUTE'
  ),
  'Authenticated users can execute the group RPC'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.create_group_conversation(uuid[])',
    'EXECUTE'
  ),
  'Anonymous users cannot execute the group RPC'
);
SELECT ok(
  NOT has_function_privilege(
    'service_role',
    'public.create_group_conversation(uuid[])',
    'EXECUTE'
  ),
  'Service role cannot execute the group RPC'
);
SELECT ok(
  to_regprocedure('public.create_group_conversation(uuid[],uuid)') IS NULL,
  'The former plan-based group RPC signature is removed'
);
SELECT ok(
  (SELECT procedure.prosecdef
   FROM pg_catalog.pg_proc AS procedure
   WHERE procedure.oid = 'public.create_group_conversation(uuid[])'::regprocedure),
  'The group RPC is SECURITY DEFINER'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000801';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000801","role":"authenticated","aud":"authenticated"}';

INSERT INTO fixture_conversations (fixture_name, conversation_id)
VALUES (
  'group_first',
  public.create_group_conversation(ARRAY[
    '00000000-0000-4000-8000-000000000802'::uuid,
    '00000000-0000-4000-8000-000000000803'::uuid
  ])
);

SELECT ok(
  (SELECT conversation_id IS NOT NULL
   FROM fixture_conversations
   WHERE fixture_name = 'group_first'),
  'Two accepted invitees create a group'
);
SELECT is(
  (SELECT created_by
   FROM public.conversations
   WHERE id = (SELECT conversation_id FROM fixture_conversations
               WHERE fixture_name = 'group_first')),
  auth.uid(),
  'The authenticated caller is recorded as group creator'
);
SELECT ok(
  (SELECT conversation_type = 'group' AND plan_id IS NULL
   FROM public.conversations
   WHERE id = (SELECT conversation_id FROM fixture_conversations
               WHERE fixture_name = 'group_first')),
  'The created conversation is a plan-free group'
);
SELECT is(
  (SELECT count(*)
   FROM public.conversation_members
   WHERE conversation_id = (SELECT conversation_id
                            FROM fixture_conversations
                            WHERE fixture_name = 'group_first')
     AND profile_id = auth.uid()),
  1::bigint,
  'The creator is automatically added as a member'
);
SELECT is(
  (SELECT count(*)
   FROM public.conversation_members
   WHERE conversation_id = (SELECT conversation_id
                            FROM fixture_conversations
                            WHERE fixture_name = 'group_first')
     AND profile_id IN (
       '00000000-0000-4000-8000-000000000802'::uuid,
       '00000000-0000-4000-8000-000000000803'::uuid
     )),
  2::bigint,
  'Every selected invitee becomes a member'
);
SELECT is(
  (SELECT count(*)
   FROM public.conversation_members
   WHERE conversation_id = (SELECT conversation_id
                            FROM fixture_conversations
                            WHERE fixture_name = 'group_first')),
  3::bigint,
  'The initial group has exactly three distinct members'
);

INSERT INTO fixture_conversations (fixture_name, conversation_id)
VALUES (
  'group_second',
  public.create_group_conversation(ARRAY[
    '00000000-0000-4000-8000-000000000802'::uuid,
    '00000000-0000-4000-8000-000000000803'::uuid
  ])
);
SELECT ok(
  (SELECT first_group.conversation_id <> second_group.conversation_id
   FROM fixture_conversations AS first_group
   JOIN fixture_conversations AS second_group
     ON first_group.fixture_name = 'group_first'
    AND second_group.fixture_name = 'group_second'),
  'Repeated explicit creation creates a distinct group with the same participants'
);
SELECT is(
  (SELECT count(*)
   FROM public.conversations
   WHERE created_by = auth.uid()
     AND conversation_type = 'group'
     AND plan_id IS NULL),
  2::bigint,
  'Both explicit group creation requests create a conversation'
);

SELECT throws_ok(
  $$SELECT public.create_group_conversation(
      ARRAY['00000000-0000-4000-8000-000000000802'::uuid]
    )$$,
  '22023',
  'A group conversation requires at least two invitees.',
  'Fewer than two invitees are rejected'
);
SELECT throws_ok(
  $$SELECT public.create_group_conversation(NULL::uuid[])$$,
  '22023',
  'A group conversation requires at least two invitees.',
  'A null invitee array is rejected'
);
SELECT throws_ok(
  $$SELECT public.create_group_conversation(
      ARRAY[
        '00000000-0000-4000-8000-000000000802'::uuid,
        '00000000-0000-4000-8000-000000000802'::uuid
      ]
    )$$,
  '22023',
  'Group invitees must be unique.',
  'Duplicate invitees are rejected'
);
SELECT throws_ok(
  $$SELECT public.create_group_conversation(
      ARRAY[
        '00000000-0000-4000-8000-000000000802'::uuid,
        NULL::uuid
      ]
    )$$,
  '22023',
  'A group conversation requires at least two invitees.',
  'Null invitees are rejected'
);
SELECT throws_ok(
  $$SELECT public.create_group_conversation(
      ARRAY[
        '00000000-0000-4000-8000-000000000802'::uuid,
        '00000000-0000-4000-8000-000000000801'::uuid
      ]
    )$$,
  '22023',
  'The creator must not be included in the invitee list.',
  'The creator cannot be included in the invitee list'
);
SELECT throws_ok(
  $$SELECT public.create_group_conversation(
      ARRAY[
        '00000000-0000-4000-8000-000000000802'::uuid,
        '00000000-0000-4000-8000-000000000806'::uuid
      ]
    )$$,
  '42501',
  'One or more selected connections are unavailable.',
  'An unconnected authenticated profile cannot be added'
);
SELECT throws_ok(
  $$SELECT public.create_group_conversation(
      ARRAY[
        '00000000-0000-4000-8000-000000000802'::uuid,
        '00000000-0000-4000-8000-000000000804'::uuid
      ]
    )$$,
  '42501',
  'One or more selected connections are unavailable.',
  'A pending connection cannot be added'
);
SELECT throws_ok(
  $$SELECT public.create_group_conversation(
      ARRAY[
        '00000000-0000-4000-8000-000000000802'::uuid,
        '00000000-0000-4000-8000-000000000805'::uuid
      ]
    )$$,
  '42501',
  'One or more selected connections are unavailable.',
  'A declined connection cannot be added'
);
RESET ROLE;
INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES (
  '00000000-0000-4000-8000-000000000801',
  '00000000-0000-4000-8000-000000000803'
);
INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES (
  '00000000-0000-4000-8000-000000000807',
  '00000000-0000-4000-8000-000000000801'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000801';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000801","role":"authenticated","aud":"authenticated"}';

SELECT throws_ok(
  $$SELECT public.create_group_conversation(
      ARRAY[
        '00000000-0000-4000-8000-000000000802'::uuid,
        '00000000-0000-4000-8000-000000000803'::uuid
      ]
    )$$,
  '42501',
  'One or more selected connections are unavailable.',
  'A creator-initiated block prevents group creation'
);
SELECT throws_ok(
  $$SELECT public.create_group_conversation(
      ARRAY[
        '00000000-0000-4000-8000-000000000802'::uuid,
        '00000000-0000-4000-8000-000000000807'::uuid
      ]
    )$$,
  '42501',
  'One or more selected connections are unavailable.',
  'A block initiated by the invitee prevents group creation'
);
SELECT throws_ok(
  $$SELECT public.create_group_conversation(
      ARRAY[
        '00000000-0000-4000-8000-000000000802'::uuid,
        '00000000-0000-4000-8000-000000000899'::uuid
      ]
    )$$,
  '42501',
  'One or more selected connections are unavailable.',
  'An unknown profile is rejected with a generic eligibility error'
);

CREATE TEMP TABLE group_creation_baseline AS
SELECT
  (SELECT count(*)
   FROM public.conversations
   WHERE created_by = auth.uid()
     AND conversation_type = 'group') AS conversation_count,
  (SELECT count(*)
   FROM public.conversation_members AS member
   JOIN public.conversations AS conversation
     ON conversation.id = member.conversation_id
   WHERE conversation.created_by = auth.uid()
     AND conversation.conversation_type = 'group') AS member_count;

RESET ROLE;
DELETE FROM public.blocks
WHERE (blocker_id = '00000000-0000-4000-8000-000000000801'::uuid
       AND blocked_id = '00000000-0000-4000-8000-000000000803'::uuid)
   OR (blocker_id = '00000000-0000-4000-8000-000000000807'::uuid
       AND blocked_id = '00000000-0000-4000-8000-000000000801'::uuid);
CREATE TRIGGER force_group_membership_failure
BEFORE INSERT ON public.conversation_members
FOR EACH ROW
EXECUTE FUNCTION pg_temp.fail_group_membership_insert();

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000801';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000801","role":"authenticated","aud":"authenticated"}';

SELECT is(
  pg_temp.try_group_creation(ARRAY[
    '00000000-0000-4000-8000-000000000802'::uuid,
    '00000000-0000-4000-8000-000000000803'::uuid
  ]),
  'P0001:Forced group membership failure.',
  'A forced membership failure aborts group creation'
);
SELECT is(
  (SELECT count(*)
   FROM public.conversations
   WHERE created_by = auth.uid()
     AND conversation_type = 'group'),
  (SELECT conversation_count FROM group_creation_baseline),
  'A failed creation leaves no partial conversation'
);
SELECT is(
  (SELECT count(*)
   FROM public.conversation_members AS member
   JOIN public.conversations AS conversation
     ON conversation.id = member.conversation_id
   WHERE conversation.created_by = auth.uid()
     AND conversation.conversation_type = 'group'),
  (SELECT member_count FROM group_creation_baseline),
  'A failed creation leaves no partial memberships'
);

RESET ROLE;
DROP TRIGGER force_group_membership_failure ON public.conversation_members;
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claim.role = 'anon';
SET LOCAL request.jwt.claim.sub = '';
SET LOCAL request.jwt.claims = '{"role":"anon","aud":"anon"}';
SELECT throws_ok(
  $$SELECT public.create_group_conversation(ARRAY[
      '00000000-0000-4000-8000-000000000802'::uuid,
      '00000000-0000-4000-8000-000000000803'::uuid
    ])$$,
  '42501',
  'permission denied for function create_group_conversation',
  'Anonymous execution is denied'
);

RESET ROLE;
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.role = 'service_role';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000801';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000801","role":"service_role","aud":"authenticated"}';
SELECT throws_ok(
  $$SELECT public.create_group_conversation(ARRAY[
      '00000000-0000-4000-8000-000000000802'::uuid,
      '00000000-0000-4000-8000-000000000803'::uuid
    ])$$,
  '42501',
  'permission denied for function create_group_conversation',
  'Service-role execution is denied'
);

RESET ROLE;
INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES (
  '00000000-0000-4000-8000-000000000802',
  '00000000-0000-4000-8000-000000000803'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000802';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000802","role":"authenticated","aud":"authenticated"}';
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM fixture_conversations
     WHERE fixture_name = 'group_first'),
    auth.uid(),
    'Group message after member blocking'
  ),
  1,
  'A group member can message after blocking another group member'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000803';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000803","role":"authenticated","aud":"authenticated"}';
SELECT is(
  (SELECT count(*)
   FROM public.conversations
   WHERE id = (SELECT conversation_id FROM fixture_conversations
               WHERE fixture_name = 'group_first')),
  1::bigint,
  'The other group member retains access after blocking'
);
SELECT is(
  (SELECT count(*)
   FROM public.messages
   WHERE conversation_id = (SELECT conversation_id
                            FROM fixture_conversations
                            WHERE fixture_name = 'group_first')
     AND body = 'Group message after member blocking'),
  1::bigint,
  'The other group member can read group history after blocking'
);

SELECT * FROM finish();
ROLLBACK;
