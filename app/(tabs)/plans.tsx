import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ActivityCard, BottomSheet, Card, EmptyState, Modal, PlanCard, PrimaryButton, Screen, SecondaryButton, SectionHeader, Text } from '@/src/components';
import { createPlan, getActivities, getLocations, getPlans, getPublicProfiles } from '@/src/data/api';
import type { PlanItem, UserProfile } from '@/src/data/types';
import { useAuth } from '@/src/auth/AuthProvider';
import { getPlanDateTimeOptions } from '@/src/lib/planDateTime';
import { colors, radii, spacing } from '@/src/theme';

const normalizeActivityChoice = (activity?: string) => {
  if (!activity) return activity;
  if (activity === 'Fitness') return 'Workout';
  if (activity === 'Live music') return 'Music';
  if (activity === 'Something spontaneous') return 'Something Fun';
  return activity;
};

const buildEmptyDraft = (location = '', defaultDateTime = getPlanDateTimeOptions()[0]) => ({
  time: defaultDateTime.label,
  startsAt: defaultDateTime.startsAt,
  activity: 'Dinner',
  invitees: [] as string[],
  location,
  note: '',
});

export default function PlansScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ activity?: string | string[]; invitee?: string | string[]; composerRequestId?: string | string[] }>();
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [locations, setLocations] = useState<{ name: string; area: string; vibe: string; note: string }[]>([]);
  const [dateTimeOptions, setDateTimeOptions] = useState(() => getPlanDateTimeOptions());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => buildEmptyDraft('', dateTimeOptions[0]));
  const userById = useMemo(() => new Map(users.map((profile) => [profile.id, profile])), [users]);

  const activityParam = normalizeActivityChoice(Array.isArray(params.activity) ? params.activity[0] : params.activity);
  const inviteeParam = Array.isArray(params.invitee) ? params.invitee[0] : params.invitee;
  const composerRequestId = Array.isArray(params.composerRequestId) ? params.composerRequestId[0] : params.composerRequestId;

  const resetDraft = (nextLocation = locations[0]?.name ?? '') => {
    const nextOptions = getPlanDateTimeOptions();
    setDateTimeOptions(nextOptions);
    setDraft(buildEmptyDraft(nextLocation, nextOptions[0]));
  };

  const closeComposer = () => {
    setShowDiscardConfirm(false);
    setSheetOpen(false);
    setStep(0);
    resetDraft(locations[0]?.name ?? '');
  };

  const startComposer = useCallback((activity = 'Dinner', inviteeId?: string) => {
    const nextOptions = getPlanDateTimeOptions();
    setDateTimeOptions(nextOptions);
    setShowDiscardConfirm(false);
    setStep(0);
    setDraft({
      ...buildEmptyDraft(locations[0]?.name ?? '', nextOptions[0]),
      activity: normalizeActivityChoice(activity) ?? 'Dinner',
      invitees: inviteeId ? [inviteeId] : [],
    });
    setSheetOpen(true);
  }, [locations]);

  useEffect(() => {
    if (!locations.length) return;
    setDraft((current) => ({ ...current, location: current.location || locations[0]?.name || '' }));
  }, [locations]);

  const hasMeaningfulDraft = draft.startsAt !== dateTimeOptions[0]?.startsAt || draft.activity !== 'Dinner' || draft.invitees.length > 0 || draft.location !== '' || draft.note !== '';

  const loadPlansData = useCallback(async () => {
    if (!user) return;
    const [nextPlans, nextActivities, nextUsers, nextLocations] = await Promise.all([
      getPlans(user.id),
      getActivities(),
      getPublicProfiles(user.id),
      getLocations(),
    ]);

    setPlans(nextPlans);
    setActivities(nextActivities.map((activity) => normalizeActivityChoice(activity) ?? activity));
    setUsers(nextUsers);
    setLocations(nextLocations);
    setDraft((current) => ({ ...current, location: current.location || nextLocations[0]?.name || '' }));
  }, [user]);

  useEffect(() => {
    void loadPlansData();
  }, [loadPlansData]);

  useFocusEffect(useCallback(() => {
    void loadPlansData();
  }, [loadPlansData]));

  useEffect(() => {
    if (!composerRequestId && !activityParam && !inviteeParam) return;
    startComposer(activityParam, inviteeParam);
    router.setParams({ activity: undefined, invitee: undefined, composerRequestId: undefined });
  }, [activityParam, composerRequestId, inviteeParam, router, startComposer]);

  const upcomingPlans = useMemo(() => plans.filter((plan) => {
    const isEligibleStatus = plan.status === 'upcoming' || plan.status === 'invited' || plan.status === 'joined';
    const isParticipating = plan.isHost || plan.currentUserStatus === 'joined';
    return isEligibleStatus && isParticipating && new Date(plan.startsAt).getTime() > Date.now();
  }), [plans]);
  const invitations = useMemo(() => plans.filter((plan) => {
    const isEligibleStatus = plan.status === 'upcoming' || plan.status === 'invited' || plan.status === 'joined';
    return isEligibleStatus && plan.currentUserStatus === 'invited' && new Date(plan.startsAt).getTime() > Date.now();
  }), [plans]);
  const pastPlans = useMemo(() => plans.filter((plan) => plan.status === 'past' || plan.status === 'cancelled' || new Date(plan.startsAt).getTime() <= Date.now()), [plans]);

  const advanceStep = () => setStep((value) => Math.min(value + 1, 5));
  const previousStep = () => setStep((value) => Math.max(value - 1, 0));

  const handleCancelRequest = () => {
    if (!hasMeaningfulDraft) {
      closeComposer();
      return;
    }
    setShowDiscardConfirm(true);
  };

  const handleDiscardPlan = () => {
    closeComposer();
  };

  const handleCreatePlan = async () => {
    if (!user) return;
    const selectedInvitees = draft.invitees.map((profileId) => ({ profile_id: profileId, status: 'invited' as const }));
    await createPlan(user.id, { startsAt: draft.startsAt, activity: draft.activity, invitees: selectedInvitees, location: draft.location, note: draft.note });
    setPlans(await getPlans(user.id));
    closeComposer();
  };

  const renderDraftStep = () => {
    if (step === 0) {
      return (
        <View>
          <Text variant="title" style={styles.sheetTitle}>Choose a date and time</Text>
          <ScrollView style={styles.dateOptionsScroll} contentContainerStyle={styles.grid} showsVerticalScrollIndicator>
            {dateTimeOptions.map((option) => (
              <Pressable key={option.startsAt} onPress={() => setDraft((current) => ({ ...current, time: option.label, startsAt: option.startsAt }))} style={[styles.optionCard, draft.startsAt === option.startsAt && styles.optionSelected]}>
                <Text variant="title" style={[styles.optionText, draft.startsAt === option.startsAt && styles.optionSelectedText]}>{option.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      );
    }

    if (step === 1) {
      return (
        <View>
          <Text variant="title" style={styles.sheetTitle}>Choose an activity</Text>
          <View style={styles.activityGrid}>
            {activities.map((activity) => (
              <ActivityCard key={activity} label={activity} selected={draft.activity === activity} onPress={() => setDraft((current) => ({ ...current, activity }))} />
            ))}
          </View>
        </View>
      );
    }

    if (step === 2) {
      return (
        <View>
          <Text variant="title" style={styles.sheetTitle}>Who are you inviting?</Text>
          <View style={styles.inviteeList}>
            {users.map((invitee) => (
              <Pressable
                key={invitee.id}
                onPress={() => setDraft((current) => ({
                  ...current,
                  invitees: current.invitees.includes(invitee.id)
                    ? current.invitees.filter((profileId) => profileId !== invitee.id)
                    : [...current.invitees, invitee.id],
                }))}
                style={[styles.inviteeCard, draft.invitees.includes(invitee.id) && styles.optionSelected]}
              >
                <Text style={[styles.inviteeText, draft.invitees.includes(invitee.id) && styles.optionSelectedText]}>{invitee.firstName}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    if (step === 3) {
      return (
        <View>
          <Text variant="title" style={styles.sheetTitle}>Pick a location</Text>
          <ScrollView style={styles.locationOptionsScroll} contentContainerStyle={styles.grid} showsVerticalScrollIndicator>
            {locations.map((location) => (
              <Pressable key={location.name} onPress={() => setDraft((current) => ({ ...current, location: location.name }))} style={[styles.locationCard, draft.location === location.name && styles.optionSelected]}>
                <Text variant="title" style={[styles.locationTitle, draft.location === location.name && styles.optionSelectedText]}>{location.name}</Text>
                <Text style={styles.locationMeta}>{location.area} • {location.vibe}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput value={draft.note} onChangeText={(note) => setDraft((current) => ({ ...current, note }))} placeholder="Add a description (optional)" multiline maxLength={1000} style={[styles.descriptionInput, styles.noteInput]} />
        </View>
      );
    }

    const selectedInvitees = draft.invitees.map((profileId) => userById.get(profileId)?.firstName ?? 'Guest');

    return (
      <View>
        <Text variant="title" style={styles.sheetTitle}>Review</Text>
        <Card style={styles.reviewCard}>
          <Text style={styles.reviewLine}><Text style={styles.reviewLabel}>When:</Text> {draft.time}</Text>
          <Text style={styles.reviewLine}><Text style={styles.reviewLabel}>Activity:</Text> {draft.activity}</Text>
          <Text style={styles.reviewLine}><Text style={styles.reviewLabel}>Invitees:</Text> {selectedInvitees.join(', ') || 'Nobody yet'}</Text>
          <Text style={styles.reviewLine}><Text style={styles.reviewLabel}>Location:</Text> {draft.location}</Text>
          {draft.note ? <Text style={styles.reviewLine}><Text style={styles.reviewLabel}>Description:</Text> {draft.note}</Text> : null}
        </Card>
      </View>
    );
  };

  return (
    <Screen>
      <Text variant="label" style={styles.eyebrow}>MAKE IT HAPPEN</Text>
      <Text variant="display">Plans</Text>
      <Text style={styles.intro}>The good stuff happens when someone makes the first move.</Text>
      <PrimaryButton label="Create a plan" onPress={() => startComposer()} style={styles.button} />

      <SectionHeader title="Upcoming" action="THIS WEEK" />
      {upcomingPlans.length > 0 ? upcomingPlans.map((plan) => (
        <PlanCard key={plan.id} title={plan.title} date={plan.date} time={plan.time} activity={plan.activity} location={plan.location} attendees={plan.attendees} status={plan.status} membershipStatus={plan.currentUserStatus} isHost={plan.isHost} onPress={() => router.push({ pathname: '/plan/[id]', params: { id: plan.id } })} />
      )) : <EmptyState title="Nothing on the calendar yet" message="Start with something easy: coffee, a walk, or a spontaneous yes." icon="✦" /> }

      <SectionHeader title="Invitations" action="NEW" />
      {invitations.length > 0 ? invitations.map((plan) => (
        <PlanCard key={plan.id} title={plan.title} date={plan.date} time={plan.time} activity={plan.activity} location={plan.location} attendees={plan.attendees} status={plan.status} membershipStatus={plan.currentUserStatus} isHost={plan.isHost} onPress={() => router.push({ pathname: '/plan/[id]', params: { id: plan.id } })} />
      )) : <EmptyState title="No invites yet" message="Your best plans are still waiting to be made." icon="✦" /> }

      <SectionHeader title="Past plans" action="ARCHIVE" />
      {pastPlans.length > 0 ? pastPlans.map((plan) => (
        <PlanCard key={plan.id} title={plan.title} date={plan.date} time={plan.time} activity={plan.activity} location={plan.location} attendees={plan.attendees} status={plan.status} membershipStatus={plan.currentUserStatus} isHost={plan.isHost} onPress={() => router.push({ pathname: '/plan/[id]', params: { id: plan.id } })} />
      )) : <EmptyState title="No past plans" message="Your favorite catch-ups will land here." icon="✦" /> }

      <BottomSheet visible={sheetOpen} onClose={handleCancelRequest}>
        <View style={styles.sheetBody}>
          {renderDraftStep()}
          <View style={styles.stepActions}>
            {step > 0 ? <SecondaryButton label="Back" onPress={previousStep} style={styles.backButton} /> : null}
            <SecondaryButton label="Cancel" onPress={handleCancelRequest} style={styles.cancelButton} />
            {step < 4 ? <PrimaryButton label="Next" onPress={advanceStep} style={styles.primaryAction} /> : <PrimaryButton label="Create plan" onPress={handleCreatePlan} style={styles.primaryAction} />}
          </View>
        </View>
      </BottomSheet>

      <Modal visible={showDiscardConfirm} onClose={() => setShowDiscardConfirm(false)}>
        <Card style={styles.confirmCard}>
          <Text variant="title" style={styles.confirmTitle}>Discard this plan?</Text>
          <Text style={styles.confirmBody}>Your progress will be lost.</Text>
          <View style={styles.confirmActions}>
            <SecondaryButton label="Keep Editing" onPress={() => setShowDiscardConfirm(false)} style={styles.confirmSecondary} />
            <PrimaryButton label="Discard" onPress={handleDiscardPlan} style={styles.confirmPrimary} />
          </View>
        </Card>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.coralDark, marginBottom: spacing.sm },
  intro: { marginTop: spacing.sm, marginBottom: spacing.lg },
  button: { alignSelf: 'flex-start', marginBottom: spacing.xl },
  grid: { gap: spacing.md },
  dateOptionsScroll: { maxHeight: 340 },
  locationOptionsScroll: { maxHeight: 190 },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  optionCard: { backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  optionSelected: { backgroundColor: colors.coralSoft, borderColor: colors.coral },
  optionSelectedText: { color: colors.coralDark },
  optionText: { color: colors.navyMuted },
  descriptionInput: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.md, color: colors.navy, backgroundColor: colors.surface },
  noteInput: { minHeight: 88, textAlignVertical: 'top' },
  sheetBody: { minHeight: 420 },
  sheetTitle: { marginBottom: spacing.lg },
  inviteeList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  inviteeCard: { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border },
  inviteeText: { color: colors.navyMuted },
  locationCard: { backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  locationTitle: { marginBottom: 6 },
  locationMeta: { color: colors.navyMuted },
  reviewCard: { padding: spacing.md },
  reviewLine: { marginBottom: spacing.sm, color: colors.navyMuted },
  reviewLabel: { color: colors.navy, fontWeight: '700' },
  stepActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  primaryAction: { flex: 1.5 },
  backButton: { minWidth: 92, flex: 0.7 },
  cancelButton: { minWidth: 92, flex: 0.7 },
  confirmCard: { width: '100%', maxWidth: 360, borderRadius: 24, padding: spacing.lg },
  confirmTitle: { marginBottom: spacing.sm },
  confirmBody: { color: colors.navyMuted, marginBottom: spacing.lg },
  confirmActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  confirmSecondary: { flex: 1 },
  confirmPrimary: { flex: 1 },
  spacer: { flex: 1 },
});
