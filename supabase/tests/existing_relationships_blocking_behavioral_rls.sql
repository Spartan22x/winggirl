BEGIN;

DO $fixture_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id IN (
      '00000000-0000-4000-8000-000000000501'::uuid,
      '00000000-0000-4000-8000-000000000502'::uuid,
      '00000000-0000-4000-8000-000000000503'::uuid
    )
      OR lower(email) IN (
        'winggirl-existing-block-user-a@example.invalid',
        'winggirl-existing-block-user-b@example.invalid',
        'winggirl-existing-block-user-c@example.invalid'
      )
  )
     OR EXISTS (
       SELECT 1 FROM public.plans
       WHERE id IN (
         '00000000-0000-4000-8000-000000000601'::uuid,
         '00000000-0000-4000-8000-000000000602'::uuid,
         '00000000-0000-4000-8000-000000000603'::uuid,
         '00000000-0000-4000-8000-000000000604'::uuid,
         '00000000-0000-4000-8000-000000000605'::uuid,
         '00000000-0000-4000-8000-000000000606'::uuid,
         '00000000-0000-4000-8000-000000000607'::uuid,
         '00000000-0000-4000-8000-000000000608'::uuid,
         '00000000-0000-4000-8000-000000000609'::uuid,
         '00000000-0000-4000-8000-000000000610'::uuid
       )
     )
     OR EXISTS (
       SELECT 1 FROM public.conversations
       WHERE id = '00000000-0000-4000-8000-000000000701'::uuid
     )
     OR EXISTS (
       SELECT 1 FROM public.messages
       WHERE id = '00000000-0000-4000-8000-000000000801'::uuid
     )
  THEN
    RAISE EXCEPTION
      'Existing-relationship blocking fixture collision: a synthetic user or record ID already exists.';
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
    '00000000-0000-4000-8000-000000000501',
    'authenticated',
    'authenticated',
    'winggirl-existing-block-user-a@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Existing Block A"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000502',
    'authenticated',
    'authenticated',
    'winggirl-existing-block-user-b@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Existing Block B"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000503',
    'authenticated',
    'authenticated',
    'winggirl-existing-block-user-c@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Existing Block C"}',
    now(),
    now(),
    false
  );

INSERT INTO public.connections (requester_id, addressee_id, status)
VALUES (
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000502',
  'accepted'
);

INSERT INTO public.plans (
  id, host_id, title, starts_at, activity, status, location_name, visibility
)
VALUES
  (
    '00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000501',
    'Existing private plan hosted by A',
    now() + interval '60 days',
    'Coffee',
    'upcoming',
    'Fixture Cafe',
    'invite_only'
  ),
  (
    '00000000-0000-4000-8000-000000000602',
    '00000000-0000-4000-8000-000000000502',
    'Existing private plan hosted by B',
    now() + interval '60 days',
    'Coffee',
    'upcoming',
    'Fixture Cafe',
    'invite_only'
  ),
  (
    '00000000-0000-4000-8000-000000000603',
    '00000000-0000-4000-8000-000000000501',
    'Invitation acceptance plan hosted by A',
    now() + interval '60 days',
    'Coffee',
    'upcoming',
    'Fixture Cafe',
    'invite_only'
  ),
  (
    '00000000-0000-4000-8000-000000000604',
    '00000000-0000-4000-8000-000000000502',
    'Invitation acceptance plan hosted by B',
    now() + interval '60 days',
    'Coffee',
    'upcoming',
    'Fixture Cafe',
    'invite_only'
  ),
  (
    '00000000-0000-4000-8000-000000000605',
    '00000000-0000-4000-8000-000000000501',
    'Open plan hosted by A',
    now() + interval '60 days',
    'Coffee',
    'upcoming',
    'Fixture Cafe',
    'open'
  ),
  (
    '00000000-0000-4000-8000-000000000606',
    '00000000-0000-4000-8000-000000000502',
    'Open plan hosted by B',
    now() + interval '60 days',
    'Coffee',
    'upcoming',
    'Fixture Cafe',
    'open'
  ),
  (
    '00000000-0000-4000-8000-000000000607',
    '00000000-0000-4000-8000-000000000501',
    'Unblock restoration plan hosted by A',
    now() + interval '60 days',
    'Coffee',
    'upcoming',
    'Fixture Cafe',
    'invite_only'
  ),
  (
    '00000000-0000-4000-8000-000000000608',
    '00000000-0000-4000-8000-000000000502',
    'Unblock restoration plan hosted by B',
    now() + interval '60 days',
    'Coffee',
    'upcoming',
    'Fixture Cafe',
    'invite_only'
  );

INSERT INTO public.plan_members (plan_id, profile_id, status)
VALUES
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000502', 'invited'),
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000501', 'invited'),
  ('00000000-0000-4000-8000-000000000607', '00000000-0000-4000-8000-000000000502', 'invited'),
  ('00000000-0000-4000-8000-000000000608', '00000000-0000-4000-8000-000000000501', 'invited');

INSERT INTO public.conversations (
  id,
  created_by,
  conversation_type,
  direct_recipient_id
)
VALUES (
  '00000000-0000-4000-8000-000000000701',
  '00000000-0000-4000-8000-000000000501',
  'direct',
  '00000000-0000-4000-8000-000000000502'
);

INSERT INTO public.conversation_members (conversation_id, profile_id)
VALUES
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000501'),
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000502');

INSERT INTO public.messages (id, conversation_id, sender_id, body)
VALUES (
  '00000000-0000-4000-8000-000000000801',
  '00000000-0000-4000-8000-000000000701',
  '00000000-0000-4000-8000-000000000501',
  'Existing fixture message'
);

INSERT INTO public.availability (profile_id, available_date, is_available)
VALUES
  ('00000000-0000-4000-8000-000000000501', current_date, true),
  ('00000000-0000-4000-8000-000000000502', current_date, true),
  ('00000000-0000-4000-8000-000000000503', current_date, true);

INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES (
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000502'
);

CREATE FUNCTION pg_temp.try_invite_blocked_user(target_plan uuid, target_profile uuid)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  affected integer;
BEGIN
  BEGIN
    INSERT INTO public.plan_members (plan_id, profile_id, status)
    VALUES (target_plan, target_profile, 'invited');
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN 0;
  END;
END;
$function$;

CREATE FUNCTION pg_temp.try_accept_blocked_invitation(target_plan uuid, target_profile uuid)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  affected integer;
BEGIN
  BEGIN
    UPDATE public.plan_members
    SET status = 'joined'
    WHERE plan_id = target_plan
      AND profile_id = target_profile
      AND status = 'invited';
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN 0;
  END;
END;
$function$;

CREATE FUNCTION pg_temp.try_join_blocked_open_plan(target_plan uuid, target_profile uuid)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  affected integer;
BEGIN
  BEGIN
    INSERT INTO public.plan_members (plan_id, profile_id, status)
    VALUES (target_plan, target_profile, 'joined');
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN 0;
  END;
END;
$function$;

CREATE FUNCTION pg_temp.try_send_blocked_message(target_profile uuid, message_body text)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  affected integer;
BEGIN
  BEGIN
    INSERT INTO public.messages (conversation_id, sender_id, body)
    VALUES (
      '00000000-0000-4000-8000-000000000701'::uuid,
      target_profile,
      message_body
    );
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN 0;
  END;
END;
$function$;

SELECT plan(66);

SELECT is(
  (SELECT count(*) FROM public.profiles
   WHERE id IN (
     '00000000-0000-4000-8000-000000000501'::uuid,
     '00000000-0000-4000-8000-000000000502'::uuid,
     '00000000-0000-4000-8000-000000000503'::uuid
   )),
  3::bigint,
  'Auth trigger creates all three fixture profiles'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000501';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000501","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.connections
   WHERE requester_id = '00000000-0000-4000-8000-000000000501'::uuid
     AND addressee_id = '00000000-0000-4000-8000-000000000502'::uuid
     AND status = 'accepted'),
  0::bigint,
  'Blocked User A cannot see the accepted connection in their list'
);
SELECT is(
  (SELECT count(*) FROM public.profiles
   WHERE id = '00000000-0000-4000-8000-000000000502'::uuid),
  0::bigint,
  'User A cannot retrieve User B private profile'
);
SELECT is(
  (SELECT count(*) FROM public.availability
   WHERE profile_id = '00000000-0000-4000-8000-000000000501'::uuid
     AND available_date = current_date),
  1::bigint,
  'User A retains access to their own availability'
);
SELECT is(
  (SELECT count(*) FROM public.availability
   WHERE profile_id = '00000000-0000-4000-8000-000000000502'::uuid
     AND available_date = current_date),
  0::bigint,
  'User A cannot see User B availability while blocked'
);
SELECT is(
  (SELECT count(*) FROM public.plans
   WHERE id = '00000000-0000-4000-8000-000000000602'::uuid),
  0::bigint,
  'User A cannot access User B private plan details'
);
SELECT is(
  (SELECT count(*) FROM public.plans
   WHERE id = '00000000-0000-4000-8000-000000000601'::uuid),
  1::bigint,
  'User A retains access to their own hosted plan'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = '00000000-0000-4000-8000-000000000701'::uuid),
  0::bigint,
  'User A cannot access the existing private conversation while blocked'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE id = '00000000-0000-4000-8000-000000000801'::uuid),
  0::bigint,
  'User A cannot read messages in the blocked conversation'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000502';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000502","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.connections
   WHERE requester_id = '00000000-0000-4000-8000-000000000501'::uuid
     AND addressee_id = '00000000-0000-4000-8000-000000000502'::uuid
     AND status = 'accepted'),
  0::bigint,
  'Blocked User B cannot see the accepted connection in their list'
);
SELECT is(
  (SELECT count(*) FROM public.profiles
   WHERE id = '00000000-0000-4000-8000-000000000501'::uuid),
  0::bigint,
  'User B cannot retrieve User A private profile'
);
SELECT is(
  (SELECT count(*) FROM public.availability
   WHERE profile_id = '00000000-0000-4000-8000-000000000502'::uuid
     AND available_date = current_date),
  1::bigint,
  'User B retains access to their own availability'
);
SELECT is(
  (SELECT count(*) FROM public.availability
   WHERE profile_id = '00000000-0000-4000-8000-000000000501'::uuid
     AND available_date = current_date),
  0::bigint,
  'User B cannot see User A availability while blocked'
);
SELECT is(
  (SELECT count(*) FROM public.plans
   WHERE id = '00000000-0000-4000-8000-000000000601'::uuid),
  0::bigint,
  'User B cannot access User A private plan details'
);
SELECT is(
  (SELECT count(*) FROM public.plans
   WHERE id = '00000000-0000-4000-8000-000000000602'::uuid),
  1::bigint,
  'User B retains access to their own hosted plan'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = '00000000-0000-4000-8000-000000000701'::uuid),
  0::bigint,
  'User B cannot access the existing private conversation while blocked'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE id = '00000000-0000-4000-8000-000000000801'::uuid),
  0::bigint,
  'User B cannot read messages in the blocked conversation'
);
SELECT is(
  (SELECT count(*) FROM public.plan_members
   WHERE plan_id = '00000000-0000-4000-8000-000000000601'::uuid
     AND profile_id = '00000000-0000-4000-8000-000000000502'::uuid),
  1::bigint,
  'Existing member can still read their plan membership row while blocked'
);
SELECT is(
  (SELECT count(*) FROM public.plan_members
   WHERE plan_id = '00000000-0000-4000-8000-000000000602'::uuid
     AND profile_id = '00000000-0000-4000-8000-000000000501'::uuid),
  1::bigint,
  'Other blocked member can still read their plan membership row'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000503';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000503","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.connections
   WHERE requester_id = '00000000-0000-4000-8000-000000000501'::uuid
     AND addressee_id = '00000000-0000-4000-8000-000000000502'::uuid),
  0::bigint,
  'Unrelated User C cannot see the A-B connection'
);
SELECT is(
  (SELECT count(*) FROM public.plans
   WHERE id IN (
     '00000000-0000-4000-8000-000000000601'::uuid,
     '00000000-0000-4000-8000-000000000602'::uuid
   )),
  0::bigint,
  'Unrelated User C cannot access either private plan'
);
SELECT is(
  (SELECT count(*) FROM public.plan_members
   WHERE plan_id IN (
     '00000000-0000-4000-8000-000000000601'::uuid,
     '00000000-0000-4000-8000-000000000602'::uuid
   )),
  0::bigint,
  'Unrelated User C cannot access the private plan memberships'
);
SELECT is(
  (SELECT count(*) FROM public.availability
   WHERE profile_id = '00000000-0000-4000-8000-000000000501'::uuid
     AND available_date = current_date),
  1::bigint,
  'Unblocked User C can still see User A available record'
);
SELECT is(
  (SELECT count(*) FROM public.availability
   WHERE profile_id = '00000000-0000-4000-8000-000000000502'::uuid
     AND available_date = current_date),
  1::bigint,
  'Unblocked User C can still see User B available record'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = '00000000-0000-4000-8000-000000000701'::uuid),
  0::bigint,
  'Unrelated non-member cannot access the private conversation'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE id = '00000000-0000-4000-8000-000000000801'::uuid),
  0::bigint,
  'Unrelated non-member cannot read the private conversation message'
);

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM public.connections
   WHERE requester_id = '00000000-0000-4000-8000-000000000501'::uuid
     AND addressee_id = '00000000-0000-4000-8000-000000000502'::uuid
     AND status = 'accepted'),
  1::bigint,
  'Blocking leaves the accepted connection record intact'
);
SELECT is(
  (SELECT count(*) FROM public.plans
   WHERE id IN (
     '00000000-0000-4000-8000-000000000601'::uuid,
     '00000000-0000-4000-8000-000000000602'::uuid
   )),
  2::bigint,
  'Blocking does not cancel or delete either existing plan'
);
SELECT is(
  (SELECT count(*) FROM public.plan_members
   WHERE (plan_id = '00000000-0000-4000-8000-000000000601'::uuid
          AND profile_id = '00000000-0000-4000-8000-000000000502'::uuid)
      OR (plan_id = '00000000-0000-4000-8000-000000000602'::uuid
          AND profile_id = '00000000-0000-4000-8000-000000000501'::uuid)),
  2::bigint,
  'Blocking leaves both existing plan membership records intact'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = '00000000-0000-4000-8000-000000000701'::uuid),
  1::bigint,
  'Blocking leaves the existing conversation intact'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE id = '00000000-0000-4000-8000-000000000801'::uuid),
  1::bigint,
  'Blocking leaves the existing message intact'
);
SELECT is(
  (SELECT count(*) FROM public.availability
   WHERE profile_id IN (
     '00000000-0000-4000-8000-000000000501'::uuid,
     '00000000-0000-4000-8000-000000000502'::uuid,
     '00000000-0000-4000-8000-000000000503'::uuid
   )
     AND available_date = current_date),
  3::bigint,
  'Blocking leaves all availability records intact'
);
SELECT is(
  (SELECT count(*) FROM public.blocks
   WHERE blocker_id = '00000000-0000-4000-8000-000000000501'::uuid
     AND blocked_id = '00000000-0000-4000-8000-000000000502'::uuid),
  1::bigint,
  'Block record exists before unblock tests'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000501';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000501","role":"authenticated","aud":"authenticated"}';

INSERT INTO public.plans (
  id, host_id, title, starts_at, activity, status, location_name, visibility
)
VALUES (
  '00000000-0000-4000-8000-000000000609',
  '00000000-0000-4000-8000-000000000501',
  'New plan A while blocked',
  now() + interval '60 days',
  'Coffee',
  'upcoming',
  'Fixture Cafe',
  'invite_only'
);
SELECT is(
  (SELECT count(*) FROM public.plans
   WHERE id = '00000000-0000-4000-8000-000000000609'::uuid),
  1::bigint,
  'User A can create their own plan while blocked'
);
SELECT is(
  pg_temp.try_invite_blocked_user(
    '00000000-0000-4000-8000-000000000609'::uuid,
    '00000000-0000-4000-8000-000000000502'::uuid
  ),
  0,
  'User A cannot invite blocked User B to a new plan'
);
SELECT is(
  pg_temp.try_accept_blocked_invitation(
    '00000000-0000-4000-8000-000000000602'::uuid,
    '00000000-0000-4000-8000-000000000501'::uuid
  ),
  0,
  'User A cannot accept User B pending invitation while blocked'
);
SELECT is(
  pg_temp.try_join_blocked_open_plan(
    '00000000-0000-4000-8000-000000000606'::uuid,
    '00000000-0000-4000-8000-000000000501'::uuid
  ),
  0,
  'User A cannot join User B Open Plan while blocked'
);
SELECT is(
  pg_temp.try_send_blocked_message(
    '00000000-0000-4000-8000-000000000501'::uuid,
    'Message sent while blocked by A'
  ),
  0,
  'User A cannot send a message to the blocked conversation'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000502';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000502","role":"authenticated","aud":"authenticated"}';

INSERT INTO public.plans (
  id, host_id, title, starts_at, activity, status, location_name, visibility
)
VALUES (
  '00000000-0000-4000-8000-000000000610',
  '00000000-0000-4000-8000-000000000502',
  'New plan B while blocked',
  now() + interval '60 days',
  'Coffee',
  'upcoming',
  'Fixture Cafe',
  'invite_only'
);
SELECT is(
  (SELECT count(*) FROM public.plans
   WHERE id = '00000000-0000-4000-8000-000000000610'::uuid),
  1::bigint,
  'User B can create their own plan while blocked'
);
SELECT is(
  pg_temp.try_invite_blocked_user(
    '00000000-0000-4000-8000-000000000610'::uuid,
    '00000000-0000-4000-8000-000000000501'::uuid
  ),
  0,
  'User B cannot invite blocked User A to a new plan'
);
SELECT is(
  pg_temp.try_accept_blocked_invitation(
    '00000000-0000-4000-8000-000000000601'::uuid,
    '00000000-0000-4000-8000-000000000502'::uuid
  ),
  0,
  'User B cannot accept User A pending invitation while blocked'
);
SELECT is(
  pg_temp.try_join_blocked_open_plan(
    '00000000-0000-4000-8000-000000000605'::uuid,
    '00000000-0000-4000-8000-000000000502'::uuid
  ),
  0,
  'User B cannot join User A Open Plan while blocked'
);
SELECT is(
  pg_temp.try_send_blocked_message(
    '00000000-0000-4000-8000-000000000502'::uuid,
    'Message sent while blocked by B'
  ),
  0,
  'User B cannot send a message to the blocked conversation'
);

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM public.plans
   WHERE id IN (
     '00000000-0000-4000-8000-000000000609'::uuid,
     '00000000-0000-4000-8000-000000000610'::uuid
   )),
  2::bigint,
  'Both new host-owned plan fixtures were created'
);
SELECT is(
  (SELECT count(*) FROM public.plan_members
   WHERE (plan_id = '00000000-0000-4000-8000-000000000609'::uuid
          AND profile_id = '00000000-0000-4000-8000-000000000502'::uuid)
      OR (plan_id = '00000000-0000-4000-8000-000000000610'::uuid
          AND profile_id = '00000000-0000-4000-8000-000000000501'::uuid)),
  0::bigint,
  'Blocked invite attempts do not create membership rows'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000502';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000502","role":"authenticated","aud":"authenticated"}';

DELETE FROM public.blocks
WHERE blocker_id = '00000000-0000-4000-8000-000000000501'::uuid
  AND blocked_id = '00000000-0000-4000-8000-000000000502'::uuid;

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM public.blocks
   WHERE blocker_id = '00000000-0000-4000-8000-000000000501'::uuid
     AND blocked_id = '00000000-0000-4000-8000-000000000502'::uuid),
  1::bigint,
  'Block remains after blocked user attempts to remove it'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000501';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000501","role":"authenticated","aud":"authenticated"}';

DELETE FROM public.blocks
WHERE blocker_id = '00000000-0000-4000-8000-000000000501'::uuid
  AND blocked_id = '00000000-0000-4000-8000-000000000502'::uuid;

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM public.blocks
   WHERE blocker_id = '00000000-0000-4000-8000-000000000501'::uuid
     AND blocked_id = '00000000-0000-4000-8000-000000000502'::uuid),
  0::bigint,
  'Block record is removed after owner unblocks User B'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000501';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000501","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.connections
   WHERE requester_id = '00000000-0000-4000-8000-000000000501'::uuid
     AND addressee_id = '00000000-0000-4000-8000-000000000502'::uuid
     AND status = 'accepted'),
  1::bigint,
  'User A can see the existing connection after unblock'
);
SELECT is(
  (SELECT count(*) FROM public.profiles
   WHERE id = '00000000-0000-4000-8000-000000000502'::uuid),
  1::bigint,
  'User A can retrieve User B profile after unblock'
);
SELECT is(
  (SELECT count(*) FROM public.availability
   WHERE profile_id = '00000000-0000-4000-8000-000000000502'::uuid
     AND available_date = current_date),
  1::bigint,
  'User A can see User B availability after unblock'
);
SELECT is(
  (SELECT count(*) FROM public.plans
   WHERE id = '00000000-0000-4000-8000-000000000602'::uuid),
  1::bigint,
  'User A can access existing member plan hosted by B after unblock'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = '00000000-0000-4000-8000-000000000701'::uuid),
  1::bigint,
  'User A can access existing conversation after unblock'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE id = '00000000-0000-4000-8000-000000000801'::uuid),
  1::bigint,
  'User A can read the original message after unblock'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000502';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000502","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.connections
   WHERE requester_id = '00000000-0000-4000-8000-000000000501'::uuid
     AND addressee_id = '00000000-0000-4000-8000-000000000502'::uuid
     AND status = 'accepted'),
  1::bigint,
  'User B can see the existing connection after unblock'
);
SELECT is(
  (SELECT count(*) FROM public.profiles
   WHERE id = '00000000-0000-4000-8000-000000000501'::uuid),
  1::bigint,
  'User B can retrieve User A profile after unblock'
);
SELECT is(
  (SELECT count(*) FROM public.availability
   WHERE profile_id = '00000000-0000-4000-8000-000000000501'::uuid
     AND available_date = current_date),
  1::bigint,
  'User B can see User A availability after unblock'
);
SELECT is(
  (SELECT count(*) FROM public.plans
   WHERE id = '00000000-0000-4000-8000-000000000601'::uuid),
  1::bigint,
  'User B can access existing member plan hosted by A after unblock'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = '00000000-0000-4000-8000-000000000701'::uuid),
  1::bigint,
  'User B can access existing conversation after unblock'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE id = '00000000-0000-4000-8000-000000000801'::uuid),
  1::bigint,
  'User B can read the original message after unblock'
);
SELECT is(
  pg_temp.try_accept_blocked_invitation(
    '00000000-0000-4000-8000-000000000607'::uuid,
    '00000000-0000-4000-8000-000000000502'::uuid
  ),
  1,
  'User B can accept the still-existing A invitation after unblock'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000501';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000501","role":"authenticated","aud":"authenticated"}';

SELECT is(
  pg_temp.try_accept_blocked_invitation(
    '00000000-0000-4000-8000-000000000608'::uuid,
    '00000000-0000-4000-8000-000000000501'::uuid
  ),
  1,
  'User A can accept the still-existing B invitation after unblock'
);

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM public.connections
   WHERE requester_id = '00000000-0000-4000-8000-000000000501'::uuid
     AND addressee_id = '00000000-0000-4000-8000-000000000502'::uuid
     AND status = 'accepted'),
  1::bigint,
  'Unblocking did not recreate or alter the accepted connection'
);
SELECT is(
  (SELECT count(*) FROM public.plans
   WHERE id IN (
     '00000000-0000-4000-8000-000000000601'::uuid,
     '00000000-0000-4000-8000-000000000602'::uuid,
     '00000000-0000-4000-8000-000000000603'::uuid,
     '00000000-0000-4000-8000-000000000604'::uuid,
     '00000000-0000-4000-8000-000000000605'::uuid,
     '00000000-0000-4000-8000-000000000606'::uuid,
     '00000000-0000-4000-8000-000000000607'::uuid,
     '00000000-0000-4000-8000-000000000608'::uuid,
     '00000000-0000-4000-8000-000000000609'::uuid,
     '00000000-0000-4000-8000-000000000610'::uuid
   )),
  10::bigint,
  'Unblocking leaves all plan records intact'
);
SELECT is(
  (SELECT count(*) FROM public.plan_members
   WHERE (plan_id = '00000000-0000-4000-8000-000000000601'::uuid
          AND profile_id = '00000000-0000-4000-8000-000000000502'::uuid)
      OR (plan_id = '00000000-0000-4000-8000-000000000602'::uuid
          AND profile_id = '00000000-0000-4000-8000-000000000501'::uuid)
      OR (plan_id = '00000000-0000-4000-8000-000000000607'::uuid
          AND profile_id = '00000000-0000-4000-8000-000000000502'::uuid)
      OR (plan_id = '00000000-0000-4000-8000-000000000608'::uuid
          AND profile_id = '00000000-0000-4000-8000-000000000501'::uuid)
      OR (plan_id = '00000000-0000-4000-8000-000000000609'::uuid
          AND profile_id = '00000000-0000-4000-8000-000000000502'::uuid)
      OR (plan_id = '00000000-0000-4000-8000-000000000610'::uuid
          AND profile_id = '00000000-0000-4000-8000-000000000501'::uuid)),
  4::bigint,
  'Unblocking preserves existing memberships without recreating denied invites'
);
SELECT is(
  (SELECT count(*) FROM public.conversations
   WHERE id = '00000000-0000-4000-8000-000000000701'::uuid),
  1::bigint,
  'Unblocking leaves the existing conversation intact'
);
SELECT is(
  (SELECT count(*) FROM public.messages
   WHERE id = '00000000-0000-4000-8000-000000000801'::uuid),
  1::bigint,
  'Unblocking leaves the original message intact'
);

SELECT * FROM finish();
ROLLBACK;
