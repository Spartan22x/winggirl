import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { Avatar, Card, Modal, PrimaryButton, Screen, SecondaryButton, Text } from '@/src/components';
import { getConnectionCount, getProfile, getProfileInterests, saveProfile } from '@/src/data/api';
import { useAuth } from '@/src/auth/AuthProvider';
import { colors, radii, spacing } from '@/src/theme';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<{ firstName: string; age: number | null; bio: string; avatarColor: string } | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [connectionCount, setConnectionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [nextProfile, nextInterests, nextConnectionCount] = await Promise.all([getProfile(user.id), getProfileInterests(user.id), getConnectionCount(user.id)]);
      setProfile({ firstName: nextProfile.first_name, age: nextProfile.age, bio: nextProfile.bio ?? '', avatarColor: nextProfile.avatar_color });
      setInterests(nextInterests);
      setConnectionCount(nextConnectionCount);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const openEditor = () => {
    if (!profile) return;
    setFirstName(profile.firstName);
    setAge(profile.age?.toString() ?? '');
    setBio(profile.bio);
    setSaveMessage('');
    setSaveError(false);
    setEditing(true);
  };

  const saveChanges = async () => {
    if (!user || !firstName.trim() || !age.trim()) {
      setSaveMessage('Enter your first name and age to continue.');
      setSaveError(true);
      return;
    }
    setSaving(true);
    setSaveMessage('');
    setSaveError(false);
    try {
      await saveProfile(user.id, { firstName: firstName.trim(), age: Number(age), bio: bio.trim() });
      await loadProfile();
      setEditing(false);
      setSaveMessage('Profile saved.');
    } catch {
      setSaveMessage('Something went wrong saving your profile. Please try again.');
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Screen contentContainerStyle={styles.stateContainer}><ActivityIndicator color={colors.coral} /><Text style={styles.stateText}>Loading your profile...</Text></Screen>;

  if (loadError || !profile) return <Screen contentContainerStyle={styles.stateContainer}>
    <Text variant="title">Something went wrong loading your profile.</Text>
    <SecondaryButton label="Try again" onPress={() => void loadProfile()} style={styles.retryButton} />
  </Screen>;

  return (
    <Screen>
      <Text variant="label" style={styles.eyebrow}>YOUR SPACE</Text>
      <Text variant="display">Profile</Text>

      <Card style={styles.profileCard}>
        <Avatar label={profile.firstName.slice(0, 1)} color={profile.avatarColor} size={84} textColor={colors.white} />
        <Text variant="title" style={styles.name}>{profile.firstName}, {profile.age}</Text>
        <Text style={styles.location}>Location kept private</Text>
        <Text style={styles.bio}>{profile.bio}</Text>
      </Card>

      <Card style={styles.infoCard}>
        <Text variant="title" style={styles.sectionTitle}>Interests</Text>
        <View style={styles.tagRow}>
          {interests.map((interest) => (
            <View key={interest} style={styles.tag}><Text variant="label" style={styles.tagText}>{interest}</Text></View>
          ))}
        </View>
      </Card>

      <Card style={styles.infoCard}>
        <Text variant="title" style={styles.sectionTitle}>Connections</Text>
        <Text style={styles.valueText}>{connectionCount} local connections</Text>
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
        <SecondaryButton label="Edit Profile" onPress={openEditor} style={styles.button} />
      </View>
      {saveMessage ? <Text style={[styles.saveMessage, saveError && styles.saveError]}>{saveMessage}</Text> : null}
      <SecondaryButton label="Sign out" onPress={signOut} style={styles.signOutButton} />

      <Modal visible={editing} onClose={() => { if (!saving) setEditing(false); }}>
        <Card style={styles.editCard}>
          <Text variant="title" style={styles.editTitle}>Edit profile</Text>
          {saveMessage && saveError ? <Text style={styles.saveError}>{saveMessage}</Text> : null}
          <Text style={styles.inputLabel}>First name</Text>
          <TextInput value={firstName} onChangeText={setFirstName} style={styles.input} autoCapitalize="words" />
          <Text style={styles.inputLabel}>Age</Text>
          <TextInput value={age} onChangeText={setAge} style={styles.input} keyboardType="number-pad" />
          <Text style={styles.inputLabel}>Bio</Text>
          <TextInput value={bio} onChangeText={setBio} style={[styles.input, styles.bioInput]} multiline />
          <Text style={styles.inputLabel}>Interests</Text>
          <View style={styles.tagRow}>
            {interests.map((interest) => <View key={interest} style={styles.tag}><Text variant="label" style={styles.tagText}>{interest}</Text></View>)}
          </View>
          <View style={styles.editActions}>
            <PrimaryButton label={saving ? 'Saving...' : 'Save changes'} onPress={() => void saveChanges()} disabled={saving} style={styles.button} />
            <SecondaryButton label="Cancel" onPress={() => setEditing(false)} disabled={saving} style={styles.button} />
          </View>
        </Card>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stateContainer: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  stateText: { marginTop: spacing.md },
  retryButton: { marginTop: spacing.lg },
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
  saveMessage: { color: colors.success, marginTop: spacing.md, textAlign: 'center' },
  saveError: { color: colors.coralDark, marginBottom: spacing.md },
  signOutButton: { marginTop: spacing.md },
  editCard: { width: '100%', maxWidth: 420, borderRadius: 24, padding: spacing.lg },
  editTitle: { marginBottom: spacing.md },
  inputLabel: { color: colors.navyMuted, marginTop: spacing.sm, marginBottom: spacing.xs },
  input: { minHeight: 48, backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingHorizontal: spacing.md, color: colors.navy },
  bioInput: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
