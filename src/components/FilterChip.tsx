import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '@/src/theme';
import { Text } from './Text';

type FilterChipProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function FilterChip({ label, active = false, onPress, style }: FilterChipProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.chip, active ? styles.active : styles.inactive, pressed && styles.pressed, style]}>
      <Text variant="label" style={[styles.label, active && styles.activeLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1 },
  active: { backgroundColor: colors.coralSoft, borderColor: colors.coralSoft },
  inactive: { backgroundColor: colors.surface, borderColor: colors.border },
  pressed: { opacity: 0.9 },
  label: { color: colors.navyMuted },
  activeLabel: { color: colors.coralDark },
});
