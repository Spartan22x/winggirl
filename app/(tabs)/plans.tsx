import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityCard, BottomSheet, Card, EmptyState, Modal, PlanCard, PrimaryButton, Screen, SecondaryButton, SectionHeader, Text } from '@/src/components';
import { createPlan, getActivities, getLocations, getPlans, getPublicProfiles, joinPlan } from '@/src/data/api';
import type { PlanItem, UserProfile } from '@/src/data/types';
import { useAuth } from '@/src/auth/AuthProvider';
import { colors, radii, spacing } from '@/src/theme';

const dateOptions = ['Thu, Sep 26 • 6:30 PM', 'Fri, Sep 27 • 7:15 PM', 'Sat, Sep 28 • 8:30 PM'];

const normalizeActivityChoice = (activity?: string) => {
  if (!activity) return activity;
  if (activity === 'Fitness') return 'Workout';
  if (activity === 'Live music') return 'Music';
  if (activity === 'Something spontaneous') return 'Something Fun';
  return activity;
};

const buildEmptyDraft = (location = '') => ({
  time: dateOptions[0],
  activity: 'Dinner',
  invitees: [] as string[],
  location,
});

export default function PlansScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ activity?: string | string[]; invitee?: string | string[] }>();
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [locations, setLocations] = useState<{ name: string; area: string; vibe: string; note: string }[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => buildEmptyDraft());
  const userById = useMemo(() => new Map(users.map((profile) => [profile.id, profile])), [users]);

  const activityParam = normalizeActivityChoice(Array.isArray(params.activity) ? params.activity[0] : params.activity);
  const inviteeParam = Array.isArray(params.invitee) ? params.invitee[0] : params.invitee;

  const resetDraft = (nextLocation = locations[0]?.name ?? '') => {
    setDraft(buildEmptyDraft(nextLocation));
  };

  const closeComposer = () => {
    setShowDiscardConfirm(false);
    setSheetOpen(false);
    setStep(0);
    resetDraft(locations[0]?.name ?? '');
  };

  useEffect(() => {
    if (!locations.length) return;
    setDraft((current) => ({ ...current, location: current.location || locations[0]?.name || '' }));
  }, [locations]);

  const hasMeaningfulDraft = draft.time !== dateOptions[0] || draft.activity !== 'Dinner' || draft.invitees.length > 0 || draft.location !== '';

  useEffect(() => {
    if (!user) return;
    Promise.all([getPlans(user.id), getActivities(), getPublicProfiles(user.id), getLocations()]).then(([nextPlans, nextActivities, nextUsers, nextLocations]) => {
      setPlans(nextPlans);
      setActivities(nextActivities.map((activity) => normalizeActivityChoice(activity) ?? activity));
      setUsers(nextUsers);
      setLocations(nextLocations);
      setDraft((current) => ({ ...current, location: current.location || nextLocations[0]?.name || '' }));
    }).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!activityParam && !inviteeParam) return;
    setSheetOpen(true);
    setDraft((current) => ({
      ...current,
      activity: activityParam || current.activity,
      invitees: inviteeParam ? Array.from(new Set([...(current.invitees || []), inviteeParam])) : current.invitees,
    }));
  }, [activityParam, inviteeParam]);

  const upcomingPlans = useMemo(() => plans.filter((plan) => plan.status === 'upcoming' || plan.status === 'joined'), [plans]);
  const invitations = useMemo(() => plans.filter((plan) => plan.status === 'invited'), [plans]);
  const pastPlans = useMemo(() => plans.filter((plan) => plan.status === 'past'), [plans]);

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
    await createPlan(user.id, { ...draft, invitees: selectedInvitees });
    setPlans(await getPlans(user.id));
    closeComposer();
  };

  const handleJoinPlan = async (planId: string) => {
    if (!user) return;
    await joinPlan(planId, user.id);
    setPlans(await getPlans(user.id));
  };

  const renderDraftStep = () => {
    if (step === 0) {
      return (
        <View>
          <Text variant="title" style={styles.sheetTitle}>Choose a date and time</Text>
          <View style={styles.grid}>
            {dateOptions.map((option) => (
              <Pressable key={option} onPress={() => setDraft((current) => ({ ...current, time: option }))} style={[styles.optionCard, draft.time === option && styles.optionSelected]}>
                <Text variant="title" style={[styles.optionText, draft.time === option && styles.optionSelectedText]}>{option}</Text>
              </Pressable>
            ))}
          </View>
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
          <View style={styles.grid}>
            {locations.map((location) => (
              <Pressable key={location.name} onPress={() => setDraft((current) => ({ ...current, location: location.name }))} style={[styles.locationCard, draft.location === location.name && styles.optionSelected]}>
                <Text variant="title" style={[styles.locationTitle, draft.location === location.name && styles.optionSelectedText]}>{location.name}</Text>
                <Text style={styles.locationMeta}>{location.area} • {location.vibe}</Text>
              </Pressable>
            ))}
          </View>
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
        </Card>
      </View>
    );
  };

  return (
    <Screen>
      <Text variant="label" style={styles.eyebrow}>MAKE IT HAPPEN</Text>
      <Text variant="display">Plans</Text>
      <Text style={styles.intro}>The good stuff happens when someone makes the first move.</Text>
      <PrimaryButton label="Create a plan" onPress={() => setSheetOpen(true)} style={styles.button} />

      <SectionHeader title="Upcoming" action="THIS WEEK" />
      {upcomingPlans.length > 0 ? upcomingPlans.map((plan) => (
        <PlanCard key={plan.id} title={plan.title} date={plan.date} time={plan.time} activity={plan.activity} location={plan.location} attendees={plan.attendees} status={plan.status} onJoin={() => handleJoinPlan(plan.id)} />
      )) : <EmptyState title="Nothing on the calendar yet" message="Start with something easy: coffee, a walk, or a spontaneous yes." icon="✦" /> }

      <SectionHeader title="Invitations" action="NEW" />
      {invitations.length > 0 ? invitations.map((plan) => (
        <PlanCard key={plan.id} title={plan.title} date={plan.date} time={plan.time} activity={plan.activity} location={plan.location} attendees={plan.attendees} status={plan.status} onJoin={() => handleJoinPlan(plan.id)} />
      )) : <EmptyState title="No invites yet" message="Your best plans are still waiting to be made." icon="✦" /> }

      <SectionHeader title="Past plans" action="ARCHIVE" />
      {pastPlans.length > 0 ? pastPlans.map((plan) => (
        <PlanCard key={plan.id} title={plan.title} date={plan.date} time={plan.time} activity={plan.activity} location={plan.location} attendees={plan.attendees} status={plan.status} />
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
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  optionCard: { backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  optionSelected: { backgroundColor: colors.coralSoft, borderColor: colors.coral },
  optionSelectedText: { color: colors.coralDark },
  optionText: { color: colors.navyMuted },
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
