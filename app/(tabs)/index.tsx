import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Card, EmptyState, PlanCard, PrimaryButton, Screen, SectionHeader, StatusPill, Text, UserCard } from '@/src/components';
import { getAvailability, getPlans, getProfile, getPublicProfiles, setAvailability } from '@/src/data/api';
import type { PlanItem, UserProfile } from '@/src/data/types';
import { useAuth } from '@/src/auth/AuthProvider';
import { colors, radii, spacing } from '@/src/theme';

const activityShortcuts = ['Dinner', 'Drinks', 'Music', 'Workout', 'Coffee', 'Something Fun'];

const greetingText = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const currentDateLabel = () => new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase();

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<{ firstName: string; avatarColor: string } | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);

  const loadHomeData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    try {
      const [nextProfile, nextUsers, nextAvailability, nextPlans] = await Promise.all([
        getProfile(user.id),
        getPublicProfiles(user.id),
        getAvailability(user.id),
        getPlans(user.id),
      ]);

      setProfile({ firstName: nextProfile.first_name, avatarColor: nextProfile.avatar_color });
      setUsers(nextUsers);
      setIsAvailable(nextAvailability);
      setPlans(nextPlans);
    } catch (loadError) {
      console.error('Home data failed to load', loadError);
      setError("We couldn't load who's free right now.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    void loadHomeData();
  }, [loadHomeData]));

  const availableUsers = users.filter((nextUser) => nextUser.available);
  const upcomingPlans = plans.filter((plan) => {
    const isUpcomingStatus = plan.status === 'upcoming' || plan.status === 'joined';
    if (!isUpcomingStatus) return false;
    return new Date(plan.startsAt).getTime() > Date.now();
  }).slice(0, 2);

  const handlePlanShortcut = (activity: string, invitee?: string) => {
    router.push({
      pathname: '/(tabs)/plans',
      params: {
        activity,
        ...(invitee ? { invitee } : {}),
      },
    });
  };

  const toggleAvailability = async () => {
    if (!user) return;

    const nextValue = !isAvailable;
    setIsUpdatingAvailability(true);
    setIsAvailable(nextValue);
    setNotice(nextValue ? "You're on the list! 💃" : "You're no longer showing as available tonight.");

    try {
      await setAvailability(user.id, nextValue);
      await loadHomeData();
    } catch (toggleError) {
      console.error('Availability update failed', toggleError);
      setIsAvailable(!nextValue);
      setNotice('We could not update your availability right now. Please try again.');
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text variant="label" style={styles.eyebrow}>{currentDateLabel()}</Text>
          <Text variant="display" style={styles.greeting}>{greetingText()}, {profile?.firstName ?? 'there'}</Text>
        </View>
        <Avatar label={(profile?.firstName ?? 'W').slice(0, 1)} color={profile?.avatarColor ?? colors.navy} size={48} />
      </View>

      {notice ? (
        <Card style={styles.noticeCard}>
          <Text style={styles.noticeText}>{notice}</Text>
        </Card>
      ) : null}

      <Card style={styles.availabilityCard}>
        <View style={styles.availabilityTop}>
          <View style={styles.iconCircle}><Ionicons name="sparkles" size={20} color={colors.coralDark} /></View>
          <StatusPill label={isAvailable ? 'You\'re free tonight' : 'Taking it easy'} />
        </View>

        <View style={styles.toggleRow}>
          <Text variant="title" style={styles.cardTitle}>{isAvailable ? 'You\'re available tonight' : 'You\'re not available tonight'}</Text>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Available to hang out tonight"
            accessibilityState={{ checked: isAvailable, disabled: isUpdatingAvailability }}
            accessibilityValue={{ text: isAvailable ? 'On, available tonight' : 'Off, not available tonight' }}
            aria-checked={isAvailable}
            aria-valuetext={isAvailable ? 'On, available tonight' : 'Off, not available tonight'}
            disabled={isUpdatingAvailability}
            onPress={toggleAvailability}
            style={[styles.switch, isAvailable && styles.switchOn, isUpdatingAvailability && styles.switchDisabled]}
          >
            <View style={[styles.switchThumb, isAvailable && styles.switchThumbOn]} />
          </Pressable>
        </View>

        <Text style={styles.cardBody}>{isAvailable ? 'Your WingGirls can see you\'re free.' : 'Turn on availability when you\'d like to make plans.'}</Text>
        <Text style={styles.countText}>{availableUsers.length} WingGirls are available</Text>
      </Card>

      <SectionHeader title="Who’s free tonight" action="TONIGHT" />

      {isLoading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={colors.coral} />
          <Text style={styles.loadingText}>Loading WingGirls…</Text>
        </Card>
      ) : error ? (
        <Card style={styles.errorCard}>
          <Text variant="title" style={styles.errorTitle}>We couldn’t load who’s free right now.</Text>
          <Text style={styles.errorBody}>Please try again and we’ll refresh the list.</Text>
          <PrimaryButton label="Try again" onPress={() => void loadHomeData()} style={styles.retryButton} />
        </Card>
      ) : availableUsers.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState title="No WingGirls are free yet." message="Your friends may be waiting for someone to make the first move." icon="✦" />
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList} contentContainerStyle={styles.listContent}>
          {availableUsers.map((availableUser) => (
            <UserCard
              key={availableUser.id}
              firstName={availableUser.firstName}
              age={availableUser.age}
              distance={availableUser.distance}
              interests={availableUser.interests}
              available={availableUser.available}
              avatarColor={availableUser.avatarColor}
              onPress={() => handlePlanShortcut(availableUser.activity || 'Dinner', availableUser.firstName)}
            />
          ))}
        </ScrollView>
      )}

      <SectionHeader title="Make a plan" action="NOW" />
      <View style={styles.shortcutGrid}>
        {activityShortcuts.map((activity) => (
          <Pressable key={activity} onPress={() => handlePlanShortcut(activity)} style={({ pressed }) => [styles.shortcutButton, pressed && styles.shortcutPressed]}>
            <Text variant="label" style={styles.shortcutText}>{activity}</Text>
          </Pressable>
        ))}
      </View>

      <SectionHeader title="Your plans" action={upcomingPlans.length ? 'TONIGHT' : 'NONE'} />
      {upcomingPlans.length > 0 ? (
        upcomingPlans.map((plan) => (
          <PlanCard
            key={plan.id}
            title={plan.title}
            date={plan.date}
            time={plan.time}
            activity={plan.activity}
            location={plan.location}
            attendees={plan.attendees}
            status={plan.status}
            onPress={() => handlePlanShortcut(plan.activity)}
          />
        ))
      ) : (
        <View style={styles.emptyPlansWrap}>
          <EmptyState title="No plans yet." message="Start with something easy and make the first move." icon="✦" />
          <PrimaryButton label="Make a plan" onPress={() => handlePlanShortcut('Dinner')} style={styles.emptyAction} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  headerTextWrap: { flex: 1, paddingRight: spacing.md },
  eyebrow: { color: colors.coralDark, marginBottom: spacing.sm },
  greeting: { fontSize: 28, lineHeight: 34 },
  noticeCard: { backgroundColor: colors.coralSoft, borderColor: colors.coral, marginBottom: spacing.md },
  noticeText: { color: colors.coralDark, fontWeight: '600' },
  availabilityCard: { backgroundColor: colors.navy, borderColor: colors.navy, padding: spacing.lg, marginBottom: spacing.xl },
  availabilityTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  iconCircle: { width: 38, height: 38, borderRadius: radii.pill, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  cardTitle: { color: colors.white, marginBottom: 0 },
  cardBody: { color: '#CBD2D9', marginBottom: spacing.sm },
  countText: { color: colors.white, marginBottom: spacing.lg, opacity: 0.9 },
  switch: { width: 56, height: 32, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, justifyContent: 'center', paddingHorizontal: 4 },
  switchOn: { backgroundColor: colors.coral },
  switchDisabled: { opacity: 0.6 },
  switchThumb: { width: 22, height: 22, borderRadius: 999, backgroundColor: colors.white, alignSelf: 'flex-start' },
  switchThumbOn: { alignSelf: 'flex-end' },
  loadingCard: { backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.xl },
  loadingText: { marginTop: spacing.md, color: colors.navyMuted },
  errorCard: { backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.xl },
  errorTitle: { marginBottom: spacing.sm },
  errorBody: { color: colors.navyMuted, marginBottom: spacing.lg },
  retryButton: { alignSelf: 'flex-start' },
  emptyWrap: { marginBottom: spacing.xl },
  emptyAction: { marginTop: spacing.md, alignSelf: 'flex-start' },
  horizontalList: { marginBottom: spacing.xl },
  listContent: { paddingRight: spacing.md },
  shortcutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  shortcutButton: { backgroundColor: colors.surface, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minWidth: 92, alignItems: 'center' },
  shortcutPressed: { opacity: 0.9 },
  shortcutText: { color: colors.navy },
  emptyPlansWrap: { marginBottom: spacing.xl },
});

