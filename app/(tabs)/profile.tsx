import { StyleSheet, View } from 'react-native';
import { Avatar, Card, PrimaryButton, Screen, SecondaryButton, Text } from '@/src/components';
import { currentUser } from '@/src/mockData';
import { colors, radii, spacing } from '@/src/theme';

export default function ProfileScreen() {
  return (
    <Screen>
      <Text variant="label" style={styles.eyebrow}>YOUR SPACE</Text>
      <Text variant="display">Profile</Text>

      <Card style={styles.profileCard}>
        <Avatar label={currentUser.firstName.slice(0, 1)} color={currentUser.avatarColor} size={84} textColor={colors.white} />
        <Text variant="title" style={styles.name}>{currentUser.firstName}, {currentUser.age}</Text>
        <Text style={styles.location}>Brooklyn, NY</Text>
        <Text style={styles.bio}>{currentUser.bio}</Text>
      </Card>

      <Card style={styles.infoCard}>
        <Text variant="title" style={styles.sectionTitle}>Interests</Text>
        <View style={styles.tagRow}>
          {currentUser.interests.map((interest) => (
            <View key={interest} style={styles.tag}><Text variant="label" style={styles.tagText}>{interest}</Text></View>
          ))}
        </View>
      </Card>

      <Card style={styles.infoCard}>
        <Text variant="title" style={styles.sectionTitle}>Connections</Text>
        <Text style={styles.valueText}>{currentUser.connections} local connections</Text>
      </Card>

      <Card style={styles.infoCard}>
        <Text variant="title" style={styles.sectionTitle}>Privacy settings</Text>
        <Text style={styles.valueText}>Visible to friends and friends of friends</Text>
      </Card>

      <Card style={styles.infoCard}>
        <Text variant="title" style={styles.sectionTitle}>Availability settings</Text>
        <Text style={styles.valueText}>Open to plans this week</Text>
      </Card>

      <Card style={styles.qrCard}>
        <View style={styles.qrBox}><Text style={styles.qrText}>QR</Text></View>
        <Text variant="title" style={styles.sectionTitle}>Share your profile</Text>
      </Card>

      <View style={styles.actions}>
        <SecondaryButton label="Edit Profile" onPress={() => undefined} style={styles.button} />
        <PrimaryButton label="Save changes" onPress={() => undefined} style={styles.button} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.coralDark, marginBottom: spacing.sm },
  profileCard: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.lg },
  name: { marginTop: spacing.md, marginBottom: 2 },
  location: { color: colors.coralDark, marginBottom: spacing.md },
  bio: { textAlign: 'center', maxWidth: 280, color: colors.navyMuted },
  infoCard: { padding: spacing.md, marginBottom: spacing.md },
  sectionTitle: { marginBottom: spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  tagText: { color: colors.navyMuted },
  valueText: { color: colors.navyMuted },
  qrCard: { alignItems: 'center', padding: spacing.lg, marginBottom: spacing.lg },
  qrBox: { width: 96, height: 96, backgroundColor: colors.surfaceMuted, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  qrText: { fontWeight: '700', fontSize: 22, color: colors.navy },
  actions: { flexDirection: 'row', gap: spacing.md },
  button: { flex: 1 },
});
