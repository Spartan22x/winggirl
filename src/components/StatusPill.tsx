import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '@/src/theme';
import { Text } from './Text';

export function StatusPill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <View style={styles.dot} />
      <Text variant="label" style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.coralSoft, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  label: { color: colors.coralDark },
});
