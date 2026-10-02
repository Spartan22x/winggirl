import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ActivityCard, Avatar, BottomSheet, Card, EmptyState, Modal, PrimaryButton, Screen, SecondaryButton, StatusPill, Text } from '@/src/components';
import { cancelPlan, getActivities, getLocations, getPlanDetails, joinPlan, leavePlan, updatePlan } from '@/src/data/api';
import type { PlanDateTimeOption } from '@/src/lib/planDateTime';
import { getPlanDateTimeOptions } from '@/src/lib/planDateTime';
import type { PlanDetails } from '@/src/data/types';
import { useAuth } from '@/src/auth/AuthProvider';
import { colors, radii, spacing } from '@/src/theme';

type EditDraft = { title: string; startsAt: string; activity: string; location: string; note: string };
type ConfirmationMode = 'leave' | 'cancel' | 'discardEdit' | null;

export default function PlanDetailScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const planId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [plan, setPlan] = useState<PlanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationMode>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editStep, setEditStep] = useState(0);
  const [editActivities, setEditActivities] = useState<string[]>([]);
  const [editLocations, setEditLocations] = useState<{ name: string; area: string; vibe: string; note: string }[]>([]);
  const [editDateTimes, setEditDateTimes] = useState<PlanDateTimeOption[]>([]);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  const loadPlan = useCallback(async (showLoader = true) => {
    if (!user || !planId) {
      setLoadError('This plan could not be found.');
      setPlan(null);
      setLoading(false);
      return;
    }
    if (showLoader) setLoading(true);
    setLoadError(null);
    try {
      const nextPlan = await getPlanDetails(planId, user.id);
      setPlan(nextPlan);
      if (!nextPlan) setLoadError('This plan is unavailable or you do not have access to it.');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'We could not load this plan.');
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [planId, user]);

  useFocusEffect(useCallback(() => {
    void loadPlan();
  }, [loadPlan]));

  const isActive = Boolean(plan && (plan.status === 'upcoming' || plan.status === 'invited' || plan.status === 'joined') && new Date(plan.startsAt).getTime() > Date.now());
  const statusLabel = !plan ? '' : plan.status === 'cancelled'
    ? 'Cancelled'
    : plan.status === 'past' || new Date(plan.startsAt).getTime() <= Date.now()
      ? 'Past'
      : plan.isHost
        ? 'Hosting'
        : plan.currentUserStatus === 'invited'
          ? 'Invitation'
          : plan.currentUserStatus === 'joined'
            ? 'Joined'
            : 'Not participating';

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/plans');
  };

  const handleJoin = async () => {
    if (!user || !plan) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await joinPlan(plan.id, user.id);
      setNotice('You joined this plan.');
      await loadPlan(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'We could not join this plan.');
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!user || !plan || plan.isHost) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await leavePlan(plan.id, user.id);
      setConfirmation(null);
      setNotice('You left this plan.');
      setPlan((current) => {
        if (!current) return current;
        const participants = current.participants.filter((participant) => participant.profileId !== user.id);
        return {
          ...current,
          currentUserStatus: null,
          participants,
          attendees: participants.filter((participant) => participant.status !== 'declined').map((participant) => participant.firstName),
        };
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'We could not leave this plan.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelPlan = async () => {
    if (!user || !plan?.isHost) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await cancelPlan(plan.id, user.id);
      setConfirmation(null);
      setNotice('This plan has been cancelled.');
      await loadPlan(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'We could not cancel this plan.');
    } finally {
      setBusy(false);
    }
  };

  const startEditing = async () => {
    if (!plan?.isHost || !isActive) return;
    setBusy(true);
    setActionError(null);
    try {
      const [activities, locations] = await Promise.all([getActivities(), getLocations()]);
      const dateTimes = getPlanDateTimeOptions();
      if (!dateTimes.some((option) => new Date(option.startsAt).getTime() === new Date(plan.startsAt).getTime())) {
        dateTimes.unshift({ startsAt: plan.startsAt, label: `${plan.date} • ${plan.time}` });
      }
      setEditActivities(activities);
      setEditLocations(locations);
      setEditDateTimes(dateTimes);
      setEditDraft({ title: plan.title, startsAt: plan.startsAt, activity: plan.activity, location: plan.location, note: plan.note });
      setEditStep(0);
      setEditOpen(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'We could not prepare the edit form.');
    } finally {
      setBusy(false);
    }
  };

  const requestCloseEdit = () => setConfirmation('discardEdit');

  const handleSaveEdit = async () => {
    if (!user || !plan?.isHost || !editDraft) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await updatePlan(plan.id, user.id, editDraft);
      setEditOpen(false);
      setEditDraft(null);
      setNotice('Plan details updated. Participants were unchanged.');
      await loadPlan(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'We could not update this plan.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (confirmation === 'leave') await handleLeave();
    if (confirmation === 'cancel') await handleCancelPlan();
    if (confirmation === 'discardEdit') {
      setConfirmation(null);
      setEditOpen(false);
      setEditDraft(null);
    }
  };

  const renderEditStep = () => {
    if (!editDraft) return null;
    if (editStep === 0) {
      return (
        <View>
          <Text variant="title" style={styles.sheetTitle}>Choose a date and time</Text>
          <ScrollView style={styles.dateOptionsScroll} contentContainerStyle={styles.optionGrid} showsVerticalScrollIndicator>
            {editDateTimes.map((option) => (
              <Pressable key={option.startsAt} onPress={() => setEditDraft((current) => current ? { ...current, startsAt: option.startsAt } : current)} style={[styles.optionCard, editDraft.startsAt === option.startsAt && styles.optionSelected]}>
                <Text variant="title" style={[styles.optionText, editDraft.startsAt === option.startsAt && styles.optionSelectedText]}>{option.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      );
    }

    if (editStep === 1) {
      return (
        <View>
          <Text variant="title" style={styles.sheetTitle}>Choose an activity</Text>
          <View style={styles.activityGrid}>
            {editActivities.map((activity) => <ActivityCard key={activity} label={activity} selected={editDraft.activity === activity} onPress={() => setEditDraft((current) => current ? { ...current, activity } : current)} />)}
          </View>
        </View>
      );
    }

    return (
      <View>
        <Text variant="title" style={styles.sheetTitle}>Location and details</Text>
        <ScrollView style={styles.locationList} showsVerticalScrollIndicator>
          {editLocations.map((location) => (
            <Pressable key={location.name} onPress={() => setEditDraft((current) => current ? { ...current, location: location.name } : current)} style={[styles.locationCard, editDraft.location === location.name && styles.optionSelected]}>
              <Text variant="title" style={[styles.locationTitle, editDraft.location === location.name && styles.optionSelectedText]}>{location.name}</Text>
              <Text style={styles.meta}>{location.area} • {location.vibe}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <TextInput value={editDraft.title} onChangeText={(title) => setEditDraft((current) => current ? { ...current, title } : current)} placeholder="Plan title" maxLength={160} style={styles.input} />
        <TextInput value={editDraft.note} onChangeText={(note) => setEditDraft((current) => current ? { ...current, note } : current)} placeholder="Add a description (optional)" multiline maxLength={1000} style={[styles.input, styles.noteInput]} />
      </View>
    );
  };

  if (loading) {
    return <Screen contentContainerStyle={styles.centered}><ActivityIndicator color={colors.coral} /><Text style={styles.muted}>Loading plan…</Text></Screen>;
  }

  if (!plan || loadError) {
    return (
      <Screen>
        <Pressable accessibilityRole="button" onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.navy} />
          <Text variant="label">Back</Text>
        </Pressable>
        <EmptyState title="Plan unavailable" message={loadError ?? 'This plan could not be found.'} icon="✦" />
      </Screen>
    );
  }

  const activeParticipants = plan.participants.filter((participant) => participant.status !== 'declined');

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={handleBack} style={styles.backButton}>
        <Ionicons name="arrow-back" size={20} color={colors.navy} />
        <Text variant="label">Plans</Text>
      </Pressable>

      <View style={styles.titleRow}>
        <View style={styles.titleWrap}>
          <Text variant="label" style={styles.eyebrow}>{plan.activity.toUpperCase()}</Text>
          <Text variant="display" style={styles.title}>{plan.title}</Text>
        </View>
        <StatusPill label={statusLabel} />
      </View>

      {notice ? <Card style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></Card> : null}
      {actionError ? <Card style={styles.error}><Text style={styles.errorText}>{actionError}</Text></Card> : null}

      <Card style={styles.detailsCard}>
        <Text variant="title" style={styles.sectionTitle}>Plan details</Text>
        <Text style={styles.detailLine}><Text style={styles.detailLabel}>When</Text>  {plan.date} • {plan.time}</Text>
        <Text style={styles.detailLine}><Text style={styles.detailLabel}>Where</Text>  {plan.location}</Text>
        {plan.note ? <Text style={styles.description}>{plan.note}</Text> : null}
      </Card>

      <Card style={styles.hostCard}>
        <Text variant="title" style={styles.sectionTitle}>Hosted by</Text>
        <View style={styles.personRow}>
          <Avatar label={(plan.hostProfile?.firstName ?? plan.host).slice(0, 1)} color={plan.hostProfile?.avatarColor ?? colors.navy} size={48} />
          <View style={styles.personInfo}>
            <Text variant="title">{plan.hostProfile?.firstName ?? plan.host}</Text>
            {plan.hostProfile?.age ? <Text style={styles.meta}>{plan.hostProfile.age} years old</Text> : null}
            {plan.hostProfile?.bio ? <Text style={styles.meta}>{plan.hostProfile.bio}</Text> : null}
            {plan.isHost ? <Text style={styles.hostLabel}>You are hosting</Text> : null}
          </View>
        </View>
      </Card>

      <Card style={styles.participantsCard}>
        <Text variant="title" style={styles.sectionTitle}>Participants</Text>
        {activeParticipants.length ? activeParticipants.map((participant) => (
          <View key={participant.profileId} style={styles.participantRow}>
            <Avatar label={participant.firstName.slice(0, 1)} color={participant.avatarColor} size={40} />
            <View style={styles.participantInfo}>
              <Text variant="title">{participant.firstName}</Text>
              {participant.age ? <Text style={styles.meta}>{participant.age} years old</Text> : null}
            </View>
            <Text variant="label" style={participant.status === 'joined' ? styles.joinedLabel : styles.invitedLabel}>{participant.status === 'joined' ? 'Joined' : 'Invited'}</Text>
          </View>
        )) : <Text style={styles.muted}>No participants yet.</Text>}
      </Card>

      {isActive && !plan.isHost && plan.currentUserStatus === 'invited' ? <PrimaryButton label={busy ? 'Joining…' : 'Accept invitation'} onPress={() => void handleJoin()} disabled={busy} style={styles.actionButton} /> : null}
      {isActive && !plan.isHost && plan.currentUserStatus === 'joined' ? <SecondaryButton label={busy ? 'Leaving…' : 'Leave plan'} onPress={() => setConfirmation('leave')} disabled={busy} style={styles.actionButton} /> : null}
      {isActive && plan.isHost ? (
        <View style={styles.hostActions}>
          <PrimaryButton label={busy ? 'Please wait…' : 'Edit plan'} onPress={() => void startEditing()} disabled={busy} style={styles.hostAction} />
          <SecondaryButton label="Cancel plan" onPress={() => setConfirmation('cancel')} disabled={busy} style={styles.hostAction} />
        </View>
      ) : null}

      <BottomSheet visible={editOpen} onClose={requestCloseEdit}>
        <View style={styles.sheetBody}>
          {renderEditStep()}
          <View style={styles.stepActions}>
            {editStep > 0 ? <SecondaryButton label="Back" onPress={() => setEditStep((step) => Math.max(0, step - 1))} style={styles.actionFlex} /> : null}
            <SecondaryButton label="Cancel editing" onPress={requestCloseEdit} style={styles.actionFlex} />
            {editStep < 2
              ? <PrimaryButton label="Next" onPress={() => setEditStep((step) => Math.min(2, step + 1))} style={styles.actionFlex} />
              : <PrimaryButton label={busy ? 'Saving…' : 'Save changes'} onPress={() => void handleSaveEdit()} disabled={busy} style={styles.actionFlex} />}
          </View>
        </View>
      </BottomSheet>

      <Modal visible={confirmation !== null} onClose={() => setConfirmation(null)}>
        <Card style={styles.confirmCard}>
          <Text variant="title" style={styles.confirmTitle}>{confirmation === 'leave' ? 'Leave this plan?' : confirmation === 'cancel' ? 'Cancel this plan?' : 'Discard edits?'}</Text>
          <Text style={styles.confirmBody}>{confirmation === 'leave' ? 'You will no longer be listed as participating.' : confirmation === 'cancel' ? 'This plan will be marked cancelled and will no longer accept participants.' : 'Your unsaved changes will be lost.'}</Text>
          <View style={styles.confirmActions}>
            <SecondaryButton label={confirmation === 'discardEdit' ? 'Keep editing' : 'Keep plan'} onPress={() => setConfirmation(null)} disabled={busy} style={styles.actionFlex} />
            <PrimaryButton label={busy ? 'Please wait…' : confirmation === 'leave' ? 'Leave plan' : confirmation === 'cancel' ? 'Cancel plan' : 'Discard'} onPress={() => void handleConfirm()} disabled={busy} style={styles.actionFlex} />
          </View>
        </Card>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { minHeight: 320, justifyContent: 'center', alignItems: 'center' },
  muted: { color: colors.navyMuted },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start', marginBottom: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.lg },
  titleWrap: { flex: 1 },
  eyebrow: { color: colors.coralDark, marginBottom: spacing.xs },
  title: { fontSize: 30, lineHeight: 36 },
  detailsCard: { backgroundColor: colors.navy, borderColor: colors.navy, marginBottom: spacing.md },
  hostCard: { marginBottom: spacing.md },
  participantsCard: { marginBottom: spacing.lg },
  sectionTitle: { marginBottom: spacing.md },
  detailLine: { color: colors.white, marginBottom: spacing.sm },
  detailLabel: { color: colors.coralSoft, fontWeight: '700' },
  description: { color: colors.white, marginTop: spacing.md, lineHeight: 22 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  personInfo: { flex: 1 },
  hostLabel: { color: colors.coralDark, marginTop: spacing.xs },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  participantInfo: { flex: 1 },
  joinedLabel: { color: colors.success },
  invitedLabel: { color: colors.coralDark },
  meta: { color: colors.navyMuted, marginTop: spacing.xs },
  actionButton: { alignSelf: 'stretch', marginBottom: spacing.md },
  hostActions: { flexDirection: 'row', gap: spacing.md },
  hostAction: { flex: 1 },
  notice: { backgroundColor: colors.coralSoft, borderColor: colors.coral, marginBottom: spacing.md },
  noticeText: { color: colors.coralDark },
  error: { borderColor: colors.coral, marginBottom: spacing.md },
  errorText: { color: colors.coralDark },
  sheetBody: { minHeight: 420 },
  sheetTitle: { marginBottom: spacing.lg },
  dateOptionsScroll: { maxHeight: 340 },
  optionGrid: { gap: spacing.md },
  optionCard: { backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  optionSelected: { backgroundColor: colors.coralSoft, borderColor: colors.coral },
  optionSelectedText: { color: colors.coralDark },
  optionText: { color: colors.navyMuted },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  locationList: { maxHeight: 180, marginBottom: spacing.md },
  locationCard: { backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  locationTitle: { marginBottom: spacing.xs },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.md, color: colors.navy, backgroundColor: colors.surface },
  noteInput: { minHeight: 96, textAlignVertical: 'top' },
  stepActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  actionFlex: { flex: 1 },
  confirmCard: { width: '100%', maxWidth: 380, borderRadius: radii.md, padding: spacing.lg },
  confirmTitle: { marginBottom: spacing.sm },
  confirmBody: { color: colors.navyMuted, marginBottom: spacing.lg },
  confirmActions: { flexDirection: 'row', gap: spacing.md },
});
