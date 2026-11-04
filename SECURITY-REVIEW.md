# WingGirl SECURITY DEFINER Permission Review

## Scope and status

This review covers the execution permissions of four relationship-helper
functions and the separate `handle_new_user()` trigger function. It proposes
an ACL-only migration; it does not apply the migration or change function
bodies, RLS policies, or connection RPC permissions.

## Finding

**Medium severity — relationship information exposed through helper RPCs**

The functions below are `SECURITY DEFINER`, reside in the API-exposed `public`
schema, and accept caller-supplied identifiers. PostgreSQL grants function
execution to `PUBLIC` by default unless revoked. The local read-only catalog
audit observed effective `EXECUTE` for `anon`, `authenticated`, and
`service_role` on these helpers. An anonymous caller able to invoke these
functions can probe relationship and membership state.

| Function | Definition | Information returned |
|---|---|---|
| `public.is_blocked_between(uuid, uuid)` | `supabase/migrations/202609250001_winggirl_schema.sql` | Whether either profile has blocked the other |
| `public.is_plan_member(uuid, uuid)` | `supabase/migrations/202609250001_winggirl_schema.sql` | Whether a profile hosts or participates in a plan |
| `public.is_conversation_member(uuid, uuid)` | `supabase/migrations/202609250001_winggirl_schema.sql` | Whether a profile is a conversation member |
| `public.is_open_plan_visible_for_user(uuid, uuid)` | `supabase/migrations/202610030001_open_plans.sql` | Whether a plan is visible to a supplied profile |

Confidence: **9/10**.

## Definitions and dependencies

- `is_blocked_between(first_id, second_id)` is stable SQL, `SECURITY DEFINER`,
  with `search_path = public`; it reads `public.blocks`. It is used by the
  profile, profile-interest, availability, plan-read, and open-plan-join
  policies, by `is_open_plan_visible_for_user`, and by
  `request_connection` / `respond_to_connection`. The initial
  `connections_create_self` policy was dropped by the connection-request
  migration and is not a current dependency.
- `is_plan_member(target_plan_id, target_profile_id default auth.uid())` is
  stable SQL, `SECURITY DEFINER`, with `search_path = public`; it reads
  `public.plans` and `public.plan_members`. Current consumers include plan and
  membership read policies and the authorized conversation-member insert
  policy.
- `is_conversation_member(target_conversation_id, target_profile_id default
  auth.uid())` is stable SQL, `SECURITY DEFINER`, with `search_path = public`;
  it reads `public.conversation_members`. Conversation, conversation-member,
  and message read policies call it.
- `is_open_plan_visible_for_user(target_plan_id, target_profile_id default
  auth.uid())` is stable SQL, `SECURITY DEFINER`, with `search_path = public`;
  it reads plans and accepted connections, calls `is_blocked_between`, and is
  used by the plans read policy.
- The policy consumers apply to `authenticated`, so that role needs
  `EXECUTE` on the helpers for policy evaluation. The connection RPCs are
  `SECURITY DEFINER` and their existing permissions are managed separately in
  `202611030001_connection_requests.sql`; this proposal does not change them.
- No migration-defined `service_role` call site was identified. The proposed
  grants retain `service_role` execution to preserve trusted backend behavior
  that may exist outside the migrations. `anon` and `PUBLIC` do not need
  execution.

## `handle_new_user()` review

`public.handle_new_user()` is a `SECURITY DEFINER` trigger function invoked by
the `AFTER INSERT` trigger on `auth.users`. It inserts the new user's ID and
first-name metadata into `public.profiles`, uses schema-qualified references,
and does not construct dynamic SQL. Trigger invocation does not require
user-facing function `EXECUTE`, and direct ordinary invocation is not a
meaningful RPC path for a trigger function. Its current grant is not considered
a meaningful exposure; no permission change is recommended for it in this
remediation.

## Proposed least-privilege migration

This migration removes direct execution for `PUBLIC` and `anon`, while
explicitly retaining authenticated RLS evaluation and trusted service-role
execution. It does not modify function bodies or policies.

```sql
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
```

### Expected permission verification

The explicit `PUBLIC` ACL entry should be false; effective execution should be
false for `anon` and true for `authenticated` and `service_role`.

```sql
WITH targets AS (
  SELECT p.oid, p.oid::regprocedure AS function_name,
         COALESCE(p.proacl, acldefault('f', p.proowner)) AS acl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'is_blocked_between', 'is_plan_member',
      'is_conversation_member', 'is_open_plan_visible_for_user'
    )
)
SELECT function_name,
       EXISTS (
         SELECT 1 FROM aclexplode(acl) a
         WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
       ) AS public_execute,
       has_function_privilege('anon', oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', oid, 'EXECUTE')
         AS authenticated_execute,
       has_function_privilege('service_role', oid, 'EXECUTE')
         AS service_role_execute
FROM targets
ORDER BY function_name::text;
```

### Behavioral validation plan

1. Run existing and behavioral pgTAP tests against the local database using
   disposable local Auth users. Under `authenticated`, exercise the RLS
   policies that invoke each helper using read-only queries where possible.
   Verify profile, availability, plan, membership, conversation, and message
   access decisions.
2. Verify application-facing connection RPC permissions remain unchanged:
   `authenticated` can execute `request_connection(uuid)` and
   `respond_to_connection(uuid, boolean)`, `anon` cannot, and authenticated
   direct INSERT/UPDATE/DELETE on `public.connections` remain denied. Exercise
   request/response behavior with disposable local users.
3. For each helper, set the role to `anon` in a local test session and attempt
   a direct call using synthetic UUIDs. Each call should fail with
   `permission denied for function`. Run each expected-error check separately
   and roll back its transaction.

## Residual consideration

Authenticated users retain direct execution because the same role needs
execution for RLS policy evaluation. Consequently, these helpers remain
callable by authenticated clients in the exposed `public` schema. Preventing
that separate authenticated information-oracle access would require a broader
design, such as relocating helpers to a non-exposed schema and updating their
references; it is outside this ACL-only proposal.
