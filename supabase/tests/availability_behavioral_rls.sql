BEGIN;

DO $fixture_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id IN (
      '00000000-0000-4000-8000-000000000401'::uuid,
      '00000000-0000-4000-8000-000000000402'::uuid,
      '00000000-0000-4000-8000-000000000403'::uuid
    )
      OR lower(email) IN (
        'winggirl-availability-user-a@example.invalid',
        'winggirl-availability-user-b@example.invalid',
        'winggirl-availability-user-c@example.invalid'
      )
  ) THEN
    RAISE EXCEPTION
      'Availability RLS fixture collision: a synthetic user ID or email already exists.';
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
    '00000000-0000-4000-8000-000000000401',
    'authenticated',
    'authenticated',
    'winggirl-availability-user-a@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Availability User A"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000402',
    'authenticated',
    'authenticated',
    'winggirl-availability-user-b@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Availability User B"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000403',
    'authenticated',
    'authenticated',
    'winggirl-availability-user-c@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Availability User C"}',
    now(),
    now(),
    false
  );

INSERT INTO public.availability (profile_id, available_date, is_available)
VALUES
  ('00000000-0000-4000-8000-000000000401', current_date, true),
  ('00000000-0000-4000-8000-000000000402', current_date, true),
  ('00000000-0000-4000-8000-000000000403', current_date, false);

INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES (
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000402'
);

SELECT plan(11);

SELECT is(
  (SELECT count(*) FROM public.profiles
   WHERE id IN (
     '00000000-0000-4000-8000-000000000401'::uuid,
     '00000000-0000-4000-8000-000000000402'::uuid,
     '00000000-0000-4000-8000-000000000403'::uuid
   )),
  3::bigint,
  'Auth trigger creates all three fixture profiles'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000401';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000401","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.availability
   WHERE profile_id = '00000000-0000-4000-8000-000000000401'::uuid
     AND available_date = current_date),
  1::bigint,
  'User A can read their own availability'
);
SELECT is(
  (SELECT count(*) FROM public.availability
   WHERE profile_id = '00000000-0000-4000-8000-000000000402'::uuid
     AND available_date = current_date),
  0::bigint,
  'User A cannot read the availability of the user they blocked'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000402';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000402","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.availability
   WHERE profile_id = '00000000-0000-4000-8000-000000000402'::uuid
     AND available_date = current_date),
  1::bigint,
  'User B can read their own availability'
);
SELECT is(
  (SELECT count(*) FROM public.availability
   WHERE profile_id = '00000000-0000-4000-8000-000000000401'::uuid
     AND available_date = current_date),
  0::bigint,
  'User B cannot read the availability of the user who blocked them'
);
SELECT is(
  (SELECT count(*) FROM public.availability
   WHERE profile_id = '00000000-0000-4000-8000-000000000403'::uuid
     AND available_date = current_date),
  0::bigint,
  'User B cannot read User C unavailable record'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000403';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000403","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.availability
   WHERE profile_id = '00000000-0000-4000-8000-000000000401'::uuid
     AND available_date = current_date),
  1::bigint,
  'Unblocked User C can read User A available record'
);
SELECT is(
  (SELECT count(*) FROM public.availability
   WHERE profile_id = '00000000-0000-4000-8000-000000000403'::uuid
     AND available_date = current_date),
  1::bigint,
  'User C can read their own unavailable record'
);
SELECT is(
  (SELECT count(*) FROM public.availability
   WHERE profile_id = '00000000-0000-4000-8000-000000000403'::uuid
     AND available_date = current_date
     AND is_available),
  0::bigint,
  'User C own unavailable record remains unavailable'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000401';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000401","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.availability
   WHERE profile_id = '00000000-0000-4000-8000-000000000403'::uuid
     AND available_date = current_date),
  0::bigint,
  'User A cannot read User C unavailable record'
);

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claim.role = 'anon';
SET LOCAL request.jwt.claim.sub = '';
SET LOCAL request.jwt.claims = '{"role":"anon","aud":"anon"}';

SELECT is(
  (SELECT count(*) FROM public.availability
   WHERE profile_id IN (
     '00000000-0000-4000-8000-000000000401'::uuid,
     '00000000-0000-4000-8000-000000000402'::uuid,
     '00000000-0000-4000-8000-000000000403'::uuid
   )
     AND available_date = current_date),
  0::bigint,
  'Anonymous role cannot read any fixture availability'
);

SELECT * FROM finish();
ROLLBACK;
