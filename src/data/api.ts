import { randomUUID } from 'expo-crypto';
import { supabase } from '@/src/lib/supabase';
import type { Conversation, Message, PlanDetails, PlanItem, PlanMemberStatus, PlanOverlapCandidate, PlanParticipant, UserProfile } from './types';

type ProfileRow = { id: string; first_name: string; age: number | null; bio: string | null; avatar_color: string };
type AvailabilityRow = { profile_id: string; is_available: boolean };
type InterestLink = { profile_id: string; interests: { name: string } | null };

const today = () => new Date().toISOString().slice(0, 10);

export async function getProfile(profileId: string) {
  const { data, error } = await supabase.from('profiles').select('id, first_name, age, bio, avatar_color').eq('id', profileId).single();
  if (error) throw error;
  return data as ProfileRow;
}

export async function saveProfile(profileId: string, profile: { firstName: string; age: number; bio: string }) {
  const { error } = await supabase.from('profiles').update({ first_name: profile.firstName, age: profile.age, bio: profile.bio }).eq('id', profileId);
  if (error) throw error;
}

export async function getProfileInterests(profileId: string) {
  const { data, error } = await supabase.from('profile_interests').select('interests(name)').eq('profile_id', profileId);
  if (error) throw error;
  return (data as unknown as { interests: { name: string } | null }[]).flatMap((item) => item.interests ? [item.interests.name] : []);
}

export async function getConnectionCount(profileId: string) {
  const { count, error } = await supabase.from('connections').select('requester_id', { count: 'exact', head: true }).or(`requester_id.eq.${profileId},addressee_id.eq.${profileId}`).eq('status', 'accepted');
  if (error) throw error;
  return count ?? 0;
}

export async function getPublicProfiles(currentProfileId: string): Promise<UserProfile[]> {
  const [{ data: profiles, error: profilesError }, { data: availability, error: availabilityError }, { data: links, error: linksError }] = await Promise.all([
    supabase.from('profiles').select('id, first_name, age, bio, avatar_color').neq('id', currentProfileId),
    supabase.from('availability').select('profile_id, is_available').eq('available_date', today()),
    supabase.from('profile_interests').select('profile_id, interests(name)'),
  ]);
  if (profilesError) throw profilesError;
  if (availabilityError) throw availabilityError;
  if (linksError) throw linksError;

  const availabilityByProfile = new Map((availability as AvailabilityRow[]).map((row) => [row.profile_id, row.is_available]));
  const interestsByProfile = new Map<string, string[]>();
  (links as unknown as InterestLink[]).forEach((link) => {
    if (!link.interests) return;
    interestsByProfile.set(link.profile_id, [...(interestsByProfile.get(link.profile_id) ?? []), link.interests.name]);
  });

  return (profiles as ProfileRow[]).map((profile) => {
    const interests = interestsByProfile.get(profile.id) ?? [];
    return {
      id: profile.id,
      firstName: profile.first_name,
      age: profile.age ?? 0,
      distance: 'Nearby',
      interests,
      available: availabilityByProfile.get(profile.id) ?? false,
      bio: profile.bio ?? '',
      connections: 0,
      avatarColor: profile.avatar_color,
      activity: interests[0] ?? 'Something spontaneous',
      friends: 0,
      friendsOfFriends: false,
    };
  });
}

export async function setAvailability(profileId: string, isAvailable: boolean) {
  const { error } = await supabase.from('availability').upsert({ profile_id: profileId, available_date: today(), is_available: isAvailable });
  if (error) throw error;
}

export async function getAvailability(profileId: string) {
  const { data, error } = await supabase.from('availability').select('is_available').eq('profile_id', profileId).eq('available_date', today()).maybeSingle();
  if (error) throw error;
  return data?.is_available ?? false;
}

export async function getActivities() {
  const { data, error } = await supabase.from('interests').select('name').eq('kind', 'activity').order('name');
  if (error) throw error;

  const normalizeActivityName = (name: string) => {
    if (name === 'Fitness') return 'Workout';
    if (name === 'Live music') return 'Music';
    if (name === 'Something spontaneous') return 'Something Fun';
    return name;
  };

  return (data as { name: string }[]).map((item) => normalizeActivityName(item.name));
}

export async function getLocations() {
  const { data, error } = await supabase.from('locations').select('id, name, area, vibe, note').order('name');
  if (error) throw error;
  return data as { id: string; name: string; area: string; vibe: string; note: string }[];
}

export async function getPlans(profileId: string): Promise<PlanItem[]> {
  const { data: plans, error } = await supabase.from('plans').select('id, host_id, title, starts_at, activity, status, location_name, note').order('starts_at');
  if (error) throw error;
  const visiblePlans = plans as { id: string; host_id: string; title: string; starts_at: string; activity: PlanItem['activity']; status: PlanItem['status']; location_name: string; note: string | null }[];
  const planIds = visiblePlans.map((plan) => plan.id);
  const { data: members, error: membersError } = planIds.length
    ? await supabase.from('plan_members').select('plan_id, profile_id, status, profiles(first_name)').in('plan_id', planIds)
    : { data: [], error: null };
  if (membersError) throw membersError;
  const membersByPlan = new Map<string, { profileId: string; firstName: string; status: PlanMemberStatus }[]>();
  (members as unknown as { plan_id: string; profile_id: string; status: PlanMemberStatus; profiles: { first_name: string } | null }[]).forEach((member) => {
    membersByPlan.set(member.plan_id, [...(membersByPlan.get(member.plan_id) ?? []), { profileId: member.profile_id, firstName: member.profiles?.first_name ?? 'Participant', status: member.status }]);
  });
  return visiblePlans.filter((plan) => plan.host_id === profileId || membersByPlan.has(plan.id)).map((plan) => {
    const date = new Date(plan.starts_at);
    const membersForPlan = membersByPlan.get(plan.id) ?? [];
    const participants: PlanParticipant[] = membersForPlan.map((member) => ({
      profileId: member.profileId,
      firstName: member.firstName,
      age: null,
      avatarColor: '#172535',
      status: member.status,
    }));
    return {
      id: plan.id,
      title: plan.title,
      date: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
      startsAt: plan.starts_at,
      activity: plan.activity,
      status: plan.status,
      hostId: plan.host_id,
      isHost: plan.host_id === profileId,
      currentUserStatus: membersForPlan.find((member) => member.profileId === profileId)?.status ?? null,
      participants,
      attendees: participants.filter((member) => member.status !== 'declined').map((member) => member.firstName),
      location: plan.location_name,
      host: plan.host_id === profileId ? 'You' : 'Wing',
      note: plan.note ?? '',
    };
  });
}

export async function getPlanOverlapCandidates(profileId: string): Promise<PlanOverlapCandidate[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('id, host_id, starts_at, activity, status, plan_members(profile_id, status)')
    .in('status', ['upcoming', 'invited', 'joined'])
    .gt('starts_at', new Date().toISOString())
    .order('starts_at');
  if (error) throw error;

  const rows = data as unknown as {
    id: string;
    host_id: string;
    starts_at: string;
    activity: string;
    status: PlanItem['status'];
    plan_members: { profile_id: string; status: PlanMemberStatus }[];
  }[];

  return rows.flatMap((plan) => {
    const isHost = plan.host_id === profileId;
    const currentUserStatus = plan.plan_members.find((member) => member.profile_id === profileId)?.status ?? null;
    if (!isHost && currentUserStatus !== 'joined') return [];
    return [{ id: plan.id, activity: plan.activity, startsAt: plan.starts_at, isHost, currentUserStatus }];
  });
}

export async function getPlanDetails(planId: string, profileId: string): Promise<PlanDetails | null> {
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id, host_id, title, starts_at, activity, status, location_name, note')
    .eq('id', planId)
    .maybeSingle();
  if (planError) throw planError;
  if (!plan) return null;

  const [{ data: host, error: hostError }, { data: members, error: membersError }] = await Promise.all([
    supabase.from('profiles').select('id, first_name, age, bio, avatar_color').eq('id', plan.host_id).maybeSingle(),
    supabase.from('plan_members').select('profile_id, status, profiles(first_name, age, avatar_color)').eq('plan_id', planId),
  ]);
  if (hostError) throw hostError;
  if (membersError) throw membersError;

  const participantRows = members as unknown as { profile_id: string; status: PlanMemberStatus; profiles: { first_name: string; age: number | null; avatar_color: string } | null }[];
  const participants: PlanParticipant[] = participantRows.map((member) => ({
    profileId: member.profile_id,
    firstName: member.profiles?.first_name ?? 'Participant',
    age: member.profiles?.age ?? null,
    avatarColor: member.profiles?.avatar_color ?? '#172535',
    status: member.status,
  }));
  const date = new Date(plan.starts_at);
  const isHost = plan.host_id === profileId;

  return {
    id: plan.id,
    title: plan.title,
    date: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    time: date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    startsAt: plan.starts_at,
    activity: plan.activity,
    status: plan.status,
    hostId: plan.host_id,
    isHost,
    currentUserStatus: participantRows.find((member) => member.profile_id === profileId)?.status ?? null,
    participants,
    attendees: participants.filter((member) => member.status !== 'declined').map((member) => member.firstName),
    location: plan.location_name,
    host: isHost ? 'You' : host?.first_name ?? 'Host',
    note: plan.note ?? '',
    hostProfile: host ? {
      id: host.id,
      firstName: host.first_name,
      age: host.age,
      bio: host.bio ?? '',
      avatarColor: host.avatar_color,
    } : null,
  };
}

export async function createPlan(profileId: string, draft: { startsAt: string; activity: string; invitees: { profile_id: string; status: 'invited' }[]; location: string; note?: string }) {
  const startsAt = new Date(draft.startsAt).toISOString();
  const planId = randomUUID();
  const { error } = await supabase.from('plans').insert({ id: planId, host_id: profileId, title: `${draft.activity} with the girls`, starts_at: startsAt, activity: draft.activity, status: 'upcoming', location_name: draft.location, note: draft.note?.trim() || null });
  if (error) throw error;
  if (draft.invitees.length) {
    const { error: memberError } = await supabase.from('plan_members').insert(draft.invitees.map((invitee) => ({ plan_id: planId, profile_id: invitee.profile_id, status: invitee.status })));
    if (memberError) throw memberError;
  }
  return { id: planId };
}

export async function joinPlan(planId: string, profileId: string) {
  const { data, error } = await supabase.from('plan_members').update({ status: 'joined' }).eq('plan_id', planId).eq('profile_id', profileId).eq('status', 'invited').select('plan_id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This invitation is no longer available.');
}

export async function leavePlan(planId: string, profileId: string) {
  const { count, error } = await supabase.from('plan_members').delete({ count: 'exact' }).eq('plan_id', planId).eq('profile_id', profileId).eq('status', 'joined');
  if (error) throw error;
  if (!count) throw new Error('You are not participating in this plan.');
}

export async function updatePlan(planId: string, hostId: string, changes: { title: string; startsAt: string; activity: string; location: string; note: string }) {
  const { data, error } = await supabase.from('plans').update({
    title: changes.title.trim(),
    starts_at: new Date(changes.startsAt).toISOString(),
    activity: changes.activity,
    location_name: changes.location,
    note: changes.note.trim() || null,
  }).eq('id', planId).eq('host_id', hostId).in('status', ['upcoming', 'invited', 'joined']).gt('starts_at', new Date().toISOString()).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Only the host can edit an active upcoming plan.');
}

export async function cancelPlan(planId: string, hostId: string) {
  const { data, error } = await supabase.from('plans').update({ status: 'cancelled' }).eq('id', planId).eq('host_id', hostId).in('status', ['upcoming', 'invited', 'joined']).gt('starts_at', new Date().toISOString()).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Only the host can cancel an active upcoming plan.');
}

export async function getConversations(profileId: string): Promise<Conversation[]> {
  const { data: memberships, error: membershipError } = await supabase.from('conversation_members').select('conversation_id').eq('profile_id', profileId);
  if (membershipError) throw membershipError;
  const conversationIds = (memberships as { conversation_id: string }[]).map((membership) => membership.conversation_id);
  if (!conversationIds.length) return [];
  const [{ data: conversations, error: conversationError }, { data: messages, error: messageError }] = await Promise.all([
    supabase.from('conversations').select('id, plan_id').in('id', conversationIds),
    supabase.from('messages').select('id, conversation_id, sender_id, body, created_at').in('conversation_id', conversationIds).order('created_at'),
  ]);
  if (conversationError) throw conversationError;
  if (messageError) throw messageError;
  const senderIds = [...new Set((messages as { sender_id: string }[]).map((message) => message.sender_id))];
  const { data: senders, error: senderError } = senderIds.length ? await supabase.from('profiles').select('id, first_name').in('id', senderIds) : { data: [], error: null };
  if (senderError) throw senderError;
  const names = new Map((senders as { id: string; first_name: string }[]).map((sender) => [sender.id, sender.first_name]));
  return (conversations as { id: string; plan_id: string | null }[]).map((conversation) => {
    const conversationMessages = (messages as { id: string; conversation_id: string; sender_id: string; body: string; created_at: string }[]).filter((message) => message.conversation_id === conversation.id);
    const mappedMessages: Message[] = conversationMessages.map((message) => ({ id: message.id, sender: names.get(message.sender_id) ?? 'Wing', text: message.body, time: new Date(message.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }), me: message.sender_id === profileId }));
    return { id: conversation.id, title: mappedMessages.find((message) => !message.me)?.sender ?? 'Conversation', participants: [], unread: 0, planRelated: Boolean(conversation.plan_id), lastMessage: mappedMessages.at(-1)?.text ?? '', lastTime: mappedMessages.at(-1)?.time ?? '', messages: mappedMessages };
  });
}

export async function sendMessage(profileId: string, conversationId: string, body: string) {
  const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: profileId, body });
  if (error) throw error;
}
