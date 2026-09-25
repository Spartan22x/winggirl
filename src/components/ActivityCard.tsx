import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '@/src/theme';
import { Text } from './Text';

type ActivityCardProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function ActivityCard({ label, selected = false, onPress }: ActivityCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, selected && styles.selected, pressed && styles.pressed]}>
      <View style={[styles.icon, selected && styles.iconSelected]}>
        <Text variant="label" style={[styles.iconText, selected && styles.iconTextSelected]}>{label.slice(0, 1)}</Text>
      </View>
      <Text variant="label" style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: '31%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, alignItems: 'center', marginBottom: spacing.md },
  selected: { backgroundColor: colors.coralSoft, borderColor: colors.coral },
  pressed: { opacity: 0.9 },
  icon: { width: 28, height: 28, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  iconSelected: { backgroundColor: colors.surface },
  iconText: { color: colors.navy, fontSize: 12 },
  iconTextSelected: { color: colors.coralDark },
  text: { color: colors.navyMuted, textAlign: 'center' },
  textSelected: { color: colors.coralDark },
});
