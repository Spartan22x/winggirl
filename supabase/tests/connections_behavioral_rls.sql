BEGIN;

DO $fixture_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id IN (
      '00000000-0000-4000-8000-000000000201'::uuid,
      '00000000-0000-4000-8000-000000000202'::uuid,
      '00000000-0000-4000-8000-000000000203'::uuid
    )
      OR lower(email) IN (
        'winggirl-connections-alice@example.invalid',
        'winggirl-connections-bea@example.invalid',
        'winggirl-connections-cara@example.invalid'
      )
  ) THEN
    RAISE EXCEPTION
      'Connection RLS fixture collision: a synthetic user ID or email already exists.';
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
    '00000000-0000-4000-8000-000000000201',
    'authenticated',
    'authenticated',
    'winggirl-connections-alice@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Connections Alice"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    'authenticated',
    'authenticated',
    'winggirl-connections-bea@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Connections Bea"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000203',
    'authenticated',
    'authenticated',
    'winggirl-connections-cara@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Connections Cara"}',
    now(),
    now(),
    false
  );

SELECT plan(9);

SELECT is(
  (SELECT count(*) FROM public.profiles
   WHERE id IN (
     '00000000-0000-4000-8000-000000000201'::uuid,
     '00000000-0000-4000-8000-000000000202'::uuid,
     '00000000-0000-4000-8000-000000000203'::uuid
   )),
  3::bigint,
  'Auth trigger creates all three fixture profiles'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000201';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000201","role":"authenticated","aud":"authenticated"}';

SELECT is(
  public.request_connection('00000000-0000-4000-8000-000000000202'::uuid),
  'requested',
  'Alice creates a request to Bea through the RPC'
);
SELECT is(
  (SELECT count(*) FROM public.connections
   WHERE requester_id = '00000000-0000-4000-8000-000000000201'::uuid
     AND addressee_id = '00000000-0000-4000-8000-000000000202'::uuid
     AND status = 'pending'),
  1::bigint,
  'Exactly one pending Alice-to-Bea connection exists'
);
SELECT is(
  (SELECT count(*) FROM public.connections
   WHERE requester_id = '00000000-0000-4000-8000-000000000201'::uuid
     AND addressee_id = '00000000-0000-4000-8000-000000000202'::uuid),
  1::bigint,
  'Alice can read the pending connection'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000202';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000202","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.connections
   WHERE requester_id = '00000000-0000-4000-8000-000000000201'::uuid
     AND addressee_id = '00000000-0000-4000-8000-000000000202'::uuid),
  1::bigint,
  'Bea can read the pending connection'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000203';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000203","role":"authenticated","aud":"authenticated"}';

SELECT is(
  (SELECT count(*) FROM public.connections
   WHERE requester_id = '00000000-0000-4000-8000-000000000201'::uuid
     AND addressee_id = '00000000-0000-4000-8000-000000000202'::uuid),
  0::bigint,
  'Cara cannot read Alice and Bea connection'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000201';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000201","role":"authenticated","aud":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO public.connections (requester_id, addressee_id, status)
    VALUES (
      '00000000-0000-4000-8000-000000000201'::uuid,
      '00000000-0000-4000-8000-000000000203'::uuid,
      'pending'
    )$$,
  '42501',
  'permission denied for table connections',
  'Alice cannot directly insert a connection'
);
SELECT throws_ok(
  $$UPDATE public.connections
    SET status = 'accepted'
    WHERE requester_id = '00000000-0000-4000-8000-000000000201'::uuid
      AND addressee_id = '00000000-0000-4000-8000-000000000202'::uuid$$,
  '42501',
  'permission denied for table connections',
  'Alice cannot directly update a connection'
);
SELECT throws_ok(
  $$DELETE FROM public.connections
    WHERE requester_id = '00000000-0000-4000-8000-000000000201'::uuid
      AND addressee_id = '00000000-0000-4000-8000-000000000202'::uuid$$,
  '42501',
  'permission denied for table connections',
  'Alice cannot directly delete a connection'
);

SELECT * FROM finish();
ROLLBACK;
