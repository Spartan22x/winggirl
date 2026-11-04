-- Run with Supabase's pgTAP test harness after applying migrations.
begin;
select plan(13);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'messages', 'messages table exists');
select has_table('public', 'blocks', 'blocks table exists');
select policies_are('public', 'profiles', array['profiles_read_allowed', 'profiles_update_self', 'profiles_insert_self'], 'profile policies exist');
select policies_are('public', 'messages', array['messages_read_member', 'messages_send_member'], 'message policies exist');
select policies_are('public', 'blocks', array['blocks_read_own', 'blocks_create_self', 'blocks_delete_self'], 'block policies exist');
select has_column('public', 'profiles', 'bio', 'profile bio column exists');
select has_index('public', 'messages', 'messages_conversation_id_created_at_idx', 'message ordering is indexed');
select has_table('public', 'plans', 'plans table exists');
select has_table('public', 'plan_members', 'plan members table exists');
select enum_has_labels('public', 'plan_status', array['upcoming', 'invited', 'past', 'joined', 'cancelled'], 'cancelled is a supported plan state');
select policies_are('public', 'plans', array['plans_read_member', 'plans_create_self', 'plans_update_host', 'plans_delete_host'], 'plan read and host management policies exist');
select policies_are('public', 'plan_members', array['plan_members_read_member', 'plan_members_create_host_only', 'plan_members_join_open_plan', 'plan_members_accept_invitation_or_host_update', 'plan_members_delete_host_or_joined_self'], 'membership read, host invite, acceptance, and leave policies exist');

select * from finish();
rollback;