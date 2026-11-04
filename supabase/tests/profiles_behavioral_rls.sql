BEGIN;

DO $fixture_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id IN (
      '00000000-0000-4000-8000-000000000101'::uuid,
      '00000000-0000-4000-8000-000000000102'::uuid
    )
      OR lower(email) IN (
        'winggirl-rls-user-a@example.invalid',
        'winggirl-rls-user-b@example.invalid'
      )
  ) THEN
    RAISE EXCEPTION
      'Behavioral RLS fixture collision: a synthetic user ID or email already exists.';
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
    '00000000-0000-4000-8000-000000000101',
    'authenticated',
    'authenticated',
    'winggirl-rls-user-a@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"RLS User A"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    'authenticated',
    'authenticated',
    'winggirl-rls-user-b@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"RLS User B"}',
    now(),
    now(),
    false
  );

-- The current profile policy allows unblocked profiles to be read. This
-- relationship makes the cross-user denial assertions match the policy.
INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES (
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000102'
);

SELECT plan(6);

SELECT is(
  (SELECT count(*) FROM public.profiles
   WHERE id = '00000000-0000-4000-8000-000000000101'::uuid),
  1::bigint,
  'Auth trigger creates User A profile'
);
SELECT is(
  (SELECT count(*) FROM public.profiles
   WHERE id = '00000000-0000-4000-8000-000000000102'::uuid),
  1::bigint,
  'Auth trigger creates User B profile'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000101';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.profiles
   WHERE id = '00000000-0000-4000-8000-000000000101'::uuid),
  1::bigint,
  'User A can read their own profile'
);
SELECT is(
  (SELECT count(*) FROM public.profiles
   WHERE id = '00000000-0000-4000-8000-000000000102'::uuid),
  0::bigint,
  'User A cannot read the profile of the user who blocked them'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000102';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.profiles
   WHERE id = '00000000-0000-4000-8000-000000000102'::uuid),
  1::bigint,
  'User B can read their own profile'
);
SELECT is(
  (SELECT count(*) FROM public.profiles
   WHERE id = '00000000-0000-4000-8000-000000000101'::uuid),
  0::bigint,
  'User B cannot read the profile of the user they blocked'
);

SELECT * FROM finish();
ROLLBACK;
