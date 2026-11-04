BEGIN;

REVOKE EXECUTE
  ON FUNCTION public.is_blocked_between(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE
  ON FUNCTION public.is_blocked_between(uuid, uuid)
  TO authenticated, service_role;

REVOKE EXECUTE
  ON FUNCTION public.is_plan_member(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE
  ON FUNCTION public.is_plan_member(uuid, uuid)
  TO authenticated, service_role;

REVOKE EXECUTE
  ON FUNCTION public.is_conversation_member(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE
  ON FUNCTION public.is_conversation_member(uuid, uuid)
  TO authenticated, service_role;

REVOKE EXECUTE
  ON FUNCTION public.is_open_plan_visible_for_user(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE
  ON FUNCTION public.is_open_plan_visible_for_user(uuid, uuid)
  TO authenticated, service_role;

COMMIT;
