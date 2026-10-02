import { Pressable, StyleSheet, View } from 'react-native';
import type { PlanMemberStatus, PlanStatus } from '@/src/data/types';
import { colors, radii, spacing } from '@/src/theme';
import { Text } from './Text';

type PlanCardProps = {
  title: string;
  date: string;
  time: string;
  activity: string;
  location: string;
  attendees: string[];
  status: PlanStatus;
  membershipStatus?: PlanMemberStatus | null;
  isHost?: boolean;
  onPress?: () => void;
};

export function PlanCard({ title, date, time, activity, location, attendees, status, membershipStatus, isHost = false, onPress }: PlanCardProps) {
  const statusLabel = status === 'cancelled'
    ? 'Cancelled'
    : status === 'past'
      ? 'Past'
      : membershipStatus === 'invited'
        ? 'Invitation'
        : isHost
          ? 'Hosting'
          : membershipStatus === 'joined'
            ? 'Joined'
            : status === 'invited'
              ? 'Invitation'
              : 'Upcoming';

  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.headerRow}>
        <View style={styles.activityBadge}><Text variant="label" style={styles.activityText}>{activity}</Text></View>
        <Text variant="label" style={[styles.status, status === 'invited' || membershipStatus === 'invited' ? styles.invited : status === 'past' ? styles.past : status === 'cancelled' ? styles.cancelled : styles.upcoming]}>{statusLabel}</Text>
      </View>
      <Text variant="title" style={styles.title}>{title}</Text>
      <Text style={styles.meta}>{date} • {time}</Text>
      <Text style={styles.meta}>{location}</Text>
      <Text style={styles.meta}>{attendees.length ? `With ${attendees.join(', ')}` : 'No participants yet'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  pressed: { opacity: 0.9 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  activityBadge: { backgroundColor: colors.coralSoft, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  activityText: { color: colors.coralDark },
  status: { fontSize: 10, textTransform: 'uppercase' },
  invited: { color: colors.coralDark },
  past: { color: colors.inkSoft },
  cancelled: { color: colors.coralDark },
  upcoming: { color: colors.success },
  title: { marginBottom: 4 },
  meta: { color: colors.navyMuted, marginTop: 4 },
});
