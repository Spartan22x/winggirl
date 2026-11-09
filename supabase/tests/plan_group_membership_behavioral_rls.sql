BEGIN;

DO $fixture_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id BETWEEN
      '00000000-0000-4000-8000-000000001001'::uuid
      AND '00000000-0000-4000-8000-000000001009'::uuid
      OR lower(email) IN (
        SELECT 'winggirl-plan-group-' || number || '@example.invalid'
        FROM pg_catalog.generate_series(1, 9) AS numbers(number)
      )
  ) OR EXISTS (
    SELECT 1 FROM public.plans
    WHERE id = '00000000-0000-4000-8000-000000001010'::uuid
  ) THEN
    RAISE EXCEPTION 'Plan group membership fixture collision.';
  END IF;
END;
$fixture_guard$;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at, is_anonymous
)
SELECT
  ('00000000-0000-4000-8000-' || pg_catalog.lpad((1000 + number)::text, 12, '0'))::uuid,
  'authenticated',
  'authenticated',
  'winggirl-plan-group-' || number || '@example.invalid',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  pg_catalog.jsonb_build_object('first_name', 'Plan Group ' || number),
  now(),
  now(),
  false
FROM pg_catalog.generate_series(1, 9) AS numbers(number);

INSERT INTO public.plans (
  id, host_id, title, starts_at, activity, status, location_name, visibility
)
VALUES (
  '00000000-0000-4000-8000-000000001010',
  '00000000-0000-4000-8000-000000001001',
  'Membership test plan', now() + interval '30 days',
  'Coffee', 'upcoming', 'Fixture Cafe', 'invite_only'
);

INSERT INTO public.plan_members (plan_id, profile_id, status)
VALUES
  ('00000000-0000-4000-8000-000000001010', '00000000-0000-4000-8000-000000001006', 'invited'),
  ('00000000-0000-4000-8000-000000001010', '00000000-0000-4000-8000-000000001007', 'joined'),
  ('00000000-0000-4000-8000-000000001010', '00000000-0000-4000-8000-000000001008', 'declined');

INSERT INTO public.connections (requester_id, addressee_id, status)
VALUES
  ('00000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000001003', 'accepted'),
  ('00000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000001004', 'accepted');

CREATE TEMP TABLE fixture_conversations (
  fixture_name text PRIMARY KEY,
  conversation_id uuid NOT NULL
);
GRANT SELECT, INSERT ON fixture_conversations TO authenticated;

WITH created AS (
  INSERT INTO public.conversations (created_by, plan_id, conversation_type)
  VALUES (
    '00000000-0000-4000-8000-000000001002',
    '00000000-0000-4000-8000-000000001010',
    'group'
  )
  RETURNING id
)
INSERT INTO fixture_conversations SELECT 'plan_group', id FROM created;

INSERT INTO public.conversation_members (conversation_id, profile_id)
SELECT conversation_id, member_id
FROM fixture_conversations
CROSS JOIN (VALUES
  ('00000000-0000-4000-8000-000000001002'::uuid),
  ('00000000-0000-4000-8000-000000001003'::uuid),
  ('00000000-0000-4000-8000-000000001004'::uuid),
  ('00000000-0000-4000-8000-000000001005'::uuid)
) AS members(member_id)
WHERE fixture_name = 'plan_group';

INSERT INTO public.messages (conversation_id, sender_id, body)
SELECT conversation_id, '00000000-0000-4000-8000-000000001002', 'Existing group history'
FROM fixture_conversations WHERE fixture_name = 'plan_group';

CREATE FUNCTION pg_temp.try_self_join(target_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.conversation_members (conversation_id, profile_id)
  VALUES (target_id, auth.uid());
  RETURN 1;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN 0;
END;
$function$;

CREATE FUNCTION pg_temp.try_send(target_id uuid, body text)
RETURNS integer
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.messages (conversation_id, sender_id, body)
  VALUES (target_id, auth.uid(), body);
  RETURN 1;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN 0;
END;
$function$;

CREATE FUNCTION pg_temp.check_plan_nonmember(
  target_id uuid,
  label text,
  expected_plan_membership boolean DEFAULT true
)
RETURNS SETOF text
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY SELECT is(public.is_plan_member('00000000-0000-4000-8000-000000001010'::uuid),
    expected_plan_membership, label || ' has expected plan membership');
  RETURN QUERY SELECT is(public.is_group_conversation_join_authorized(target_id),
    false, label || ' is not authorized to self-join');
  RETURN QUERY SELECT is((SELECT count(*) FROM public.conversations WHERE id = target_id),
    0::bigint, label || ' cannot read the conversation');
  RETURN QUERY SELECT is((SELECT count(*) FROM public.conversation_members WHERE conversation_id = target_id),
    0::bigint, label || ' cannot read the roster');
  RETURN QUERY SELECT is((SELECT count(*) FROM public.messages WHERE conversation_id = target_id),
    0::bigint, label || ' cannot read history');
  RETURN QUERY SELECT is(pg_temp.try_self_join(target_id), 0, label || ' cannot self-join');
  RETURN QUERY SELECT is((SELECT count(*) FROM public.conversations WHERE id = target_id),
    0::bigint, label || ' cannot read the conversation after attempting to join');
  RETURN QUERY SELECT is((SELECT count(*) FROM public.conversation_members WHERE conversation_id = target_id),
    0::bigint, label || ' cannot read the roster after attempting to join');
  RETURN QUERY SELECT is((SELECT count(*) FROM public.messages WHERE conversation_id = target_id),
    0::bigint, label || ' cannot read history after attempting to join');
  RETURN QUERY SELECT is(pg_temp.try_send(target_id, 'Unauthorized send'), 0, label || ' cannot send');
END;
$function$;

SELECT plan(76);

SELECT is((SELECT prosecdef FROM pg_catalog.pg_proc WHERE oid =
  'public.is_group_conversation_join_authorized(uuid)'::regprocedure),
  true, 'Join helper remains SECURITY DEFINER');
SELECT is((SELECT pg_catalog.array_to_string(proconfig, ',') FROM pg_catalog.pg_proc WHERE oid =
  'public.is_group_conversation_join_authorized(uuid)'::regprocedure),
  'search_path=""', 'Join helper retains an empty search path');
SELECT is(pg_catalog.has_function_privilege(
  'authenticated', 'public.is_group_conversation_join_authorized(uuid)', 'EXECUTE'
), true, 'Authenticated users retain helper execution');
SELECT is(pg_catalog.has_function_privilege(
  'anon', 'public.is_group_conversation_join_authorized(uuid)', 'EXECUTE'
), false, 'Anonymous users cannot execute the join helper');
SELECT is((SELECT status::text FROM public.plan_members WHERE
  plan_id = '00000000-0000-4000-8000-000000001010'::uuid
  AND profile_id = '00000000-0000-4000-8000-000000001008'::uuid),
  'declined', 'Declined participant has a declined plan membership');
SELECT is((SELECT count(*) FROM public.plan_members WHERE
  plan_id = '00000000-0000-4000-8000-000000001010'::uuid
  AND profile_id = '00000000-0000-4000-8000-000000001009'::uuid),
  0::bigint, 'Unrelated user has no plan membership row');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000001001';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000001001","role":"authenticated","aud":"authenticated"}';
SELECT * FROM pg_temp.check_plan_nonmember(
  (SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'plan_group'), 'Plan host'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000001006';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000001006","role":"authenticated","aud":"authenticated"}';
SELECT * FROM pg_temp.check_plan_nonmember(
  (SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'plan_group'), 'Invited participant'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000001007';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000001007","role":"authenticated","aud":"authenticated"}';
SELECT * FROM pg_temp.check_plan_nonmember(
  (SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'plan_group'), 'Joined participant'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000001008';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000001008","role":"authenticated","aud":"authenticated"}';
SELECT * FROM pg_temp.check_plan_nonmember(
  (SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'plan_group'), 'Declined participant', false
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000001009';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000001009","role":"authenticated","aud":"authenticated"}';
SELECT * FROM pg_temp.check_plan_nonmember(
  (SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'plan_group'), 'Unrelated user', false
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000001003';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000001003","role":"authenticated","aud":"authenticated"}';
SELECT is((SELECT count(*) FROM public.conversations WHERE id = (
  SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'plan_group'
)), 1::bigint, 'Explicit member can read the group');
SELECT is((SELECT count(*) FROM public.conversation_members WHERE conversation_id = (
  SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'plan_group'
)), 4::bigint, 'Explicit member can read the roster');
SELECT is((SELECT count(*) FROM public.messages WHERE conversation_id = (
  SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'plan_group'
)), 1::bigint, 'Explicit member can read existing history');
SELECT is(pg_temp.try_send((SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'plan_group'),
  'Member send'), 1, 'Explicit member can send');

INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES (auth.uid(), '00000000-0000-4000-8000-000000001004');
SELECT is((SELECT count(*) FROM public.messages WHERE conversation_id = (
  SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'plan_group'
)), 2::bigint, 'Blocker retains group history');
SELECT is(pg_temp.try_send((SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'plan_group'),
  'Blocker send'), 1, 'Blocker can still send to group');

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000001004';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000001004","role":"authenticated","aud":"authenticated"}';
SELECT is((SELECT count(*) FROM public.messages WHERE conversation_id = (
  SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'plan_group'
)), 3::bigint, 'Blocked member retains group history');
SELECT is(pg_temp.try_send((SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'plan_group'),
  'Blocked member send'), 1, 'Blocked member can still send to group');

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000001002';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000001002","role":"authenticated","aud":"authenticated"}';
DELETE FROM public.conversation_members WHERE conversation_id = (
  SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'plan_group'
) AND profile_id = auth.uid();
SET CONSTRAINTS conversations_roster_check, conversation_members_roster_check IMMEDIATE;
SET CONSTRAINTS conversations_roster_check, conversation_members_roster_check DEFERRED;
SELECT is((SELECT count(*) FROM public.conversations WHERE id = (
  SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'plan_group'
)), 0::bigint, 'Creator cannot read after leaving');
SELECT is(public.is_group_conversation_join_authorized(
  (SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'plan_group')
), true, 'Creator remains authorized to restore membership');
SELECT is(pg_temp.try_self_join(
  (SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'plan_group')
), 1, 'Creator can restore their own membership');
SELECT is((SELECT count(*) FROM public.messages WHERE conversation_id = (
  SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'plan_group'
)), 4::bigint, 'Creator can read history after restoring membership');

INSERT INTO fixture_conversations (fixture_name, conversation_id)
VALUES ('connection_group', public.create_group_conversation(ARRAY[
  '00000000-0000-4000-8000-000000001003'::uuid,
  '00000000-0000-4000-8000-000000001004'::uuid
]));
SELECT is((SELECT count(*) FROM public.conversations WHERE id = (
  SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'connection_group'
) AND plan_id IS NULL), 1::bigint, 'Connection-based group creation still works');
SELECT is((SELECT count(*) FROM public.conversation_members WHERE conversation_id = (
  SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'connection_group'
)), 3::bigint, 'Connection-based group contains creator and invitees');
SELECT is(pg_temp.try_send((SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'connection_group'),
  'Connection group send'), 1, 'Connection-based group member can send');

INSERT INTO fixture_conversations (fixture_name, conversation_id)
VALUES ('direct', public.start_direct_conversation('00000000-0000-4000-8000-000000001003'));
SELECT is((SELECT count(*) FROM public.conversations WHERE id = (
  SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'direct'
)), 1::bigint, 'Accepted direct participant can read conversation');
SELECT is(pg_temp.try_send((SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'direct'),
  'Direct send'), 1, 'Accepted direct participant can send');

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000001001';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000001001","role":"authenticated","aud":"authenticated"}';
SELECT is((SELECT count(*) FROM public.conversations WHERE id = (
  SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'direct'
)), 0::bigint, 'Direct nonmember cannot read conversation');
SELECT is((SELECT count(*) FROM public.messages WHERE conversation_id = (
  SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'direct'
)), 0::bigint, 'Direct nonmember cannot read history');
SELECT is(pg_temp.try_send((SELECT conversation_id FROM fixture_conversations WHERE fixture_name = 'direct'),
  'Unauthorized direct send'), 0, 'Direct nonmember cannot send');

RESET ROLE;
SET CONSTRAINTS conversations_roster_check, conversation_members_roster_check IMMEDIATE;
SELECT * FROM finish();
ROLLBACK;
