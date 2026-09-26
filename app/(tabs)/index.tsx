import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Card, Modal, PrimaryButton, Screen, SecondaryButton, SectionHeader, StatusPill, Text, UserCard } from '@/src/components';
import { getAvailability, getProfile, getPublicProfiles, setAvailability } from '@/src/data/api';
import type { UserProfile } from '@/src/data/types';
import { useAuth } from '@/src/auth/AuthProvider';
import { colors, radii, spacing } from '@/src/theme';

const greetingText = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

export default function HomeScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ firstName: string; avatarColor: string } | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isAvailable, setIsAvailable] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showPlanComposer, setShowPlanComposer] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([getProfile(user.id), getPublicProfiles(user.id), getAvailability(user.id)]).then(([nextProfile, nextUsers, nextAvailability]) => {
      setProfile({ firstName: nextProfile.first_name, avatarColor: nextProfile.avatar_color });
      setUsers(nextUsers);
      setIsAvailable(nextAvailability);
    }).catch(() => undefined);
  }, [user]);

  const availableFriends = users.filter((nextUser) => nextUser.available).length;
  const highlightedUsers = users.filter((nextUser) => nextUser.available).slice(0, 4);
  const selectedUser = users.find((nextUser) => nextUser.id === selectedUserId) ?? null;

  const toggleAvailability = async () => {
    if (!user) return;
    const nextValue = !isAvailable;
    setIsAvailable(nextValue);
    try {
      await setAvailability(user.id, nextValue);
    } catch {
      setIsAvailable(!nextValue);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text variant="label" style={styles.eyebrow}>FRIDAY, SEPTEMBER 25</Text>
          <Text variant="display" style={styles.greeting}>{greetingText()}, {profile?.firstName ?? 'there'}</Text>
        </View>
        <Avatar label={(profile?.firstName ?? 'W').slice(0, 1)} color={profile?.avatarColor ?? colors.navy} size={48} />
      </View>

      <Card style={styles.availabilityCard}>
        <View style={styles.availabilityTop}>
          <View style={styles.iconCircle}><Ionicons name="sparkles" size={20} color={colors.coralDark} /></View>
          <StatusPill label={isAvailable ? 'You are available' : 'You are taking a quiet night'} />
        </View>

        <View style={styles.toggleRow}>
          <Text variant="title" style={styles.cardTitle}>I&apos;m available tonight</Text>
          <Pressable
            accessibilityRole="switch"
            onPress={toggleAvailability}
            style={[styles.switch, isAvailable && styles.switchOn]}
          >
            <View style={[styles.switchThumb, isAvailable && styles.switchThumbOn]} />
          </Pressable>
        </View>

        <Text style={styles.cardBody}>{isAvailable ? 'Your Wings can see you\'re available.' : 'You are keeping your evening flexible.'}</Text>
        <Text style={styles.countText}>{availableFriends} friends are free tonight</Text>
        <PrimaryButton label="Make a plan" onPress={() => setShowPlanComposer(true)} style={styles.cardButton} />
      </Card>

      <SectionHeader title="Available women" action="VIEW ALL" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList} contentContainerStyle={styles.listContent}>
        {highlightedUsers.map((user) => (
          <UserCard key={user.id} firstName={user.firstName} age={user.age} distance={user.distance} interests={user.interests} available={user.available} avatarColor={user.avatarColor} onPress={() => setSelectedUserId(user.id)} />
        ))}
      </ScrollView>

      <SectionHeader title="Recommended social plans" action="SEE ALL" />
      <Card style={styles.planCard}>
        <View style={styles.planIcon}><Ionicons name="wine-outline" size={22} color={colors.coralDark} /></View>
        <View style={styles.planCopy}>
          <Text variant="label" style={styles.planLabel}>SUGGESTED PLAN</Text>
          <Text variant="title" style={styles.planTitle}>After-work sparkle</Text>
          <Text style={styles.planMeta}>3 Wings nearby · Tonight at 7:00 PM</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.inkSoft} />
      </Card>

      <Modal visible={Boolean(selectedUser)} onClose={() => setSelectedUserId(null)}>
        {selectedUser ? (
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Avatar label={selectedUser.firstName.slice(0, 1)} color={selectedUser.avatarColor} size={58} textColor={colors.navy} />
              <View style={styles.modalMeta}>
                <Text variant="title">{selectedUser.firstName}, {selectedUser.age}</Text>
                <Text style={styles.modalDistance}>{selectedUser.distance} away</Text>
              </View>
            </View>
            <Text style={styles.modalBio}>{selectedUser.bio}</Text>
            <View style={styles.modalTagRow}>
              {selectedUser.interests.map((interest) => (
                <View key={interest} style={styles.modalTag}><Text variant="label" style={styles.modalTagText}>{interest}</Text></View>
              ))}
            </View>
            <View style={styles.actionRow}>
              <PrimaryButton label="Start a plan" onPress={() => { setSelectedUserId(null); setShowPlanComposer(true); }} style={styles.primaryAction} />
              <SecondaryButton label="Cancel" onPress={() => setSelectedUserId(null)} style={styles.cancelButton} />
            </View>
          </Card>
        ) : null}
      </Modal>

      <Modal visible={showPlanComposer} onClose={() => setShowPlanComposer(false)}>
        <Card style={styles.planComposerCard}>
          <Text variant="title" style={styles.composerTitle}>Create a plan</Text>
          <Text style={styles.composerBody}>A warm, easy evening is just a few choices away.</Text>
          <View style={styles.actionRow}>
            <PrimaryButton label="Choose a plan" onPress={() => setShowPlanComposer(false)} style={styles.primaryAction} />
            <SecondaryButton label="Cancel" onPress={() => setShowPlanComposer(false)} style={styles.cancelButton} />
          </View>
        </Card>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  eyebrow: { color: colors.coralDark, marginBottom: spacing.sm },
  greeting: { fontSize: 28, lineHeight: 34 },
  availabilityCard: { backgroundColor: colors.navy, borderColor: colors.navy, padding: spacing.lg, marginBottom: spacing.xl },
  availabilityTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  iconCircle: { width: 38, height: 38, borderRadius: radii.pill, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  cardTitle: { color: colors.white, marginBottom: 0 },
  cardBody: { color: '#CBD2D9', marginBottom: spacing.sm },
  countText: { color: colors.white, marginBottom: spacing.lg, opacity: 0.9 },
  switch: { width: 56, height: 32, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, justifyContent: 'center', paddingHorizontal: 4 },
  switchOn: { backgroundColor: colors.coral },
  switchThumb: { width: 22, height: 22, borderRadius: 999, backgroundColor: colors.white, alignSelf: 'flex-start' },
  switchThumbOn: { alignSelf: 'flex-end' },
  cardButton: { alignSelf: 'flex-start' },
  horizontalList: { marginBottom: spacing.xl },
  listContent: { paddingRight: spacing.md },
  planCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginBottom: spacing.xl },
  planIcon: { width: 48, height: 48, borderRadius: radii.sm, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  planCopy: { flex: 1 },
  planLabel: { color: colors.coralDark, marginBottom: 2 },
  planTitle: { fontSize: 17, lineHeight: 22, marginBottom: 2 },
  planMeta: { fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  modalCard: { width: '100%', maxWidth: 360, borderRadius: 24, padding: spacing.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  modalMeta: { marginLeft: spacing.md },
  modalDistance: { color: colors.inkSoft, marginTop: 4 },
  modalBio: { color: colors.navyMuted, marginBottom: spacing.md },
  modalTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  modalTag: { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  modalTagText: { color: colors.navyMuted },
  modalButton: { alignSelf: 'stretch' },
  planComposerCard: { width: '100%', maxWidth: 360, borderRadius: 24, padding: spacing.lg },
  composerTitle: { marginBottom: spacing.sm },
  composerBody: { color: colors.navyMuted, marginBottom: spacing.lg },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cancelButton: { minWidth: 96, flex: 0.5 },
  primaryAction: { flex: 1.5 },
});
