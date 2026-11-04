BEGIN;

DO $fixture_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id IN (
      '00000000-0000-4000-8000-000000000301'::uuid,
      '00000000-0000-4000-8000-000000000302'::uuid,
      '00000000-0000-4000-8000-000000000303'::uuid,
      '00000000-0000-4000-8000-000000000304'::uuid
    )
      OR lower(email) IN (
        'winggirl-response-alice@example.invalid',
        'winggirl-response-bea@example.invalid',
        'winggirl-response-cara@example.invalid',
        'winggirl-response-dev@example.invalid'
      )
  ) THEN
    RAISE EXCEPTION
      'Connection response fixture collision: a synthetic user ID or email already exists.';
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
    '00000000-0000-4000-8000-000000000301',
    'authenticated',
    'authenticated',
    'winggirl-response-alice@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Response Alice"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000302',
    'authenticated',
    'authenticated',
    'winggirl-response-bea@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Response Bea"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000303',
    'authenticated',
    'authenticated',
    'winggirl-response-cara@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Response Cara"}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-4000-8000-000000000304',
    'authenticated',
    'authenticated',
    'winggirl-response-dev@example.invalid',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Response Dev"}',
    now(),
    now(),
    false
  );

SELECT plan(19);

SELECT is(
  (SELECT count(*) FROM public.profiles
   WHERE id IN (
     '00000000-0000-4000-8000-000000000301'::uuid,
     '00000000-0000-4000-8000-000000000302'::uuid,
     '00000000-0000-4000-8000-000000000303'::uuid,
     '00000000-0000-4000-8000-000000000304'::uuid
   )),
  4::bigint,
  'Auth trigger creates all four fixture profiles'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000301';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000301","role":"authenticated","aud":"authenticated"}';

SELECT is(
  public.request_connection('00000000-0000-4000-8000-000000000302'::uuid),
  'requested',
  'Alice creates the request that Bea will accept'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000302';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000302","role":"authenticated","aud":"authenticated"}';

SELECT is(
  public.respond_to_connection('00000000-0000-4000-8000-000000000301'::uuid, true),
  'accepted',
  'Recipient Bea accepts Alice request'
);
SELECT is(
  (SELECT count(*) FROM public.connections
   WHERE requester_id = '00000000-0000-4000-8000-000000000301'::uuid
     AND addressee_id = '00000000-0000-4000-8000-000000000302'::uuid
     AND status = 'accepted'),
  1::bigint,
  'Accepted connection retains the expected participants'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000301';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000301","role":"authenticated","aud":"authenticated"}';

SELECT is(
  public.request_connection('00000000-0000-4000-8000-000000000303'::uuid),
  'requested',
  'Alice creates a request for requester and third-party authorization checks'
);
SELECT throws_ok(
  $$SELECT public.respond_to_connection(
      '00000000-0000-4000-8000-000000000301'::uuid, true
    )$$,
  '22023',
  'Invalid connection response.',
  'Requester Alice cannot accept her own request'
);
SELECT throws_ok(
  $$SELECT public.respond_to_connection(
      '00000000-0000-4000-8000-000000000301'::uuid, false
    )$$,
  '22023',
  'Invalid connection response.',
  'Requester Alice cannot decline her own request'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000304';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000304","role":"authenticated","aud":"authenticated"}';

SELECT throws_ok(
  $$SELECT public.respond_to_connection(
      '00000000-0000-4000-8000-000000000301'::uuid, true
    )$$,
  'P0002',
  'Pending connection request not found.',
  'Unrelated Dev cannot accept Alice request to Cara'
);
SELECT throws_ok(
  $$SELECT public.respond_to_connection(
      '00000000-0000-4000-8000-000000000301'::uuid, false
    )$$,
  'P0002',
  'Pending connection request not found.',
  'Unrelated Dev cannot decline Alice request to Cara'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000301';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000301","role":"authenticated","aud":"authenticated"}';

SELECT is(
  public.request_connection('00000000-0000-4000-8000-000000000304'::uuid),
  'requested',
  'Alice creates a separate request for decline checks'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000304';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000304","role":"authenticated","aud":"authenticated"}';

SELECT is(
  public.respond_to_connection('00000000-0000-4000-8000-000000000301'::uuid, false),
  'declined',
  'Recipient Dev declines Alice request'
);
SELECT is(
  (SELECT count(*) FROM public.connections
   WHERE requester_id = '00000000-0000-4000-8000-000000000301'::uuid
     AND addressee_id = '00000000-0000-4000-8000-000000000304'::uuid
     AND status = 'declined'),
  1::bigint,
  'Declined row retains the expected participants'
);
SELECT throws_ok(
  $$SELECT public.respond_to_connection(
      '00000000-0000-4000-8000-000000000301'::uuid, true
    )$$,
  'P0002',
  'Pending connection request not found.',
  'Declined request cannot be accepted without a new pending request'
);

RESET ROLE;
INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES (
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000303'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000302';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000302","role":"authenticated","aud":"authenticated"}';

SELECT throws_ok(
  $$SELECT public.request_connection(
      '00000000-0000-4000-8000-000000000303'::uuid
    )$$,
  '42501',
  'Connection unavailable.',
  'Blocked pair cannot create a new connection request'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000303';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000303","role":"authenticated","aud":"authenticated"}';

SELECT is(
  public.request_connection('00000000-0000-4000-8000-000000000304'::uuid),
  'requested',
  'Cara creates a pending request to Dev before the block check'
);

RESET ROLE;
INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES (
  '00000000-0000-4000-8000-000000000304',
  '00000000-0000-4000-8000-000000000303'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000304';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000304","role":"authenticated","aud":"authenticated"}';

SELECT throws_ok(
  $$SELECT public.respond_to_connection(
      '00000000-0000-4000-8000-000000000303'::uuid, true
    )$$,
  '42501',
  'Connection unavailable.',
  'Blocked pending request cannot be accepted'
);
SELECT is(
  public.respond_to_connection('00000000-0000-4000-8000-000000000303'::uuid, false),
  'declined',
  'Recipient can decline a blocked pending request'
);
SELECT is(
  (SELECT count(*) FROM public.connections
   WHERE requester_id = '00000000-0000-4000-8000-000000000303'::uuid
     AND addressee_id = '00000000-0000-4000-8000-000000000304'::uuid
     AND status = 'declined'),
  0::bigint,
  'Blocked participant cannot see the declined connection through RLS'
);

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM public.connections
   WHERE requester_id = '00000000-0000-4000-8000-000000000303'::uuid
     AND addressee_id = '00000000-0000-4000-8000-000000000304'::uuid
     AND status = 'declined'),
  1::bigint,
  'Declined connection remains stored while hidden from blocked participants'
);

SELECT * FROM finish();
ROLLBACK;
