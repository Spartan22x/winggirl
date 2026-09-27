import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityCard, BottomSheet, Card, EmptyState, PlanCard, PrimaryButton, Screen, SecondaryButton, SectionHeader, Text } from '@/src/components';
import { createPlan, getActivities, getLocations, getPlans, getPublicProfiles, joinPlan } from '@/src/data/api';
import type { PlanItem, UserProfile } from '@/src/data/types';
import { useAuth } from '@/src/auth/AuthProvider';
import { colors, radii, spacing } from '@/src/theme';

const dateOptions = ['Thu, Sep 26 • 6:30 PM', 'Fri, Sep 27 • 7:15 PM', 'Sat, Sep 28 • 8:30 PM'];

export default function PlansScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ activity?: string | string[]; invitee?: string | string[] }>();
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [locations, setLocations] = useState<{ name: string; area: string; vibe: string; note: string }[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState({
    time: dateOptions[0],
    activity: 'Dinner',
    invitees: ['Jules', 'Nina'],
    location: '',
  });

  const activityParam = Array.isArray(params.activity) ? params.activity[0] : params.activity;
  const inviteeParam = Array.isArray(params.invitee) ? params.invitee[0] : params.invitee;

  useEffect(() => {
    if (!user) return;
    Promise.all([getPlans(user.id), getActivities(), getPublicProfiles(user.id), getLocations()]).then(([nextPlans, nextActivities, nextUsers, nextLocations]) => {
      setPlans(nextPlans);
      setActivities(nextActivities);
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

  const handleCreatePlan = async () => {
    if (!user) return;
    await createPlan(user.id, draft);
    setPlans(await getPlans(user.id));
    setSheetOpen(false);
    setStep(0);
    setDraft({ time: dateOptions[0], activity: activities[0] ?? 'Dinner', invitees: [], location: locations[0]?.name ?? '' });
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
              <Pressable key={invitee.id} onPress={() => setDraft((current) => ({ ...current, invitees: current.invitees.includes(invitee.firstName) ? current.invitees.filter((name) => name !== invitee.firstName) : [...current.invitees, invitee.firstName] }))} style={[styles.inviteeCard, draft.invitees.includes(invitee.firstName) && styles.optionSelected]}>
                <Text style={[styles.inviteeText, draft.invitees.includes(invitee.firstName) && styles.optionSelectedText]}>{invitee.firstName}</Text>
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

    return (
      <View>
        <Text variant="title" style={styles.sheetTitle}>Review</Text>
        <Card style={styles.reviewCard}>
          <Text style={styles.reviewLine}><Text style={styles.reviewLabel}>When:</Text> {draft.time}</Text>
          <Text style={styles.reviewLine}><Text style={styles.reviewLabel}>Activity:</Text> {draft.activity}</Text>
          <Text style={styles.reviewLine}><Text style={styles.reviewLabel}>Invitees:</Text> {draft.invitees.join(', ')}</Text>
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

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <View style={styles.sheetBody}>
          {renderDraftStep()}
          <View style={styles.stepActions}>
            {step < 4 ? <PrimaryButton label="Next" onPress={advanceStep} style={styles.primaryAction} /> : <PrimaryButton label="Create plan" onPress={handleCreatePlan} style={styles.primaryAction} />}
            {step > 0 ? (
              <SecondaryButton label="Back" onPress={previousStep} style={styles.backButton} />
            ) : (
              <SecondaryButton label="Cancel" onPress={() => setSheetOpen(false)} style={styles.backButton} />
            )}
          </View>
        </View>
      </BottomSheet>
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
  spacer: { flex: 1 },
});
