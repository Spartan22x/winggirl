import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Screen, Text } from '@/src/components';
import { colors, spacing } from '@/src/theme';

export default function PlansScreen() {
  return (
    <Screen>
      <Text variant="label" style={styles.eyebrow}>MAKE IT HAPPEN</Text>
      <Text variant="display">Plans</Text>
      <Text style={styles.intro}>The good stuff happens when someone makes the first move.</Text>
      <Button label="Create a plan" onPress={() => undefined} style={styles.button} />
      <View style={styles.sectionHeader}><Text variant="title">Coming up</Text><Text variant="label" style={styles.muted}>THIS WEEK</Text></View>
      <Card style={styles.emptyCard}>
        <Ionicons name="calendar-outline" size={28} color={colors.coralDark} />
        <Text variant="title" style={styles.emptyTitle}>Nothing on the calendar yet</Text>
        <Text style={styles.emptyText}>Start with something easy: coffee, a walk, or a spontaneous yes.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.coralDark, marginBottom: spacing.sm },
  intro: { marginTop: spacing.sm, marginBottom: spacing.lg },
  button: { alignSelf: 'flex-start', marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  muted: { color: colors.inkSoft },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyTitle: { marginTop: spacing.md },
  emptyText: { textAlign: 'center', marginTop: spacing.sm },
});
