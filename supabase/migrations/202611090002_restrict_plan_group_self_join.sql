BEGIN;

CREATE OR REPLACE FUNCTION public.is_group_conversation_join_authorized(
  target_conversation_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations AS c
    WHERE c.id = target_conversation_id
      AND c.conversation_type = 'group'
      AND c.created_by = auth.uid()
  );
$function$;

COMMIT;
