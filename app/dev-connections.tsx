import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { useAuth } from '@/src/auth/AuthProvider';
import { Card, PrimaryButton, Screen, SecondaryButton, Text } from '@/src/components';
import {
  getAcceptedConnections,
  getConnectionStatus,
  getIncomingConnectionRequests,
  getProfile,
  respondToConnectionRequest,
  sendConnectionRequest,
} from '@/src/data/api';
import type { ConnectionRelationshipStatus } from '@/src/data/types';
import { colors, radii, spacing } from '@/src/theme';

const amandaProfileId = '85dd4b78-cfe1-4489-b05e-77aaef604915';
const sarahProfileId = 'ec16444f-58af-49a8-a089-cbbe9c350be7';

type TestAction =
  | 'status'
  | 'send'
  | 'incoming'
  | 'accepted'
  | 'accept'
  | 'decline';

type TestResults = Partial<Record<TestAction, { success: boolean; message: string }>>;

function DevConnectionsTestContent() {
  const { user, loading } = useAuth();
  const [profileId, setProfileId] = useState('');
  const [firstName, setFirstName] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [otherProfileId, setOtherProfileId] = useState('');
  const [requesterProfileId, setRequesterProfileId] = useState('');
  const [runningAction, setRunningAction] = useState<TestAction | null>(null);
  const [results, setResults] = useState<TestResults>({});
  const actionInProgress = useRef(false);

  useEffect(() => {
    if (!user) return;

    let active = true;
    setProfileId(user.id);
    setProfileError(null);
    setFirstName(null);

    if (user.id === amandaProfileId) {
      setOtherProfileId(sarahProfileId);
      setRequesterProfileId(sarahProfileId);
    } else if (user.id === sarahProfileId) {
      setOtherProfileId(amandaProfileId);
      setRequesterProfileId(amandaProfileId);
    }

    getProfile(user.id)
      .then((profile) => {
        if (active) setFirstName(profile.first_name);
      })
      .catch(() => {
        if (active) setProfileError('Could not load your profile name. The profile ID is available above.');
      });

    return () => {
      active = false;
    };
  }, [user]);

  const runAction = async (action: TestAction, operation: () => Promise<unknown>) => {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setRunningAction(action);
    setResults((current) => ({ ...current, [action]: undefined }));
    try {
      const result = await operation();
      setResults((current) => ({
        ...current,
        [action]: { success: true, message: JSON.stringify(result, null, 2) },
      }));
    } catch (error) {
      setResults((current) => ({
        ...current,
        [action]: {
          success: false,
          message: error instanceof Error ? error.message : 'The action failed with an unknown error.',
        },
      }));
    } finally {
      actionInProgress.current = false;
      setRunningAction(null);
    }
  };

  const runStatus = () => runAction('status', async (): Promise<ConnectionRelationshipStatus> => {
    if (!otherProfileId.trim()) throw new Error('Enter the other profile ID first.');
    return getConnectionStatus(otherProfileId.trim());
  });

  if (loading) {
    return (
      <Screen contentContainerStyle={styles.centered}>
        <ActivityIndicator color={colors.coral} />
        <Text style={styles.loadingText}>Checking your session…</Text>
      </Screen>
    );
  }

  if (!user) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Screen>
      <Text variant="label" style={styles.eyebrow}>DEVELOPMENT ONLY</Text>
      <Text variant="display">Connections API test</Text>
      <Text style={styles.intro}>Actions run only when tapped. Use the normal sign-in screen to switch test accounts.</Text>

      <Card style={styles.card}>
        <Text variant="title" style={styles.sectionTitle}>Signed-in account</Text>
        {firstName ? <Text style={styles.accountName}>{firstName}</Text> : null}
        <Text selectable style={styles.profileId}>{profileId}</Text>
        {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}
      </Card>

      <Card style={styles.card}>
        <Text variant="title" style={styles.sectionTitle}>Other user</Text>
        <Text style={styles.inputLabel}>Other user&apos;s profile ID</Text>
        <TextInput
          accessibilityLabel="Other user's profile ID"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setOtherProfileId}
          style={styles.input}
          value={otherProfileId}
        />
        <PrimaryButton
          disabled={Boolean(runningAction)}
          label={runningAction === 'status' ? 'Checking…' : 'Get connection status'}
          onPress={() => void runStatus()}
          style={styles.actionButton}
        />
        <PrimaryButton
          disabled={Boolean(runningAction)}
          label={runningAction === 'send' ? 'Sending…' : 'Send connection request'}
          onPress={() => void runAction('send', async () => {
            if (!otherProfileId.trim()) throw new Error('Enter the other profile ID first.');
            return sendConnectionRequest(otherProfileId.trim());
          })}
          style={styles.actionButton}
        />
        <TestResult result={results.status} />
        <TestResult result={results.send} />
      </Card>

      <Card style={styles.card}>
        <Text variant="title" style={styles.sectionTitle}>Connection lists</Text>
        <PrimaryButton
          disabled={Boolean(runningAction)}
          label={runningAction === 'incoming' ? 'Loading…' : 'Get incoming requests'}
          onPress={() => void runAction('incoming', getIncomingConnectionRequests)}
          style={styles.actionButton}
        />
        <TestResult result={results.incoming} />
        <PrimaryButton
          disabled={Boolean(runningAction)}
          label={runningAction === 'accepted' ? 'Loading…' : 'Get accepted connections'}
          onPress={() => void runAction('accepted', getAcceptedConnections)}
          style={styles.actionButton}
        />
        <TestResult result={results.accepted} />
      </Card>

      <Card style={styles.card}>
        <Text variant="title" style={styles.sectionTitle}>Respond to a request</Text>
        <Text style={styles.inputLabel}>Requester&apos;s profile ID</Text>
        <TextInput
          accessibilityLabel="Requester's profile ID"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setRequesterProfileId}
          style={styles.input}
          value={requesterProfileId}
        />
        <Text style={styles.hint}>Only the addressee of a pending request can accept or decline it.</Text>
        <PrimaryButton
          disabled={Boolean(runningAction)}
          label={runningAction === 'accept' ? 'Accepting…' : 'Accept request'}
          onPress={() => void runAction('accept', async () => {
            if (!requesterProfileId.trim()) throw new Error('Enter the requester profile ID first.');
            return respondToConnectionRequest(requesterProfileId.trim(), true);
          })}
          style={styles.actionButton}
        />
        <TestResult result={results.accept} />
        <SecondaryButton
          disabled={Boolean(runningAction)}
          label={runningAction === 'decline' ? 'Declining…' : 'Decline request'}
          onPress={() => void runAction('decline', async () => {
            if (!requesterProfileId.trim()) throw new Error('Enter the requester profile ID first.');
            return respondToConnectionRequest(requesterProfileId.trim(), false);
          })}
          style={styles.actionButton}
        />
        <TestResult result={results.decline} />
      </Card>
    </Screen>
  );
}

function TestResult({ result }: { result?: TestResults[TestAction] }) {
  if (!result) return null;
  return (
    <View style={[styles.result, result.success ? styles.successResult : styles.failureResult]}>
      <Text variant="label" style={result.success ? styles.successText : styles.errorText}>
        {result.success ? 'Result' : 'Error'}
      </Text>
      <Text selectable style={styles.resultMessage}>{result.message}</Text>
    </View>
  );
}

export default function DevConnectionsTestScreen() {
  if (!__DEV__) return <Redirect href="/(tabs)" />;
  return <DevConnectionsTestContent />;
}

const styles = StyleSheet.create({
  centered: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: spacing.md },
  eyebrow: { color: colors.coralDark, marginBottom: spacing.sm },
  intro: { marginTop: spacing.sm, marginBottom: spacing.lg },
  card: { padding: spacing.md, marginBottom: spacing.md },
  sectionTitle: { marginBottom: spacing.md },
  accountName: { color: colors.navy, marginBottom: spacing.xs },
  profileId: { color: colors.navyMuted, fontFamily: 'monospace' },
  inputLabel: { color: colors.navyMuted, marginBottom: spacing.xs },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    color: colors.navy,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  actionButton: { marginTop: spacing.sm },
  hint: { color: colors.inkSoft, marginBottom: spacing.xs },
  result: { borderRadius: radii.md, padding: spacing.md, marginTop: spacing.md },
  successResult: { backgroundColor: '#E8F4ED' },
  failureResult: { backgroundColor: colors.coralSoft },
  successText: { color: colors.success, marginBottom: spacing.xs },
  errorText: { color: colors.coralDark, marginBottom: spacing.xs },
  resultMessage: { color: colors.navyMuted, fontFamily: 'monospace' },
});
