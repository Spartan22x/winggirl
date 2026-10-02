-- Run with Supabase's pgTAP test harness after applying migrations.
begin;
select plan(13);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'messages', 'messages table exists');
select has_table('public', 'blocks', 'blocks table exists');
select policies_are('public', 'profiles', 3, 'profile policies exist');
select policies_are('public', 'messages', 2, 'message policies exist');
select policies_are('public', 'blocks', 3, 'block policies exist');
select has_column('public', 'profiles', 'bio', 'profile bio column exists');
select has_index('public', 'messages', 'messages_conversation_id_created_at_idx', 'message ordering is indexed');
select has_table('public', 'plans', 'plans table exists');
select has_table('public', 'plan_members', 'plan members table exists');
select enum_has_labels('public', 'plan_status', array['upcoming', 'invited', 'past', 'joined', 'cancelled'], 'cancelled is a supported plan state');
select policies_are('public', 'plans', 4, 'plan read and host management policies exist');
select policies_are('public', 'plan_members', 4, 'membership read, host invite, acceptance, and leave policies exist');

select * from finish();
rollback;