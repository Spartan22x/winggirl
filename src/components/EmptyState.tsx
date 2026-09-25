import { View, StyleSheet } from 'react-native';
import { colors, radii, spacing } from '@/src/theme';
import { Text } from './Text';

type EmptyStateProps = {
  title: string;
  message: string;
  icon?: string;
};

export function EmptyState({ title, message, icon = '✦' }: EmptyStateProps) {
  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}><Text style={styles.icon}>{icon}</Text></View>
      <Text variant="title" style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  iconCircle: { width: 64, height: 64, borderRadius: radii.pill, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  icon: { color: colors.coralDark, fontSize: 26 },
  title: { marginBottom: spacing.sm },
  message: { textAlign: 'center', color: colors.navyMuted },
});
