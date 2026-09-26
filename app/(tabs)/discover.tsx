import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, FilterChip, Screen, Text, UserCard, Avatar, Modal, PrimaryButton, SecondaryButton } from '@/src/components';
import { getPublicProfiles } from '@/src/data/api';
import type { UserProfile } from '@/src/data/types';
import { useAuth } from '@/src/auth/AuthProvider';
import { colors, radii, spacing } from '@/src/theme';

const ageOptions = ['Any age', '20s', '30s'];
const distanceOptions = ['Any distance', '< 1 mi', '< 3 mi'];
const interestOptions = ['Coffee', 'Walks', 'Live music', 'Fitness'];
const activityOptions = ['Dinner', 'Drinks', 'Coffee', 'Walk'];

export default function DiscoverScreen() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedAge, setSelectedAge] = useState('Any age');
  const [selectedDistance, setSelectedDistance] = useState('Any distance');
  const [selectedInterest, setSelectedInterest] = useState<string | null>('Coffee');
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [friendsOfFriends, setFriendsOfFriends] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showPlanComposer, setShowPlanComposer] = useState(false);

  useEffect(() => {
    if (!user) return;
    getPublicProfiles(user.id).then(setUsers).catch(() => undefined);
  }, [user]);

  const filteredUsers = useMemo(() => {
    return users.filter((nextUser) => {
      const matchesAge = selectedAge === 'Any age' || (selectedAge === '20s' ? nextUser.age < 30 : nextUser.age >= 30);
      const matchesDistance = selectedDistance === 'Any distance' || selectedDistance === 'Nearby';
      const matchesInterest = !selectedInterest || nextUser.interests.includes(selectedInterest);
      const matchesActivity = !selectedActivity || nextUser.activity === selectedActivity;
      const matchesFriends = !friendsOnly || nextUser.friends >= 3;
      const matchesFriendsOfFriends = !friendsOfFriends || nextUser.friendsOfFriends;
      return matchesAge && matchesDistance && matchesInterest && matchesActivity && matchesFriends && matchesFriendsOfFriends;
    });
  }, [users, selectedAge, selectedDistance, selectedInterest, selectedActivity, friendsOnly, friendsOfFriends]);

  const selectedUser = users.find((nextUser) => nextUser.id === selectedUserId) ?? null;

  return (
    <Screen>
      <Text variant="label" style={styles.eyebrow}>WHO’S FREE TONIGHT</Text>
      <Text variant="display">Who&apos;s free tonight?</Text>
      <Text style={styles.intro}>Find women who share your pace, your interests, and your appetite for a good plan.</Text>

      <Card style={styles.searchCard}>
        <Ionicons name="search" size={20} color={colors.inkSoft} />
        <Text style={styles.searchText}>Search by interest or neighborhood</Text>
      </Card>

      <View style={styles.filterGroup}>
        <Text variant="label" style={styles.filterLabel}>Age</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {ageOptions.map((option) => (
            <FilterChip key={option} label={option} active={selectedAge === option} onPress={() => setSelectedAge(option)} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.filterGroup}>
        <Text variant="label" style={styles.filterLabel}>Distance</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {distanceOptions.map((option) => (
            <FilterChip key={option} label={option} active={selectedDistance === option} onPress={() => setSelectedDistance(option)} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.filterGroup}>
        <Text variant="label" style={styles.filterLabel}>Interests</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {interestOptions.map((option) => (
            <FilterChip key={option} label={option} active={selectedInterest === option} onPress={() => setSelectedInterest(option === selectedInterest ? null : option)} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.filterGroup}>
        <Text variant="label" style={styles.filterLabel}>Activity</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {activityOptions.map((option) => (
            <FilterChip key={option} label={option} active={selectedActivity === option} onPress={() => setSelectedActivity(option === selectedActivity ? null : option)} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.filterGroup}>
        <Text variant="label" style={styles.filterLabel}>More filters</Text>
        <View style={styles.toggleRow}>
          <FilterChip label="Friends" active={friendsOnly} onPress={() => setFriendsOnly((value) => !value)} />
          <FilterChip label="Friends of friends" active={friendsOfFriends} onPress={() => setFriendsOfFriends((value) => !value)} />
        </View>
      </View>

      <View style={styles.grid}>
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <UserCard key={user.id} firstName={user.firstName} age={user.age} distance={user.distance} interests={user.interests} available={user.available} avatarColor={user.avatarColor} onPress={() => setSelectedUserId(user.id)} />
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <View style={styles.iconCircle}><Ionicons name="compass-outline" size={28} color={colors.coralDark} /></View>
            <Text variant="title">No matches yet.</Text>
            <Text style={styles.emptyText}>Try widening a filter or picking a broader activity.</Text>
          </Card>
        )}
      </View>

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
            <View style={styles.tagRow}>
              {selectedUser.interests.map((interest) => (
                <View key={interest} style={styles.tag}><Text variant="label" style={styles.tagText}>{interest}</Text></View>
              ))}
            </View>
            <View style={styles.actionRow}>
              <PrimaryButton label="Start a plan" onPress={() => {
                setSelectedUserId(null);
                setShowPlanComposer(true);
              }} style={styles.primaryAction} />
              <SecondaryButton label="Cancel" onPress={() => setSelectedUserId(null)} style={styles.cancelButton} />
            </View>
          </Card>
        ) : null}
      </Modal>

      <Modal visible={showPlanComposer} onClose={() => setShowPlanComposer(false)}>
        <Card style={styles.planComposerCard}>
          <Text variant="title" style={styles.composerTitle}>Choose a plan</Text>
          <Text style={styles.composerBody}>Pick a time, invite a few people, and keep it easy.</Text>
          <View style={styles.actionRow}>
            <PrimaryButton label="Continue" onPress={() => setShowPlanComposer(false)} style={styles.primaryAction} />
            <SecondaryButton label="Cancel" onPress={() => setShowPlanComposer(false)} style={styles.cancelButton} />
          </View>
        </Card>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.coralDark, marginBottom: spacing.sm },
  intro: { marginTop: spacing.sm, marginBottom: spacing.lg },
  searchCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginBottom: spacing.lg },
  searchText: { color: colors.inkSoft, marginLeft: spacing.sm },
  filterGroup: { marginBottom: spacing.md },
  filterLabel: { marginBottom: spacing.sm },
  filterRow: { gap: spacing.sm, paddingRight: spacing.sm },
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
  emptyCard: { width: '100%', alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  iconCircle: { width: 64, height: 64, borderRadius: radii.pill, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  emptyText: { textAlign: 'center', marginTop: spacing.sm },
  modalCard: { width: '100%', maxWidth: 360, borderRadius: 24, padding: spacing.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  modalMeta: { marginLeft: spacing.md },
  modalDistance: { color: colors.inkSoft, marginTop: 4 },
  modalBio: { color: colors.navyMuted, marginBottom: spacing.md },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  tag: { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  tagText: { color: colors.navyMuted },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  primaryAction: { flex: 1.5 },
  cancelButton: { minWidth: 92, flex: 0.7 },
  planComposerCard: { width: '100%', maxWidth: 360, borderRadius: 24, padding: spacing.lg },
  composerTitle: { marginBottom: spacing.sm },
  composerBody: { color: colors.navyMuted, marginBottom: spacing.lg },
});
