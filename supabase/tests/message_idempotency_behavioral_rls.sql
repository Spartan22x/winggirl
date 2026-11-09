BEGIN;

DO $fixture_guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id IN (
      '00000000-0000-4000-8000-000000001101'::uuid,
      '00000000-0000-4000-8000-000000001102'::uuid,
      '00000000-0000-4000-8000-000000001103'::uuid
    ) OR lower(email) IN (
      'winggirl-idempotency-1@example.invalid',
      'winggirl-idempotency-2@example.invalid',
      'winggirl-idempotency-3@example.invalid'
    )
  ) THEN
    RAISE EXCEPTION 'Message idempotency fixture collision.';
  END IF;
END;
$fixture_guard$;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at, is_anonymous
)
SELECT
  ('00000000-0000-4000-8000-' || pg_catalog.lpad((1100 + number)::text, 12, '0'))::uuid,
  'authenticated', 'authenticated',
  'winggirl-idempotency-' || number || '@example.invalid',
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  pg_catalog.jsonb_build_object('first_name', 'Idempotency ' || number),
  now(), now(), false
FROM pg_catalog.generate_series(1, 3) AS numbers(number);

INSERT INTO public.connections (requester_id, addressee_id, status)
VALUES
  ('00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000001102', 'accepted'),
  ('00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000001103', 'accepted');

CREATE TEMP TABLE fixture_conversations (id uuid NOT NULL);
GRANT SELECT, INSERT ON fixture_conversations TO authenticated;
CREATE TEMP TABLE second_conversation (id uuid NOT NULL);
GRANT SELECT, INSERT ON second_conversation TO authenticated;

SELECT plan(11);

SELECT ok(has_column_privilege('authenticated', 'public.messages', 'id', 'INSERT'),
  'Authenticated role can insert explicit message IDs');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000001101';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000001101","role":"authenticated","aud":"authenticated"}';
INSERT INTO fixture_conversations VALUES (
  public.start_direct_conversation('00000000-0000-4000-8000-000000001102')
);

SELECT lives_ok(
  $$INSERT INTO public.messages (id, conversation_id, sender_id, body)
    SELECT '00000000-0000-4000-8000-000000001110', id, auth.uid(), 'Same message'
    FROM fixture_conversations$$,
  'An authorized sender can insert a message with an explicit UUID'
);
SELECT throws_ok(
  $$INSERT INTO public.messages (id, conversation_id, sender_id, body)
    SELECT '00000000-0000-4000-8000-000000001110', id, auth.uid(), 'Same message'
    FROM fixture_conversations$$,
  '23505', NULL, 'Repeating the UUID is rejected by the primary key'
);
SELECT lives_ok(
  $$INSERT INTO public.messages (id, conversation_id, sender_id, body)
    SELECT '00000000-0000-4000-8000-000000001111', id, auth.uid(), 'Same message'
    FROM fixture_conversations$$,
  'Identical text with a new UUID is a distinct message'
);
SELECT is((SELECT count(*) FROM public.messages WHERE conversation_id = (SELECT id FROM fixture_conversations)),
  2::bigint, 'The duplicate UUID did not create an extra message');
SELECT throws_ok(
  $$INSERT INTO public.messages (id, conversation_id, sender_id, body)
    SELECT '00000000-0000-4000-8000-000000001112', id,
      '00000000-0000-4000-8000-000000001102', 'Forged sender'
    FROM fixture_conversations$$,
  '42501', NULL, 'An explicit UUID does not permit sender spoofing'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000001103';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000001103","role":"authenticated","aud":"authenticated"}';
SELECT is((SELECT count(*) FROM public.messages WHERE conversation_id = (SELECT id FROM fixture_conversations)),
  0::bigint, 'A nonmember cannot read messages by UUID');
SELECT throws_ok(
  $$INSERT INTO public.messages (id, conversation_id, sender_id, body)
    SELECT '00000000-0000-4000-8000-000000001113', id, auth.uid(), 'Unauthorized'
    FROM fixture_conversations$$,
  '42501', NULL, 'An explicit UUID does not permit nonmember insertion'
);
SELECT throws_ok(
  $$INSERT INTO public.messages (id, conversation_id, sender_id, body)
    SELECT '00000000-0000-4000-8000-000000001110', id, auth.uid(), 'Same message'
    FROM fixture_conversations$$,
  '42501', NULL, 'A nonmember cannot retry a known message UUID'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000001101';
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000001101","role":"authenticated","aud":"authenticated"}';
INSERT INTO second_conversation VALUES (
  public.start_direct_conversation('00000000-0000-4000-8000-000000001103')
);
SELECT lives_ok(
  $$INSERT INTO public.messages (id, conversation_id, sender_id, body)
    SELECT '00000000-0000-4000-8000-000000001114', id, auth.uid(), 'Same message'
    FROM second_conversation$$,
  'An independent conversation can insert the same body under a new UUID'
);
SELECT is((SELECT count(*) FROM public.messages WHERE id IN (
  '00000000-0000-4000-8000-000000001110'::uuid,
  '00000000-0000-4000-8000-000000001111'::uuid,
  '00000000-0000-4000-8000-000000001114'::uuid
)), 3::bigint, 'Distinct IDs remain distinct across conversations');

RESET ROLE;
SET CONSTRAINTS ALL IMMEDIATE;
SELECT * FROM finish();
ROLLBACK;
