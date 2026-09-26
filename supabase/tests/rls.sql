-- Run with Supabase's pgTAP test harness after applying migrations.
begin;
select plan(8);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'messages', 'messages table exists');
select has_table('public', 'blocks', 'blocks table exists');
select policies_are('public', 'profiles', 3, 'profile policies exist');
select policies_are('public', 'messages', 2, 'message policies exist');
select policies_are('public', 'blocks', 3, 'block policies exist');
select has_column('public', 'profiles', 'bio', 'profile bio column exists');
select has_index('public', 'messages', 'messages_conversation_id_created_at_idx', 'message ordering is indexed');

select * from finish();
rollback;