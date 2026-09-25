import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '@/src/theme';
import { Text } from './Text';

type AvailabilityIndicatorProps = {
  available: boolean;
  compact?: boolean;
};

export function AvailabilityIndicator({ available, compact = false }: AvailabilityIndicatorProps) {
  return (
    <View style={[styles.wrapper, available ? styles.available : styles.unavailable, compact && styles.compact]}>
      <View style={[styles.dot, available ? styles.dotAvailable : styles.dotUnavailable]} />
      <Text variant="label" style={[styles.label, available ? styles.labelAvailable : styles.labelUnavailable]}>
        {available ? 'Available' : 'Busy'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  compact: { paddingVertical: 4 },
  available: { backgroundColor: '#EAF5EE' },
  unavailable: { backgroundColor: '#F4EFEA' },
  dot: { width: 8, height: 8, borderRadius: 999 },
  dotAvailable: { backgroundColor: colors.success },
  dotUnavailable: { backgroundColor: colors.inkSoft },
  label: { fontSize: 11 },
  labelAvailable: { color: '#2D6A4F' },
  labelUnavailable: { color: colors.inkSoft },
});
