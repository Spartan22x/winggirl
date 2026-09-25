import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { Card, Screen, Text } from '@/src/components';
import { colors, radii, spacing } from '@/src/theme';

export default function ProfileScreen() {
  return (
    <Screen>
      <Text variant="label" style={styles.eyebrow}>YOUR SPACE</Text>
      <Text variant="display">Profile</Text>
      <Card style={styles.profileCard}>
        <View style={styles.avatar}><Text variant="display" style={styles.avatarText}>M</Text></View>
        <Text variant="title" style={styles.name}>Maya</Text>
        <Text style={styles.location}>Brooklyn, NY</Text>
        <Text style={styles.bio}>Always up for good conversation, a long walk, and trying the place everyone is talking about.</Text>
      </Card>
      <View style={styles.row}><Ionicons name="heart-outline" size={22} color={colors.coralDark} /><Text variant="title" style={styles.rowTitle}>Interests</Text><Ionicons name="chevron-forward" size={20} color={colors.inkSoft} /></View>
      <View style={styles.row}><Ionicons name="settings-outline" size={22} color={colors.coralDark} /><Text variant="title" style={styles.rowTitle}>Settings</Text><Ionicons name="chevron-forward" size={20} color={colors.inkSoft} /></View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.coralDark, marginBottom: spacing.sm },
  profileCard: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.lg },
  avatar: { width: 82, height: 82, borderRadius: radii.pill, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  avatarText: { color: colors.white, fontSize: 30 },
  name: { marginBottom: 2 },
  location: { color: colors.coralDark, marginBottom: spacing.md },
  bio: { textAlign: 'center', maxWidth: 280 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowTitle: { flex: 1, marginLeft: spacing.md, fontSize: 17 },
});
