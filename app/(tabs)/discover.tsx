import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { Card, Screen, Text } from '@/src/components';
import { colors, radii, spacing } from '@/src/theme';

export default function DiscoverScreen() {
  return (
    <Screen>
      <Text variant="label" style={styles.eyebrow}>FIND YOUR PEOPLE</Text>
      <Text variant="display">Discover</Text>
      <Text style={styles.intro}>Find women who share your pace, your interests, and your appetite for a good plan.</Text>
      <Card style={styles.searchCard}>
        <Ionicons name="search" size={20} color={colors.inkSoft} />
        <Text style={styles.searchText}>Search by interest or neighborhood</Text>
      </Card>
      <View style={styles.filterRow}><Text variant="label" style={styles.activeFilter}>ALL WINGS</Text><Text variant="label">NEARBY</Text><Text variant="label">INTERESTS</Text></View>
      <Card style={styles.emptyCard}>
        <View style={styles.iconCircle}><Ionicons name="compass-outline" size={28} color={colors.coralDark} /></View>
        <Text variant="title">Your next Wing is out there.</Text>
        <Text style={styles.emptyText}>Discovery will become more personal as you add interests and places you love.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.coralDark, marginBottom: spacing.sm },
  intro: { marginTop: spacing.sm, marginBottom: spacing.lg },
  searchCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginBottom: spacing.lg },
  searchText: { color: colors.inkSoft, marginLeft: spacing.sm },
  filterRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.lg },
  activeFilter: { color: colors.coralDark },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  iconCircle: { width: 64, height: 64, borderRadius: radii.pill, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  emptyText: { textAlign: 'center', marginTop: spacing.sm },
});
