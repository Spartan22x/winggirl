DO $migration$
DECLARE
  duplicate_pairs text;
BEGIN
  SELECT string_agg(
    format('%s <-> %s (%s rows)', profile_a, profile_b, row_count),
    '; '
  )
  INTO duplicate_pairs
  FROM (
    SELECT
      LEAST(requester_id, addressee_id) AS profile_a,
      GREATEST(requester_id, addressee_id) AS profile_b,
      COUNT(*) AS row_count
    FROM public.connections
    GROUP BY 1, 2
    HAVING COUNT(*) > 1
  ) AS duplicates;

  IF duplicate_pairs IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot enforce one connection per pair; inspect and resolve these rows manually: %',
      duplicate_pairs;
  END IF;
END;
$migration$;

CREATE UNIQUE INDEX connections_unordered_pair_uidx
  ON public.connections (
    LEAST(requester_id, addressee_id),
    GREATEST(requester_id, addressee_id)
  );

DROP POLICY IF EXISTS connections_create_self ON public.connections;
DROP POLICY IF EXISTS connections_update_participant ON public.connections;
DROP POLICY IF EXISTS connections_delete_participant ON public.connections;

REVOKE INSERT (requester_id, addressee_id, status, created_at, updated_at)
  ON TABLE public.connections
  FROM PUBLIC, anon, authenticated;

REVOKE UPDATE (requester_id, addressee_id, status, created_at, updated_at)
  ON TABLE public.connections
  FROM PUBLIC, anon, authenticated;

REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.connections
  FROM PUBLIC, anon, authenticated;

GRANT SELECT
  ON TABLE public.connections
  TO authenticated;

CREATE OR REPLACE FUNCTION public.request_connection(target_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  existing_requester_id uuid;
  existing_addressee_id uuid;
  existing_status public.connection_status;
  pair_lock_key text;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  IF target_profile_id IS NULL OR target_profile_id = actor_id THEN
    RAISE EXCEPTION 'A connection request must target another profile.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = target_profile_id
  ) THEN
    RAISE EXCEPTION 'Target profile does not exist.'
      USING ERRCODE = 'P0002';
  END IF;

  pair_lock_key :=
    CASE WHEN actor_id < target_profile_id
      THEN actor_id::text
      ELSE target_profile_id::text
    END
    || ':'
    || CASE WHEN actor_id < target_profile_id
      THEN target_profile_id::text
      ELSE actor_id::text
    END;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pair_lock_key, 0)
  );

  IF public.is_blocked_between(actor_id, target_profile_id) THEN
    RAISE EXCEPTION 'Connection unavailable.'
      USING ERRCODE = '42501';
  END IF;

  SELECT c.requester_id, c.addressee_id, c.status
  INTO existing_requester_id, existing_addressee_id, existing_status
  FROM public.connections AS c
  WHERE (c.requester_id = actor_id AND c.addressee_id = target_profile_id)
     OR (c.requester_id = target_profile_id AND c.addressee_id = actor_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.connections (requester_id, addressee_id, status)
    VALUES (actor_id, target_profile_id, 'pending');

    RETURN 'requested';
  END IF;

  IF existing_status = 'accepted' THEN
    RETURN 'connected';
  END IF;

  IF existing_status = 'pending' THEN
    IF existing_requester_id = actor_id THEN
      RETURN 'outgoing_pending';
    END IF;

    RETURN 'incoming_pending';
  END IF;

  IF existing_status = 'declined' THEN
    IF existing_requester_id = actor_id THEN
      UPDATE public.connections
      SET status = 'pending'
      WHERE requester_id = existing_requester_id
        AND addressee_id = existing_addressee_id;
    ELSE
      UPDATE public.connections
      SET requester_id = actor_id,
          addressee_id = target_profile_id,
          status = 'pending'
      WHERE requester_id = existing_requester_id
        AND addressee_id = existing_addressee_id;
    END IF;

    RETURN 'requested';
  END IF;

  RAISE EXCEPTION 'Connection request could not be processed.';
END;
$function$;

CREATE OR REPLACE FUNCTION public.respond_to_connection(
  requester_profile_id uuid,
  accept_request boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  pair_lock_key text;
  existing_status public.connection_status;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  IF requester_profile_id IS NULL
     OR requester_profile_id = actor_id
     OR accept_request IS NULL THEN
    RAISE EXCEPTION 'Invalid connection response.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = requester_profile_id
  ) THEN
    RAISE EXCEPTION 'Requester profile does not exist.'
      USING ERRCODE = 'P0002';
  END IF;

  pair_lock_key :=
    CASE WHEN actor_id < requester_profile_id
      THEN actor_id::text
      ELSE requester_profile_id::text
    END
    || ':'
    || CASE WHEN actor_id < requester_profile_id
      THEN requester_profile_id::text
      ELSE actor_id::text
    END;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pair_lock_key, 0)
  );

  SELECT c.status
  INTO existing_status
  FROM public.connections AS c
  WHERE c.requester_id = requester_profile_id
    AND c.addressee_id = actor_id
  FOR UPDATE;

  IF NOT FOUND OR existing_status <> 'pending' THEN
    RAISE EXCEPTION 'Pending connection request not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF accept_request
     AND public.is_blocked_between(actor_id, requester_profile_id) THEN
    RAISE EXCEPTION 'Connection unavailable.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.connections
  SET status = CASE
    WHEN accept_request THEN 'accepted'::public.connection_status
    ELSE 'declined'::public.connection_status
  END
  WHERE requester_id = requester_profile_id
    AND addressee_id = actor_id
    AND status = 'pending';

  IF accept_request THEN
    RETURN 'accepted';
  END IF;

  RETURN 'declined';
END;
$function$;

REVOKE ALL
  ON FUNCTION public.request_connection(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.request_connection(uuid)
  TO authenticated;

REVOKE ALL
  ON FUNCTION public.respond_to_connection(uuid, boolean)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.respond_to_connection(uuid, boolean)
  TO authenticated;

DO $verification$
DECLARE
  participant_select_policy_condition text;
BEGIN
  IF NOT has_table_privilege(
    'authenticated',
    'public.connections',
    'SELECT'
  ) THEN
    RAISE EXCEPTION
      'authenticated must retain SELECT permission on public.connections.';
  END IF;

  IF has_table_privilege('authenticated', 'public.connections', 'INSERT')
     OR has_any_column_privilege('authenticated', 'public.connections', 'INSERT')
     OR has_table_privilege('authenticated', 'public.connections', 'UPDATE')
     OR has_any_column_privilege('authenticated', 'public.connections', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.connections', 'DELETE') THEN
    RAISE EXCEPTION
      'authenticated must not retain direct mutation privileges on public.connections.';
  END IF;

  SELECT pg_catalog.regexp_replace(
    pg_catalog.lower(policy.qual),
    '[[:space:]()"]',
    '',
    'g'
  )
  INTO participant_select_policy_condition
  FROM pg_catalog.pg_policies AS policy
  WHERE policy.schemaname = 'public'
    AND policy.tablename = 'connections'
    AND policy.policyname = 'connections_read_own'
    AND policy.cmd = 'SELECT'
    AND 'authenticated' = ANY (policy.roles);

  IF participant_select_policy_condition IS NULL THEN
    RAISE EXCEPTION
      'The authenticated SELECT policy connections_read_own must remain on public.connections.';
  END IF;

  IF participant_select_policy_condition NOT IN (
    'requester_id=auth.uidoraddressee_id=auth.uid',
    'addressee_id=auth.uidorrequester_id=auth.uid',
    'auth.uid=requester_idorauth.uid=addressee_id',
    'auth.uid=addressee_idorauth.uid=requester_id'
  ) THEN
    RAISE EXCEPTION
      'The connections_read_own policy must restrict SELECT to the authenticated requester or addressee; found: %',
      participant_select_policy_condition;
  END IF;
END;
$verification$;
