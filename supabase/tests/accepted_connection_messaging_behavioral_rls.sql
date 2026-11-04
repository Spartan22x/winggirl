BEGIN;

DO $fixture_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id IN (
      '00000000-0000-4000-8000-000000000601'::uuid,
      '00000000-0000-4000-8000-000000000602'::uuid,
      '00000000-0000-4000-8000-000000000603'::uuid,
      '00000000-0000-4000-8000-000000000604'::uuid,
      '00000000-0000-4000-8000-000000000605'::uuid,
      '00000000-0000-4000-8000-000000000606'::uuid
    )
      OR lower(email) IN (
        'winggirl-eligibility-a@example.invalid',
        'winggirl-eligibility-b@example.invalid',
        'winggirl-eligibility-pending@example.invalid',
        'winggirl-eligibility-declined@example.invalid',
        'winggirl-eligibility-unconnected@example.invalid',
        'winggirl-eligibility-member@example.invalid'
      )
  ) THEN
    RAISE EXCEPTION
      'Accepted-connection fixture collision: a synthetic user ID or email already exists.';
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
    '00000000-0000-4000-8000-000000000601',
    'authenticated',
    'authenticated',
    'winggirl-eligibility-a@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Eligibility A"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000602',
    'authenticated',
    'authenticated',
    'winggirl-eligibility-b@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Eligibility B"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000603',
    'authenticated',
    'authenticated',
    'winggirl-eligibility-pending@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Eligibility Pending"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000604',
    'authenticated',
    'authenticated',
    'winggirl-eligibility-declined@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Eligibility Declined"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000605',
    'authenticated',
    'authenticated',
    'winggirl-eligibility-unconnected@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Eligibility Unconnected"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000606',
    'authenticated',
    'authenticated',
    'winggirl-eligibility-member@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Eligibility Member"}',
    now(),
    now(),
    false
  );

INSERT INTO public.connections (requester_id, addressee_id, status)
VALUES
  (
    '00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000602',
    'accepted'
  ),
  (
    '00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000603',
    'pending'
  ),
  (
    '00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000604',
    'declined'
  ),
  (
    '00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000606',
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

CREATE FUNCTION pg_temp.try_direct_conversation_insert(
  target_creator_id uuid,
  target_recipient_id uuid
)
RETURNS integer
LANGUAGE plpgsql
AS $function$
BEGIN
  BEGIN
    INSERT INTO public.conversations (
      created_by,
      conversation_type,
      direct_recipient_id
    )
    VALUES (
      target_creator_id,
      'direct',
      target_recipient_id
    );
    RETURN 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN 0;
  END;
END;
$function$;

WITH group_conversation AS (
  INSERT INTO public.conversations (created_by, conversation_type)
  VALUES (
    '00000000-0000-4000-8000-000000000601',
    'group'
  )
  RETURNING id
)
INSERT INTO pg_temp.fixture_conversations (fixture_name, conversation_id)
SELECT 'group_abf', id
FROM group_conversation;

INSERT INTO public.conversation_members (conversation_id, profile_id)
SELECT
  (SELECT conversation_id FROM pg_temp.fixture_conversations
   WHERE fixture_name = 'group_abf'),
  members.profile_id
FROM (VALUES
  ('00000000-0000-4000-8000-000000000601'::uuid),
  ('00000000-0000-4000-8000-000000000602'::uuid),
  ('00000000-0000-4000-8000-000000000606'::uuid)
) AS members(profile_id);

INSERT INTO public.messages (conversation_id, sender_id, body)
SELECT conversation_id, '00000000-0000-4000-8000-000000000601'::uuid,
       'Group history before blocking'
FROM pg_temp.fixture_conversations
WHERE fixture_name = 'group_abf';

SELECT plan(62);

SELECT is(
  (SELECT count(*) FROM public.profiles
   WHERE id BETWEEN
     '00000000-0000-4000-8000-000000000601'::uuid
     AND '00000000-0000-4000-8000-000000000606'::uuid),
  6::bigint,
  'The auth trigger creates all six eligibility fixture profiles'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.start_direct_conversation(uuid)',
    'EXECUTE'
  ),
  'Authenticated users can execute the direct-start RPC'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.start_direct_conversation(uuid)',
    'EXECUTE'
  ),
  'Anonymous users cannot execute the direct-start RPC'
);
SELECT ok(
  NOT has_function_privilege(
    'service_role',
    'public.start_direct_conversation(uuid)',
    'EXECUTE'
  ),
  'Service role cannot execute the direct-start RPC'
);
SELECT is(
  pg_catalog.pg_get_function_arguments(
    'public.start_direct_conversation(uuid)'::regprocedure
  ),
  'target_profile_id uuid',
  'The direct-start RPC accepts only a target ID and derives its caller'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000601';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000601","role":"authenticated","aud":"authenticated"}';

SELECT ok(
  public.start_direct_conversation(
    '00000000-0000-4000-8000-000000000602'::uuid
  ) IS NOT NULL,
  'An accepted connection can start a direct conversation'
);
INSERT INTO pg_temp.fixture_conversations (fixture_name, conversation_id)
SELECT
  'direct_ab',
  id
FROM public.conversations
WHERE conversation_type = 'direct'
  AND created_by = auth.uid()
  AND direct_recipient_id = '00000000-0000-4000-8000-000000000602'::uuid;

SELECT is(
  public.start_direct_conversation(
    '00000000-0000-4000-8000-000000000602'::uuid
  ),
  (SELECT conversation_id FROM pg_temp.fixture_conversations
   WHERE fixture_name = 'direct_ab'),
  'Repeated eligible requests return the existing direct conversation'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE conversation_type = 'direct'
     AND created_by IN (
       '00000000-0000-4000-8000-000000000601'::uuid,
       '00000000-0000-4000-8000-000000000602'::uuid
     )
     AND direct_recipient_id IN (
       '00000000-0000-4000-8000-000000000601'::uuid,
       '00000000-0000-4000-8000-000000000602'::uuid
     )),
  1::bigint,
  'Only one direct conversation exists for the accepted pair'
);
SELECT ok(
  public.start_direct_conversation(
    '00000000-0000-4000-8000-000000000606'::uuid
  ) IS NOT NULL,
  'A second accepted pair can create a direct conversation'
);
INSERT INTO pg_temp.fixture_conversations (fixture_name, conversation_id)
SELECT
  'direct_af',
  id
FROM public.conversations
WHERE conversation_type = 'direct'
  AND created_by = auth.uid()
  AND direct_recipient_id = '00000000-0000-4000-8000-000000000606'::uuid;

SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

SELECT throws_ok(
  $$SELECT public.start_direct_conversation(
      '00000000-0000-4000-8000-000000000603'::uuid
    )$$,
  '42501',
  'Conversation unavailable.',
  'A pending connection cannot start a direct conversation'
);
SELECT throws_ok(
  $$SELECT public.start_direct_conversation(
      '00000000-0000-4000-8000-000000000604'::uuid
    )$$,
  '42501',
  'Conversation unavailable.',
  'A declined connection cannot start a direct conversation'
);
SELECT throws_ok(
  $$SELECT public.start_direct_conversation(
      '00000000-0000-4000-8000-000000000605'::uuid
    )$$,
  '42501',
  'Conversation unavailable.',
  'A pair without a connection cannot start a direct conversation'
);
SELECT throws_ok(
  $$SELECT public.start_direct_conversation(auth.uid())$$,
  '22023',
  'A direct conversation must target another profile.',
  'A user cannot start a direct conversation with themselves'
);
SELECT is(
  pg_temp.try_direct_conversation_insert(
    '00000000-0000-4000-8000-000000000602'::uuid,
    '00000000-0000-4000-8000-000000000601'::uuid
  ),
  0,
  'A caller cannot forge another creator through direct table writes'
);

RESET ROLE;
INSERT INTO public.messages (conversation_id, sender_id, body)
SELECT conversation_id, '00000000-0000-4000-8000-000000000601'::uuid,
       'Direct history before blocking'
FROM pg_temp.fixture_conversations
WHERE fixture_name = 'direct_ab';
INSERT INTO public.messages (conversation_id, sender_id, body)
SELECT conversation_id, '00000000-0000-4000-8000-000000000601'::uuid,
       'Direct history before connection removal'
FROM pg_temp.fixture_conversations
WHERE fixture_name = 'direct_af';

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000601';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000601","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'direct_ab')),
  1::bigint,
  'The first accepted participant can read the direct conversation'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE conversation_id = (SELECT conversation_id
                             FROM pg_temp.fixture_conversations
                             WHERE fixture_name = 'direct_ab')),
  1::bigint,
  'The first accepted participant can read direct history'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'direct_ab'),
    auth.uid(),
    'Eligible message from A'
  ),
  1,
  'The first accepted participant can send a direct message'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000602';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000602","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'direct_ab')),
  1::bigint,
  'The second accepted participant can read the direct conversation'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE conversation_id = (SELECT conversation_id
                             FROM pg_temp.fixture_conversations
                             WHERE fixture_name = 'direct_ab')),
  2::bigint,
  'The second accepted participant can read direct history'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'direct_ab'),
    auth.uid(),
    'Eligible message from B'
  ),
  1,
  'The second accepted participant can send a direct message'
);

RESET ROLE;
UPDATE public.connections
SET status = 'declined'
WHERE requester_id = '00000000-0000-4000-8000-000000000601'::uuid
  AND addressee_id = '00000000-0000-4000-8000-000000000606'::uuid;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000601';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000601","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'direct_af')),
  0::bigint,
  'Changing an existing connection to declined hides the direct conversation'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE conversation_id = (SELECT conversation_id
                             FROM pg_temp.fixture_conversations
                             WHERE fixture_name = 'direct_af')),
  0::bigint,
  'Changing an existing connection to declined hides its message history'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'direct_af'),
    auth.uid(),
    'Denied message after decline'
  ),
  0,
  'A declined connection cannot send direct messages'
);
SELECT throws_ok(
  $$SELECT public.start_direct_conversation(
      '00000000-0000-4000-8000-000000000606'::uuid
    )$$,
  '42501',
  'Conversation unavailable.',
  'A declined connection cannot resume its existing direct conversation'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000606';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000606","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'direct_af')),
  0::bigint,
  'The other participant cannot read a direct conversation after decline'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE conversation_id = (SELECT conversation_id
                             FROM pg_temp.fixture_conversations
                             WHERE fixture_name = 'direct_af')),
  0::bigint,
  'The other participant cannot read direct history after decline'
);

RESET ROLE;
UPDATE public.connections
SET status = 'accepted'
WHERE requester_id = '00000000-0000-4000-8000-000000000601'::uuid
  AND addressee_id = '00000000-0000-4000-8000-000000000606'::uuid;
INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES (
  '00000000-0000-4000-8000-000000000601',
  '00000000-0000-4000-8000-000000000602'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000601';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000601","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'direct_ab')),
  0::bigint,
  'The blocker cannot read the direct conversation while blocked'
);
SELECT is(
  (SELECT count(*) FROM public.conversation_members
   WHERE conversation_id = (SELECT conversation_id
                             FROM pg_temp.fixture_conversations
                             WHERE fixture_name = 'direct_ab')),
  0::bigint,
  'The blocker cannot read direct conversation memberships while blocked'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE conversation_id = (SELECT conversation_id
                             FROM pg_temp.fixture_conversations
                             WHERE fixture_name = 'direct_ab')),
  0::bigint,
  'The blocker cannot read direct history while blocked'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'direct_ab'),
    auth.uid(),
    'Denied message from blocker'
  ),
  0,
  'The blocker cannot send direct messages while blocked'
);
SELECT throws_ok(
  $$SELECT public.start_direct_conversation(
      '00000000-0000-4000-8000-000000000602'::uuid
    )$$,
  '42501',
  'Conversation unavailable.',
  'The blocker cannot start or resume a direct conversation while blocked'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'group_abf')),
  1::bigint,
  'Blocking does not hide an existing group conversation from its member'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE conversation_id = (SELECT conversation_id
                             FROM pg_temp.fixture_conversations
                             WHERE fixture_name = 'group_abf')),
  1::bigint,
  'Blocking does not hide existing group history'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'group_abf'),
    auth.uid(),
    'Group message while blocking'
  ),
  1,
  'Blocking does not prevent an existing group member from sending'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000602';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000602","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'direct_ab')),
  0::bigint,
  'The blocked participant cannot read the direct conversation'
);
SELECT is(
  (SELECT count(*) FROM public.conversation_members
   WHERE conversation_id = (SELECT conversation_id
                             FROM pg_temp.fixture_conversations
                             WHERE fixture_name = 'direct_ab')),
  0::bigint,
  'The blocked participant cannot read direct memberships'
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
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'direct_ab'),
    auth.uid(),
    'Denied message from blocked participant'
  ),
  0,
  'The blocked participant cannot send direct messages'
);
SELECT throws_ok(
  $$SELECT public.start_direct_conversation(
      '00000000-0000-4000-8000-000000000601'::uuid
    )$$,
  '42501',
  'Conversation unavailable.',
  'The blocked participant cannot start or resume a direct conversation'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'group_abf')),
  1::bigint,
  'The blocked participant retains access to the existing group'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'group_abf'),
    auth.uid(),
    'Group message from blocked participant'
  ),
  1,
  'The blocked participant can continue sending group messages'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000606';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000606","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'group_abf')),
  1::bigint,
  'A third existing group member remains unaffected by the block'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'group_abf'),
    auth.uid(),
    'Group message from the third member'
  ),
  1,
  'The third existing group member can send during the block'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000603';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000603","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'group_abf')),
  0::bigint,
  'A nonmember cannot read the group conversation'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE conversation_id = (SELECT conversation_id
                             FROM pg_temp.fixture_conversations
                             WHERE fixture_name = 'group_abf')),
  0::bigint,
  'A nonmember cannot read group history'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'group_abf'),
    auth.uid(),
    'Denied message from nonmember'
  ),
  0,
  'A nonmember cannot send a group message'
);

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM public.conversation_members
   WHERE conversation_id = (SELECT conversation_id
                             FROM pg_temp.fixture_conversations
                             WHERE fixture_name = 'group_abf')),
  3::bigint,
  'Blocking preserves all three existing group memberships'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE conversation_id = (SELECT conversation_id
                             FROM pg_temp.fixture_conversations
                             WHERE fixture_name = 'group_abf')),
  4::bigint,
  'Blocking preserves group history and all authorized group messages'
);

DELETE FROM public.blocks
WHERE blocker_id = '00000000-0000-4000-8000-000000000601'::uuid
  AND blocked_id = '00000000-0000-4000-8000-000000000602'::uuid;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000601';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000601","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'direct_ab')),
  1::bigint,
  'Removing the block restores direct access while the connection is accepted'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE conversation_id = (SELECT conversation_id
                             FROM pg_temp.fixture_conversations
                             WHERE fixture_name = 'direct_ab')),
  3::bigint,
  'Removing the block restores direct history while accepted'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000602';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000602","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'direct_ab')),
  1::bigint,
  'Both participants regain direct access after the blocker unblocks'
);

RESET ROLE;
INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES (
  '00000000-0000-4000-8000-000000000602',
  '00000000-0000-4000-8000-000000000601'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000601';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000601","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'direct_ab')),
  0::bigint,
  'The other-direction block also denies direct access to the first participant'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'direct_ab'),
    auth.uid(),
    'Denied message during reverse block'
  ),
  0,
  'The first participant cannot send during the reverse-direction block'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000602';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000602","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'direct_ab')),
  0::bigint,
  'The blocker cannot read direct access during the reverse-direction block'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'direct_ab'),
    auth.uid(),
    'Denied message from reverse blocker'
  ),
  0,
  'The reverse-direction blocker cannot send direct messages'
);

RESET ROLE;
DELETE FROM public.blocks
WHERE blocker_id = '00000000-0000-4000-8000-000000000602'::uuid
  AND blocked_id = '00000000-0000-4000-8000-000000000601'::uuid;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000601';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000601","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'direct_ab')),
  1::bigint,
  'Unblocking in the reverse direction restores direct access'
);

RESET ROLE;
INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES (
  '00000000-0000-4000-8000-000000000601',
  '00000000-0000-4000-8000-000000000606'
);
DELETE FROM public.connections
WHERE requester_id = '00000000-0000-4000-8000-000000000601'::uuid
  AND addressee_id = '00000000-0000-4000-8000-000000000606'::uuid;
DELETE FROM public.blocks
WHERE blocker_id = '00000000-0000-4000-8000-000000000601'::uuid
  AND blocked_id = '00000000-0000-4000-8000-000000000606'::uuid;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000601';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000601","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'direct_af')),
  0::bigint,
  'Unblocking does not restore access after the accepted connection is removed'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE conversation_id = (SELECT conversation_id
                             FROM pg_temp.fixture_conversations
                             WHERE fixture_name = 'direct_af')),
  0::bigint,
  'Unblocking does not restore direct history after connection removal'
);
SELECT is(
  pg_temp.try_message_insert(
    (SELECT conversation_id FROM pg_temp.fixture_conversations
     WHERE fixture_name = 'direct_af'),
    auth.uid(),
    'Denied message after connection removal'
  ),
  0,
  'A removed connection cannot send direct messages'
);
SELECT throws_ok(
  $$SELECT public.start_direct_conversation(
      '00000000-0000-4000-8000-000000000606'::uuid
    )$$,
  '42501',
  'Conversation unavailable.',
  'A removed connection cannot resume its existing direct conversation'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000606';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000606","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = (SELECT conversation_id FROM pg_temp.fixture_conversations
               WHERE fixture_name = 'direct_af')),
  0::bigint,
  'The other participant cannot read the conversation after connection removal'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE conversation_id = (SELECT conversation_id
                             FROM pg_temp.fixture_conversations
                             WHERE fixture_name = 'direct_af')),
  0::bigint,
  'The other participant cannot read history after connection removal'
);

SELECT * FROM finish();
ROLLBACK;
