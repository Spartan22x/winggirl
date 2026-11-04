BEGIN;

DO $fixture_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id BETWEEN
      '00000000-0000-4000-8000-000000000701'::uuid
      AND '00000000-0000-4000-8000-000000000706'::uuid
      OR lower(email) IN (
        'winggirl-helper-a@example.invalid',
        'winggirl-helper-b@example.invalid',
        'winggirl-helper-c@example.invalid',
        'winggirl-helper-d@example.invalid',
        'winggirl-helper-e@example.invalid',
        'winggirl-helper-f@example.invalid'
      )
  )
     OR EXISTS (
       SELECT 1
       FROM public.plans
       WHERE id = '00000000-0000-4000-8000-000000000711'::uuid
     )
  THEN
    RAISE EXCEPTION
      'Messaging helper fixture collision: a synthetic user or plan already exists.';
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
    '00000000-0000-4000-8000-000000000701',
    'authenticated',
    'authenticated',
    'winggirl-helper-a@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Helper A"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000702',
    'authenticated',
    'authenticated',
    'winggirl-helper-b@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Helper B"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000703',
    'authenticated',
    'authenticated',
    'winggirl-helper-c@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Helper C"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000704',
    'authenticated',
    'authenticated',
    'winggirl-helper-d@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Helper D"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000705',
    'authenticated',
    'authenticated',
    'winggirl-helper-e@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Helper E"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000706',
    'authenticated',
    'authenticated',
    'winggirl-helper-f@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Helper F"}',
    now(),
    now(),
    false
  );

INSERT INTO public.connections (requester_id, addressee_id, status)
VALUES (
  '00000000-0000-4000-8000-000000000701',
  '00000000-0000-4000-8000-000000000702',
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
  '00000000-0000-4000-8000-000000000711',
  '00000000-0000-4000-8000-000000000701',
  'Helper security plan',
  now() + interval '30 days',
  'Coffee',
  'upcoming',
  'Fixture Cafe',
  'open'
);

INSERT INTO public.plan_members (plan_id, profile_id, status)
VALUES
  (
    '00000000-0000-4000-8000-000000000711',
    '00000000-0000-4000-8000-000000000702',
    'joined'
  ),
  (
    '00000000-0000-4000-8000-000000000711',
    '00000000-0000-4000-8000-000000000703',
    'invited'
  );

INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES (
  '00000000-0000-4000-8000-000000000705',
  '00000000-0000-4000-8000-000000000706'
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

SELECT plan(38);

SELECT is(
  (SELECT count(*) FROM public.profiles
   WHERE id BETWEEN
     '00000000-0000-4000-8000-000000000701'::uuid
     AND '00000000-0000-4000-8000-000000000706'::uuid),
  6::bigint,
  'The auth trigger creates all six helper security fixture profiles'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.is_blocked_between(uuid,uuid)',
    'EXECUTE'
  )
  AND has_function_privilege(
    'authenticated',
    'public.is_conversation_member(uuid,uuid)',
    'EXECUTE'
  )
  AND has_function_privilege(
    'authenticated',
    'public.is_plan_member(uuid,uuid)',
    'EXECUTE'
  ),
  'Authenticated retains helper execution required by RLS policies'
);
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.is_blocked_between(uuid,uuid)',
    'EXECUTE'
  )
  AND has_function_privilege(
    'service_role',
    'public.is_conversation_member(uuid,uuid)',
    'EXECUTE'
  )
  AND has_function_privilege(
    'service_role',
    'public.is_plan_member(uuid,uuid)',
    'EXECUTE'
  ),
  'Service role retains helper execution'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.is_blocked_between(uuid,uuid)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon',
    'public.is_conversation_member(uuid,uuid)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon',
    'public.is_plan_member(uuid,uuid)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon',
    'public.start_direct_conversation(uuid)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon',
    'public.create_group_conversation(uuid[],uuid)',
    'EXECUTE'
  ),
  'Anonymous cannot execute helpers or messaging RPCs'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000701';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000701","role":"authenticated","aud":"authenticated"}';

SELECT is(
  public.start_direct_conversation(
    '00000000-0000-4000-8000-000000000702'::uuid
  ) IS NOT NULL,
  true,
  'The eligible caller can create a direct conversation'
);
INSERT INTO pg_temp.fixture_conversations (fixture_name, conversation_id)
SELECT 'direct_ab', id
FROM public.conversations
WHERE conversation_type = 'direct'
  AND created_by = auth.uid()
  AND direct_recipient_id = '00000000-0000-4000-8000-000000000702'::uuid;

INSERT INTO pg_temp.fixture_conversations (fixture_name, conversation_id)
SELECT
  'group_abc',
  public.create_group_conversation(
    ARRAY[
      '00000000-0000-4000-8000-000000000701'::uuid,
      '00000000-0000-4000-8000-000000000702'::uuid,
      '00000000-0000-4000-8000-000000000703'::uuid
    ],
    '00000000-0000-4000-8000-000000000711'::uuid
  );

SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

INSERT INTO public.messages (conversation_id, sender_id, body)
SELECT conversation_id, auth.uid(), 'Eligible direct history'
FROM pg_temp.fixture_conversations
WHERE fixture_name = 'direct_ab';
INSERT INTO public.messages (conversation_id, sender_id, body)
SELECT conversation_id, auth.uid(), 'Group history'
FROM pg_temp.fixture_conversations
WHERE fixture_name = 'group_abc';

SELECT is(
  public.is_blocked_between(
    '00000000-0000-4000-8000-000000000705'::uuid,
    '00000000-0000-4000-8000-000000000706'::uuid
  ),
  false,
  'An authenticated user cannot probe a block between two other users'
);
SELECT is(
  public.is_conversation_member(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'group_abc'),
    '00000000-0000-4000-8000-000000000702'::uuid
  ),
  false,
  'An authenticated user cannot probe another profile membership'
);
SELECT is(
  public.is_plan_member(
    '00000000-0000-4000-8000-000000000711'::uuid,
    '00000000-0000-4000-8000-000000000702'::uuid
  ),
  false,
  'An authenticated user cannot probe another profile plan membership'
);
SELECT is(
  public.is_open_plan_visible_for_user(
    '00000000-0000-4000-8000-000000000711'::uuid,
    '00000000-0000-4000-8000-000000000702'::uuid
  ),
  false,
  'Open-plan visibility helper cannot probe another profile'
);
SELECT ok(
  public.is_plan_member('00000000-0000-4000-8000-000000000711'::uuid),
  'A plan member can evaluate their own membership for RLS'
);
SELECT ok(
  public.is_conversation_member(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'direct_ab')
  ),
  'An eligible direct participant passes the policy membership helper'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'direct_ab')),
  1::bigint,
  'An eligible direct participant can read their conversation'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE conversation_id = (SELECT conversation_id
                            FROM pg_temp.fixture_conversations
                            WHERE fixture_name = 'direct_ab')),
  1::bigint,
  'An eligible direct participant can read direct history'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'direct_ab'),
    auth.uid(),
    'Eligible direct send'
  ),
  1,
  'An eligible direct participant can send a message'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'group_abc')),
  1::bigint,
  'An existing group member can read the group conversation'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'group_abc'),
    auth.uid(),
    'Group send before block'
  ),
  1,
  'An existing group member can send to the group'
);

SELECT throws_ok(
  $$SELECT public.create_group_conversation(
      ARRAY[
        '00000000-0000-4000-8000-000000000701'::uuid,
        '00000000-0000-4000-8000-000000000702'::uuid,
        '00000000-0000-4000-8000-000000000704'::uuid
      ],
      '00000000-0000-4000-8000-000000000711'::uuid
    )$$,
  '42501',
  'Group conversation participants must belong to the plan.',
  'Group creation still rejects an ineligible plan member'
);

RESET ROLE;
INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES (
  '00000000-0000-4000-8000-000000000701',
  '00000000-0000-4000-8000-000000000702'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000701';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000701","role":"authenticated","aud":"authenticated"}';

SELECT is(
  public.is_blocked_between(auth.uid(), '00000000-0000-4000-8000-000000000702'::uuid),
  true,
  'An authenticated participant can evaluate their own block relation for RLS'
);
SELECT is(
  public.is_conversation_member(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'direct_ab')
  ),
  false,
  'A blocked direct participant fails the policy membership helper'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'direct_ab')),
  0::bigint,
  'The blocker cannot read the blocked direct conversation'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE conversation_id = (SELECT conversation_id
                            FROM pg_temp.fixture_conversations
                            WHERE fixture_name = 'direct_ab')),
  0::bigint,
  'The blocker cannot read blocked direct history'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'direct_ab'),
    auth.uid(),
    'Denied blocked direct send'
  ),
  0,
  'The blocker cannot send a blocked direct message'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'group_abc')),
  1::bigint,
  'Blocking does not hide an existing group conversation'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'group_abc'),
    auth.uid(),
    'Group send while blocked'
  ),
  1,
  'Blocking does not prevent an existing group member sending'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000702';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000702","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'direct_ab')),
  0::bigint,
  'The blocked participant cannot read the direct conversation'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE conversation_id = (SELECT conversation_id
                            FROM pg_temp.fixture_conversations
                            WHERE fixture_name = 'direct_ab')),
  0::bigint,
  'The blocked participant cannot read direct history'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'group_abc')),
  1::bigint,
  'The other group member retains access despite the block'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000704';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000704","role":"authenticated","aud":"authenticated"}';

SELECT is(
  public.is_conversation_member(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'group_abc')
  ),
  false,
  'A nonmember cannot use the helper to gain group membership'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'group_abc')),
  0::bigint,
  'A nonmember cannot read the group conversation'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE conversation_id = (SELECT conversation_id
                            FROM pg_temp.fixture_conversations
                            WHERE fixture_name = 'group_abc')),
  0::bigint,
  'A nonmember cannot read group messages'
);

SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.role = 'service_role';
SET LOCAL request.jwt.claim.sub =
  '00000000-0000-4000-8000-000000000701';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000701","role":"service_role","aud":"authenticated"}';

SELECT is(
  public.is_blocked_between(
    '00000000-0000-4000-8000-000000000705'::uuid,
    '00000000-0000-4000-8000-000000000706'::uuid
  ),
  true,
  'Service role retains privileged block-helper behavior'
);
SELECT ok(
  public.is_conversation_member(
    (SELECT id FROM public.conversations
     WHERE plan_id = '00000000-0000-4000-8000-000000000711'::uuid
       AND conversation_type = 'group'),
    '00000000-0000-4000-8000-000000000702'::uuid
  ),
  'Service role retains privileged conversation-helper behavior'
);
SELECT ok(
  public.is_plan_member(
    '00000000-0000-4000-8000-000000000711'::uuid,
    '00000000-0000-4000-8000-000000000702'::uuid
  ),
  'Service role retains privileged plan-helper behavior'
);

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claim.role = 'anon';
SET LOCAL request.jwt.claim.sub = '';
SET LOCAL request.jwt.claims = '{"role":"anon","aud":"anon"}';

SELECT throws_ok(
  $$SELECT public.is_blocked_between(
      '00000000-0000-4000-8000-000000000705'::uuid,
      '00000000-0000-4000-8000-000000000706'::uuid
    )$$,
  '42501',
  'permission denied for function is_blocked_between',
  'Anonymous cannot call the block helper'
);
SELECT throws_ok(
  $$SELECT public.is_conversation_member(
      '00000000-0000-4000-8000-000000000711'::uuid
    )$$,
  '42501',
  'permission denied for function is_conversation_member',
  'Anonymous cannot call the conversation helper'
);
SELECT throws_ok(
  $$SELECT public.is_plan_member(
      '00000000-0000-4000-8000-000000000711'::uuid
    )$$,
  '42501',
  'permission denied for function is_plan_member',
  'Anonymous cannot call the plan helper'
);
SELECT throws_ok(
  $$SELECT public.start_direct_conversation(
      '00000000-0000-4000-8000-000000000702'::uuid
    )$$,
  '42501',
  'permission denied for function start_direct_conversation',
  'Anonymous cannot call the direct messaging RPC'
);
SELECT throws_ok(
  $$SELECT public.create_group_conversation(
      ARRAY[
        '00000000-0000-4000-8000-000000000701'::uuid,
        '00000000-0000-4000-8000-000000000702'::uuid,
        '00000000-0000-4000-8000-000000000703'::uuid
      ],
      '00000000-0000-4000-8000-000000000711'::uuid
    )$$,
  '42501',
  'permission denied for function create_group_conversation',
  'Anonymous cannot call the group messaging RPC'
);

SELECT * FROM finish();
ROLLBACK;
