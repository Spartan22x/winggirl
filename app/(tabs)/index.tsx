import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Screen, StatusPill, Text } from '@/src/components';
import { colors, radii, spacing } from '@/src/theme';

export default function HomeScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text variant="label" style={styles.eyebrow}>FRIDAY, SEPTEMBER 25</Text>
          <Text variant="display" style={styles.greeting}>Good evening, Maya</Text>
        </View>
        <View style={styles.avatar}><Text variant="title" style={styles.avatarText}>M</Text></View>
      </View>

      <Card style={styles.availabilityCard}>
        <View style={styles.availabilityTop}>
          <View style={styles.iconCircle}><Ionicons name="sparkles" size={20} color={colors.coralDark} /></View>
          <StatusPill label="You are available" />
        </View>
        <Text variant="title" style={styles.cardTitle}>Make tonight count.</Text>
        <Text style={styles.cardBody}>Let your Wings know you are free and open to making a plan.</Text>
        <Button label="See who is around" onPress={() => undefined} style={styles.cardButton} />
      </Card>

      <View style={styles.sectionHeader}>
        <Text variant="title">Your evening</Text>
        <Text variant="label" style={styles.link}>VIEW ALL</Text>
      </View>
      <Card style={styles.planCard}>
        <View style={styles.planIcon}><Ionicons name="wine-outline" size={22} color={colors.coralDark} /></View>
        <View style={styles.planCopy}>
          <Text variant="label" style={styles.planLabel}>SUGGESTED PLAN</Text>
          <Text variant="title" style={styles.planTitle}>A little after-work sparkle</Text>
          <Text style={styles.planMeta}>3 Wings nearby · Tonight at 7:00 PM</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.inkSoft} />
      </Card>

      <View style={styles.sectionHeader}>
        <Text variant="title">People to say hello to</Text>
      </View>
      <View style={styles.peopleRow}>
        {['A', 'J', 'S'].map((initial, index) => (
          <View key={initial} style={[styles.personAvatar, { backgroundColor: [colors.coralSoft, '#E5EAF1', '#F2E7D7'][index] }]}>
            <Text variant="title" style={styles.personInitial}>{initial}</Text>
          </View>
        ))}
        <View style={styles.morePeople}><Text variant="label" style={styles.moreText}>+8</Text></View>
        <Text style={styles.peopleCaption}>women are open to plans nearby</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  eyebrow: { color: colors.coralDark, marginBottom: spacing.sm },
  greeting: { fontSize: 28, lineHeight: 34 },
  avatar: { width: 48, height: 48, borderRadius: radii.pill, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white },
  availabilityCard: { backgroundColor: colors.navy, borderColor: colors.navy, padding: spacing.lg, marginBottom: spacing.xl },
  availabilityTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  iconCircle: { width: 38, height: 38, borderRadius: radii.pill, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.white, marginBottom: spacing.sm },
  cardBody: { color: '#CBD2D9', marginBottom: spacing.lg },
  cardButton: { alignSelf: 'flex-start', paddingHorizontal: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  link: { color: colors.coralDark },
  planCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginBottom: spacing.xl },
  planIcon: { width: 48, height: 48, borderRadius: radii.sm, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  planCopy: { flex: 1 },
  planLabel: { color: colors.coralDark, marginBottom: 2 },
  planTitle: { fontSize: 17, lineHeight: 22, marginBottom: 2 },
  planMeta: { fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  peopleRow: { flexDirection: 'row', alignItems: 'center' },
  personAvatar: { width: 42, height: 42, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', marginRight: -8, borderWidth: 2, borderColor: colors.background },
  personInitial: { fontSize: 16 },
  morePeople: { width: 42, height: 42, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm },
  moreText: { color: colors.coralDark },
  peopleCaption: { flex: 1, marginLeft: spacing.md, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
});
