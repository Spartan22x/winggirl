import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '@/src/theme';
import { Avatar } from './Avatar';
import { AvailabilityIndicator } from './AvailabilityIndicator';
import { Text } from './Text';

type UserCardProps = {
  firstName: string;
  age: number;
  distance: string;
  interests: string[];
  available: boolean;
  avatarColor: string;
  onPress?: () => void;
};

export function UserCard({ firstName, age, distance, interests, available, avatarColor, onPress }: UserCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.header}>
        <Avatar label={firstName.slice(0, 1)} color={avatarColor} size={52} textColor={colors.navy} />
        <View style={styles.meta}>
          <View style={styles.nameRow}>
            <Text variant="title" style={styles.name}>{firstName}</Text>
            <Text style={styles.metaText}>{age}</Text>
          </View>
          <Text style={styles.distance}>{distance} away</Text>
        </View>
      </View>

      <View style={styles.indicatorRow}>
        <AvailabilityIndicator available={available} compact />
      </View>

      <View style={styles.tagRow}>
        {interests.slice(0, 3).map((interest) => (
          <View key={interest} style={styles.tag}><Text variant="label" style={styles.tagText}>{interest}</Text></View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, width: 220, marginRight: spacing.md },
  pressed: { opacity: 0.9 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  meta: { flex: 1, marginLeft: spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 20, lineHeight: 26 },
  metaText: { marginLeft: spacing.xs, color: colors.inkSoft },
  distance: { color: colors.inkSoft, marginTop: 2 },
  indicatorRow: { marginBottom: spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  tagText: { fontSize: 10, color: colors.navyMuted },
});
