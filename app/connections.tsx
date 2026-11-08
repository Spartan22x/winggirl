import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '@/src/auth/AuthProvider';
import { Avatar, Card, EmptyState, PrimaryButton, Screen, SecondaryButton, SectionHeader, Text } from '@/src/components';
import {
  getAcceptedConnections,
  getIncomingConnectionRequests,
  respondToConnectionRequest,
  createGroupConversation,
  startDirectConversation,
} from '@/src/data/api';
import type { AcceptedConnection, IncomingConnectionRequest } from '@/src/data/types';
import { colors, spacing } from '@/src/theme';

export default function ConnectionsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [incomingRequests, setIncomingRequests] = useState<IncomingConnectionRequest[]>([]);
  const [connections, setConnections] = useState<AcceptedConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const processingRequestRef = useRef<string | null>(null);
  const [messageActionError, setMessageActionError] = useState<string | null>(null);
  const [processingMessageProfileId, setProcessingMessageProfileId] = useState<string | null>(null);
  const processingMessageProfileIdRef = useRef<string | null>(null);
  const [selectedGroupInviteeIds, setSelectedGroupInviteeIds] = useState<Set<string>>(() => new Set());
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupCreationError, setGroupCreationError] = useState<string | null>(null);
  const creatingGroupRef = useRef(false);

  const loadConnections = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [nextRequests, nextConnections] = await Promise.all([
        getIncomingConnectionRequests(),
        getAcceptedConnections(),
      ]);
      setIncomingRequests(nextRequests);
      setConnections(nextConnections);
      setSelectedGroupInviteeIds((selectedIds) => new Set(
        [...selectedIds].filter((profileId) =>
          nextConnections.some((connection) => connection.profileId === profileId)),
      ));
      setHasLoaded(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'We could not load your connections. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    void loadConnections();
  }, [loadConnections]));

  const handleResponse = async (requesterId: string, accept: boolean) => {
    if (processingRequestRef.current) return;
    processingRequestRef.current = requesterId;
    setProcessingRequestId(requesterId);
    setActionError(null);
    try {
      await respondToConnectionRequest(requesterId, accept);
      await loadConnections();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'We could not update this request. Please try again.');
    } finally {
      processingRequestRef.current = null;
      setProcessingRequestId(null);
    }
  };

  const handleStartMessage = async (profileId: string) => {
    if (processingMessageProfileIdRef.current) return;
    processingMessageProfileIdRef.current = profileId;
    setProcessingMessageProfileId(profileId);
    setMessageActionError(null);
    try {
      const conversationId = await startDirectConversation(profileId);
      router.navigate({
        pathname: '/(tabs)/messages',
        params: { conversationId },
      });
    } catch (error) {
      setMessageActionError(error instanceof Error && error.message === 'Conversation unavailable.'
        ? 'We couldn’t open this conversation. Direct messages require an accepted connection and no active block.'
        : 'We couldn’t start a conversation. Please check your connection and try again.');
    } finally {
      processingMessageProfileIdRef.current = null;
      setProcessingMessageProfileId(null);
    }
  };

  const handleToggleGroupInvitee = (profileId: string) => {
    if (creatingGroupRef.current || !user || profileId === user.id) return;
    setGroupCreationError(null);
    setSelectedGroupInviteeIds((selectedIds) => {
      const nextIds = new Set(selectedIds);
      if (nextIds.has(profileId)) nextIds.delete(profileId);
      else nextIds.add(profileId);
      return nextIds;
    });
  };

  const handleCreateGroup = async () => {
    if (!user || creatingGroupRef.current || selectedGroupInviteeIds.size < 2) return;
    const acceptedProfileIds = new Set(connections.map((connection) => connection.profileId));
    const inviteeProfileIds = [...selectedGroupInviteeIds]
      .filter((profileId) => profileId !== user.id && acceptedProfileIds.has(profileId));
    if (inviteeProfileIds.length < 2) {
      setGroupCreationError('Select at least two current accepted connections to create a group.');
      return;
    }

    creatingGroupRef.current = true;
    setCreatingGroup(true);
    setGroupCreationError(null);
    try {
      const conversationId = await createGroupConversation(inviteeProfileIds);
      setSelectedGroupInviteeIds(new Set());
      router.navigate({
        pathname: '/(tabs)/messages',
        params: { conversationId },
      });
    } catch (error) {
      const eligibilityChanged = error instanceof Error
        && error.message === 'One or more selected connections are unavailable.';
      setGroupCreationError(eligibilityChanged
        ? 'One or more selected connections are no longer eligible. Refresh your connections and try again.'
        : 'We couldn’t create this group. Please try again.');
      if (eligibilityChanged) void loadConnections();
    } finally {
      creatingGroupRef.current = false;
      setCreatingGroup(false);
    }
  };

  if (authLoading) {
    return (
      <Screen contentContainerStyle={styles.centered}>
        <ActivityIndicator color={colors.coral} />
        <Text style={styles.stateText}>Checking your account…</Text>
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen contentContainerStyle={styles.centered}>
        <Text variant="title">Sign in to view your connections.</Text>
        <PrimaryButton label="Go to sign in" onPress={() => router.replace('/(auth)/sign-in')} style={styles.retryButton} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SecondaryButton label="Back to Profile" onPress={() => router.back()} style={styles.backButton} />
      <Text variant="label" style={styles.eyebrow}>YOUR PEOPLE</Text>
      <Text variant="display">Connections</Text>
      <Text style={styles.intro}>Keep up with the people you&apos;ve connected with.</Text>

      <SectionHeader title="Incoming Requests" />
      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
      {loadError ? (
        <Card style={styles.errorCard}>
          <Text variant="title">We couldn&apos;t load your connections.</Text>
          <Text style={styles.errorMessage}>{loadError}</Text>
          <SecondaryButton label="Try again" onPress={() => void loadConnections()} style={styles.retryButton} />
        </Card>
      ) : loading && !hasLoaded ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={colors.coral} />
          <Text style={styles.stateText}>Loading connection requests…</Text>
        </Card>
      ) : incomingRequests.length ? (
        incomingRequests.map((request) => (
          <RequestCard
            key={request.requesterId}
            request={request}
            busy={processingRequestId === request.requesterId || Boolean(processingRequestId)}
            onAccept={() => void handleResponse(request.requesterId, true)}
            onDecline={() => void handleResponse(request.requesterId, false)}
          />
        ))
      ) : hasLoaded ? (
        <EmptyState title="No requests just yet." message="When someone reaches out, you’ll find their request here." icon="✦" />
      ) : null}

      <View style={styles.connectionsSection}>
        <SectionHeader title="My Connections" />
        <Card style={styles.groupCard}>
          <Text variant="title">Create a group</Text>
          <Text style={styles.groupCount}>
            {selectedGroupInviteeIds.size} invitees selected (choose at least 2)
          </Text>
          {groupCreationError ? (
            <Text accessibilityRole="alert" style={styles.errorText}>{groupCreationError}</Text>
          ) : null}
          <PrimaryButton
            label={creatingGroup ? 'Creating group…' : 'Create group'}
            onPress={() => { void handleCreateGroup(); }}
            disabled={creatingGroup || selectedGroupInviteeIds.size < 2}
            style={styles.createGroupButton}
          />
        </Card>
        {messageActionError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>{messageActionError}</Text>
        ) : null}
        {!loadError && connections.length ? (
          connections.map((connection) => (
            <ConnectionCard
              key={connection.profileId}
              connection={connection}
              busy={processingMessageProfileId === connection.profileId || Boolean(processingMessageProfileId)}
              groupSelected={selectedGroupInviteeIds.has(connection.profileId)}
              canSelectGroup={connection.profileId !== user.id}
              onMessage={() => { void handleStartMessage(connection.profileId); }}
              onToggleGroup={() => handleToggleGroupInvitee(connection.profileId)}
              groupBusy={creatingGroup}
            />
          ))
        ) : !loadError && hasLoaded ? (
          <EmptyState title="Your circle starts here." message="Accepted connections will show up here." icon="♡" />
        ) : null}
      </View>
    </Screen>
  );
}

function RequestCard({
  request,
  busy,
  onAccept,
  onDecline,
}: {
  request: IncomingConnectionRequest;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const profile = request.profile;
  return (
    <Card style={styles.personCard}>
      <View style={styles.personHeader}>
        <Avatar
          label={profile?.firstName.slice(0, 1) ?? '?'}
          color={profile?.avatarColor ?? colors.navy}
          size={52}
        />
        <View style={styles.personDetails}>
          <Text variant="title" style={styles.personName}>
            {profile ? `${profile.firstName}${profile.age !== null ? `, ${profile.age}` : ''}` : 'Profile unavailable'}
          </Text>
          <Text style={styles.personSubtitle}>
            {profile ? 'Would love to connect with you.' : 'This profile is no longer available.'}
          </Text>
        </View>
      </View>
      <View style={styles.responseActions}>
        <PrimaryButton label={busy ? 'Please wait…' : 'Accept'} onPress={onAccept} disabled={busy} style={styles.responseButton} />
        <SecondaryButton label={busy ? 'Please wait…' : 'Decline'} onPress={onDecline} disabled={busy} style={styles.responseButton} />
      </View>
    </Card>
  );
}

function ConnectionCard({
  connection,
  busy,
  groupSelected,
  canSelectGroup,
  groupBusy,
  onMessage,
  onToggleGroup,
}: {
  connection: AcceptedConnection;
  busy: boolean;
  groupSelected: boolean;
  canSelectGroup: boolean;
  groupBusy: boolean;
  onMessage: () => void;
  onToggleGroup: () => void;
}) {
  const profile = connection.profile;
  return (
    <Card style={styles.personCard}>
      <View style={styles.personHeader}>
        <Avatar
          label={profile?.firstName.slice(0, 1) ?? '?'}
          color={profile?.avatarColor ?? colors.navy}
          size={52}
        />
        <View style={styles.personDetails}>
          <Text variant="title" style={styles.personName}>
            {profile ? `${profile.firstName}${profile.age !== null ? `, ${profile.age}` : ''}` : 'Profile unavailable'}
          </Text>
          <Text style={styles.personSubtitle}>
            {profile ? 'A new connection in your circle.' : 'This profile is no longer available.'}
          </Text>
        </View>
      </View>
      <View style={styles.connectionActions}>
        <SecondaryButton
          label={busy ? 'Opening messages…' : 'Message'}
          onPress={onMessage}
          disabled={busy || !profile}
          style={styles.connectionActionButton}
        />
        {canSelectGroup ? (
          <SecondaryButton
            label={groupSelected ? 'Selected' : 'Add to group'}
            onPress={onToggleGroup}
            disabled={groupBusy}
            style={styles.connectionActionButton}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  centered: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  stateText: { marginTop: spacing.md, color: colors.navyMuted },
  retryButton: { marginTop: spacing.md },
  backButton: { alignSelf: 'flex-start', marginBottom: spacing.lg },
  eyebrow: { color: colors.coralDark, marginBottom: spacing.sm },
  intro: { marginTop: spacing.sm, marginBottom: spacing.xl },
  loadingCard: { alignItems: 'center', padding: spacing.lg },
  errorCard: { padding: spacing.md },
  errorText: { color: colors.coralDark, marginBottom: spacing.sm },
  errorMessage: { color: colors.navyMuted, marginTop: spacing.xs },
  connectionsSection: { marginTop: spacing.xl },
  groupCard: { padding: spacing.md, marginBottom: spacing.md },
  groupCount: { color: colors.inkSoft, marginTop: spacing.xs },
  createGroupButton: { marginTop: spacing.md },
  personCard: { padding: spacing.md, marginBottom: spacing.md },
  personHeader: { flexDirection: 'row', alignItems: 'center' },
  personDetails: { flex: 1, marginLeft: spacing.md },
  personName: { fontSize: 18, lineHeight: 24 },
  personSubtitle: { color: colors.inkSoft, marginTop: spacing.xs },
  responseActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  responseButton: { flex: 1 },
  connectionActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  connectionActionButton: { flex: 1 },
});
