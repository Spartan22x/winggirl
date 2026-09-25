import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '@/src/theme';
import { Text } from './Text';

type PlanCardProps = {
  title: string;
  date: string;
  time: string;
  activity: string;
  location: string;
  attendees: string[];
  status: 'upcoming' | 'invited' | 'past' | 'joined';
  onJoin?: () => void;
  onPress?: () => void;
};

export function PlanCard({ title, date, time, activity, location, attendees, status, onJoin, onPress }: PlanCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.headerRow}>
        <View style={styles.activityBadge}><Text variant="label" style={styles.activityText}>{activity}</Text></View>
        <Text variant="label" style={[styles.status, status === 'invited' ? styles.invited : status === 'past' ? styles.past : styles.upcoming]}>{status === 'invited' ? 'Invitation' : status === 'past' ? 'Past' : status === 'joined' ? 'Joined' : 'Upcoming'}</Text>
      </View>
      <Text variant="title" style={styles.title}>{title}</Text>
      <Text style={styles.meta}>{date} • {time}</Text>
      <Text style={styles.meta}>{location}</Text>
      <Text style={styles.meta}>With {attendees.join(', ')}</Text>

      {status === 'invited' ? (
        <Pressable onPress={onJoin} style={styles.joinButton}><Text variant="label" style={styles.joinText}>Join plan</Text></Pressable>
      ) : null}
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
  upcoming: { color: colors.success },
  title: { marginBottom: 4 },
  meta: { color: colors.navyMuted, marginTop: 4 },
  joinButton: { marginTop: spacing.md, backgroundColor: colors.navy, borderRadius: radii.pill, paddingVertical: spacing.sm, alignItems: 'center' },
  joinText: { color: colors.white },
});
