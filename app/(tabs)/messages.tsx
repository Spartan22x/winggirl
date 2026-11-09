import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Card, MessagePreview, Modal, PrimaryButton, SecondaryButton, Text } from '@/src/components';
import {
  getConversationMessages,
  getConversations,
  sendMessage as sendMessageToSupabase,
} from '@/src/data/api';
import { MessageInsertRejectedError } from '@/src/data/message-send-error';
import type { Conversation, Message, MessageCursor, PendingMessage } from '@/src/data/types';
import { useAuth } from '@/src/auth/AuthProvider';
import { colors, radii, spacing } from '@/src/theme';

const INITIAL_MESSAGE_PAGE_SIZE = 30;

type PendingSend = Readonly<{ message: PendingMessage; draft: string }>;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getGroupTitle(conversation: Conversation, currentProfileId: string | undefined) {
  const otherParticipants = conversation.participants
    .filter((participant) => participant.profileId !== currentProfileId);
  const names = otherParticipants.map((participant) => participant.firstName?.trim() ?? '');
  if (!names.length || names.some((name) => !name)) return 'Group conversation';
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} + ${names.length - 2}`;
}

function mergeMessages(existing: Message[], incoming: Message[]) {
  const uniqueMessages = new Map<string, Message>();
  for (const message of [...incoming, ...existing]) uniqueMessages.set(message.id, message);
  return [...uniqueMessages.values()].sort((left, right) => {
    const timeDifference = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    return timeDifference || left.id.localeCompare(right.id);
  });
}

export default function MessagesScreen() {
  const router = useRouter();
  const { conversationId: requestedConversationId } = useLocalSearchParams<{
    conversationId?: string;
  }>();
  const { user } = useAuth();
  const { height: windowHeight } = useWindowDimensions();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [openConversationError, setOpenConversationError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [historyReadyConversationId, setHistoryReadyConversationId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<MessageCursor | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [sendingConversations, setSendingConversations] = useState<Set<string>>(new Set());
  const [sendErrors, setSendErrors] = useState<Map<string, string>>(new Map());
  const [pendingMessages, setPendingMessages] = useState<Map<string, PendingSend>>(new Map());

  const hasLoadedListRef = useRef(false);
  const listRequestRef = useRef(0);
  const conversationLoadPromiseRef = useRef<Promise<Conversation[] | null> | null>(null);
  const historyRequestRef = useRef(0);
  const historyReadyConversationIdRef = useRef<string | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const hasLoadedOlderPageRef = useRef(false);
  const paginationLockRef = useRef(false);
  const listRef = useRef<FlatList<Message>>(null);
  const listContentHeightRef = useRef(0);
  const listViewportHeightRef = useRef(0);
  const listOffsetRef = useRef(0);
  const preserveScrollAfterPrependRef = useRef(false);
  const scrollToLatestRef = useRef(false);
  const initialScrollPendingRef = useRef(false);
  const sendingConversationsRef = useRef<Set<string>>(new Set());
  const pendingMessagesRef = useRef<Map<string, PendingSend>>(new Map());
  const rejectedDraftsRef = useRef<Map<string, string>>(new Map());
  const handledRequestedConversationIdRef = useRef<string | null>(null);
  const profileId = user?.id;

  const activeConversation = activeConversationId
    ? conversations.find((conversation) => conversation.id === activeConversationId)
    : undefined;
  const sending = activeConversationId ? sendingConversations.has(activeConversationId) : false;
  const sendError = activeConversationId ? sendErrors.get(activeConversationId) : undefined;
  const pendingMessage = activeConversationId ? pendingMessages.get(activeConversationId) : undefined;

  const loadConversations = useCallback(async (pullToRefresh = false): Promise<Conversation[] | null> => {
    if (!profileId) return null;
    if (conversationLoadPromiseRef.current) return conversationLoadPromiseRef.current;
    const requestId = ++listRequestRef.current;
    if (pullToRefresh) {
      setListRefreshing(true);
    } else if (!hasLoadedListRef.current) {
      setListLoading(true);
    }
    setListError(null);
    const request = (async () => {
      try {
        const nextConversations = await getConversations();
        if (requestId === listRequestRef.current) {
          setConversations(nextConversations);
        }
        return nextConversations;
      } catch (error) {
        if (requestId === listRequestRef.current) {
          setListError(getErrorMessage(error, 'We could not load your conversations. Please try again.'));
        }
        return null;
      } finally {
        if (requestId === listRequestRef.current) {
          hasLoadedListRef.current = true;
          setListLoading(false);
          setListRefreshing(false);
        }
      }
    })();
    conversationLoadPromiseRef.current = request;
    try {
      return await request;
    } finally {
      if (conversationLoadPromiseRef.current === request) {
        conversationLoadPromiseRef.current = null;
      }
    }
  }, [profileId]);

  useFocusEffect(useCallback(() => {
    void loadConversations();
    return () => {
      listRequestRef.current += 1;
      conversationLoadPromiseRef.current = null;
    };
  }, [loadConversations]));

  useEffect(() => {
    if (!requestedConversationId) {
      handledRequestedConversationIdRef.current = null;
      return;
    }
    if (handledRequestedConversationIdRef.current === requestedConversationId) return;

    handledRequestedConversationIdRef.current = requestedConversationId;
    setOpenConversationError(null);
    void loadConversations().then((nextConversations) => {
      const requestedConversation = nextConversations?.find(
        (conversation) => conversation.id === requestedConversationId,
      );
      if (requestedConversation) {
        if (activeConversationIdRef.current !== requestedConversation.id) {
          historyReadyConversationIdRef.current = null;
          setHistoryReadyConversationId(null);
          activeConversationIdRef.current = requestedConversation.id;
        }
        setDraftMessage(rejectedDraftsRef.current.get(requestedConversation.id) ?? '');
        rejectedDraftsRef.current.delete(requestedConversation.id);
        setActiveConversationId(requestedConversation.id);
      } else if (!nextConversations) {
        setOpenConversationError(
          'We couldn’t load your conversations. Retry the list, then select the conversation again.',
        );
      } else {
        setOpenConversationError(
          'We couldn’t open that conversation. It may no longer be available to your account.',
        );
      }
      router.setParams({ conversationId: undefined });
    });
  }, [loadConversations, requestedConversationId, router]);

  const loadLatestHistory = useCallback(async (conversationId: string, reset: boolean) => {
    const requestId = ++historyRequestRef.current;
    paginationLockRef.current = false;
    setLoadingOlder(false);
    if (reset) {
      hasLoadedOlderPageRef.current = false;
      setMessages([]);
      setHistoryReadyConversationId(null);
      historyReadyConversationIdRef.current = null;
      setHistoryHasMore(false);
      setHistoryCursor(null);
      setHistoryLoading(true);
      listContentHeightRef.current = 0;
      listViewportHeightRef.current = 0;
      listOffsetRef.current = 0;
      preserveScrollAfterPrependRef.current = false;
      scrollToLatestRef.current = false;
      initialScrollPendingRef.current = false;
    }
    setHistoryError(null);
    try {
      const page = await getConversationMessages(conversationId, {
        pageSize: INITIAL_MESSAGE_PAGE_SIZE,
      });
      if (
        requestId === historyRequestRef.current
        && activeConversationIdRef.current === conversationId
      ) {
        if (reset) {
          initialScrollPendingRef.current = page.messages.length > 0;
          setMessages(page.messages);
          setHistoryHasMore(page.hasMore);
          setHistoryCursor(page.nextCursor);
          historyReadyConversationIdRef.current = conversationId;
          setHistoryReadyConversationId(conversationId);
        } else {
          scrollToLatestRef.current = true;
          setMessages((currentMessages) => mergeMessages(currentMessages, page.messages));
          if (!hasLoadedOlderPageRef.current) {
            setHistoryHasMore(page.hasMore);
            setHistoryCursor(page.nextCursor);
          }
        }
      }
    } catch (error) {
      if (
        requestId === historyRequestRef.current
        && activeConversationIdRef.current === conversationId
      ) {
        setHistoryError(getErrorMessage(error, 'We could not load this conversation. Please try again.'));
      }
    } finally {
      if (
        requestId === historyRequestRef.current
        && activeConversationIdRef.current === conversationId
      ) {
        setHistoryLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (activeConversationId) {
      void loadLatestHistory(activeConversationId, true);
    }
    return () => {
      historyRequestRef.current += 1;
      paginationLockRef.current = false;
    };
  }, [activeConversationId, loadLatestHistory]);

  const openConversation = (conversationId: string) => {
    if (activeConversationIdRef.current !== conversationId) {
      historyReadyConversationIdRef.current = null;
      setHistoryReadyConversationId(null);
      setDraftMessage(rejectedDraftsRef.current.get(conversationId) ?? '');
      rejectedDraftsRef.current.delete(conversationId);
      setActiveConversationId(conversationId);
      activeConversationIdRef.current = conversationId;
    }
  };

  const closeConversation = () => {
    historyRequestRef.current += 1;
    activeConversationIdRef.current = null;
    historyReadyConversationIdRef.current = null;
    setHistoryReadyConversationId(null);
    paginationLockRef.current = false;
    setActiveConversationId(null);
    setDraftMessage('');
  };

  const loadOlderMessages = async () => {
    if (
      !activeConversationId
      || !historyCursor
      || !historyHasMore
      || paginationLockRef.current
    ) return;
    const requestId = historyRequestRef.current;
    paginationLockRef.current = true;
    setLoadingOlder(true);
    setHistoryError(null);
    try {
      const page = await getConversationMessages(activeConversationId, {
        pageSize: INITIAL_MESSAGE_PAGE_SIZE,
        before: historyCursor,
      });
      if (
        activeConversationIdRef.current !== activeConversationId
        || historyRequestRef.current !== requestId
      ) return;
      const nextMessages = mergeMessages(messages, page.messages);
      hasLoadedOlderPageRef.current = true;
      preserveScrollAfterPrependRef.current = nextMessages.length > messages.length;
      setMessages(nextMessages);
      setHistoryHasMore(page.hasMore);
      setHistoryCursor(page.nextCursor);
    } catch (error) {
      if (
        activeConversationIdRef.current === activeConversationId
        && historyRequestRef.current === requestId
      ) {
        setHistoryError(getErrorMessage(error, 'We could not load older messages. Please try again.'));
      }
    } finally {
      if (historyRequestRef.current === requestId) {
        paginationLockRef.current = false;
        setLoadingOlder(false);
      }
    }
  };

  const sendPendingMessage = async (pending: PendingSend, isRetry = false) => {
    const { message, draft } = pending;
    const conversationId = message.conversationId;
    if (sendingConversationsRef.current.has(conversationId)) return;
    sendingConversationsRef.current.add(conversationId);
    setSendingConversations(new Set(sendingConversationsRef.current));
    setSendErrors((current) => {
      const next = new Map(current);
      next.delete(conversationId);
      return next;
    });
    try {
      await sendMessageToSupabase(message);
    } catch (error) {
      if (!isRetry && error instanceof MessageInsertRejectedError) {
        pendingMessagesRef.current.delete(conversationId);
        setPendingMessages(new Map(pendingMessagesRef.current));
        if (activeConversationIdRef.current === conversationId) {
          setDraftMessage((current) => current || draft);
        } else {
          rejectedDraftsRef.current.set(conversationId, draft);
        }
      }
      setSendErrors((current) => new Map(current).set(
        conversationId,
        isRetry && error instanceof MessageInsertRejectedError
          ? 'This retry was rejected, but the original delivery is still unverified. Please retry the original message.'
          : getErrorMessage(error, 'Your message could not be verified. Please retry the original message.'),
      ));
      sendingConversationsRef.current.delete(conversationId);
      setSendingConversations(new Set(sendingConversationsRef.current));
      return;
    }

    pendingMessagesRef.current.delete(conversationId);
    setPendingMessages(new Map(pendingMessagesRef.current));
    const isActiveConversation = activeConversationIdRef.current === conversationId;
    if (isActiveConversation) {
      setDraftMessage((current) => current === draft ? '' : current);
      scrollToLatestRef.current = true;
    }
    try {
      const existingListRequest = conversationLoadPromiseRef.current;
      const refreshConversations = async () => {
        if (existingListRequest) await existingListRequest;
        await loadConversations();
      };
      await Promise.all([
        isActiveConversation
          ? loadLatestHistory(conversationId, historyReadyConversationIdRef.current !== conversationId)
          : Promise.resolve(),
        refreshConversations(),
      ]);
      if (activeConversationIdRef.current === conversationId) {
        listRef.current?.scrollToEnd({ animated: true });
      }
    } catch (error) {
      setListError(getErrorMessage(error, 'Message sent, but conversations could not be refreshed.'));
    } finally {
      sendingConversationsRef.current.delete(conversationId);
      setSendingConversations(new Set(sendingConversationsRef.current));
    }
  };

  const sendMessage = () => {
    if (!activeConversationId || !profileId || !draftMessage.trim()
      || sendingConversationsRef.current.has(activeConversationId)
      || pendingMessagesRef.current.has(activeConversationId)) return;
    const message: PendingMessage = {
      id: randomUUID(),
      conversationId: activeConversationId,
      senderId: profileId,
      body: draftMessage.trim(),
    };
    const pending: PendingSend = { message, draft: draftMessage };
    pendingMessagesRef.current.set(activeConversationId, pending);
    setPendingMessages(new Map(pendingMessagesRef.current));
    void sendPendingMessage(pending);
  };

  const retryHistory = () => {
    if (activeConversationId) void loadLatestHistory(activeConversationId, messages.length === 0);
  };

  const positionInitialHistory = () => {
    if (
      initialScrollPendingRef.current
      && listContentHeightRef.current > 0
      && listViewportHeightRef.current > 0
      && listRef.current
    ) {
      listRef.current.scrollToOffset({
        offset: Math.max(0, listContentHeightRef.current - listViewportHeightRef.current),
        animated: false,
      });
      initialScrollPendingRef.current = false;
    }
  };

  const handleContentSizeChange = (_width: number, height: number) => {
    if (preserveScrollAfterPrependRef.current) {
      const addedHeight = height - listContentHeightRef.current;
      listRef.current?.scrollToOffset({
        offset: Math.max(0, listOffsetRef.current + addedHeight),
        animated: false,
      });
      preserveScrollAfterPrependRef.current = false;
    } else if (scrollToLatestRef.current) {
      listRef.current?.scrollToEnd({ animated: false });
      scrollToLatestRef.current = false;
    }
    listContentHeightRef.current = height;
    positionInitialHistory();
  };

  const renderMessage = ({ item: message }: { item: Message }) => (
    <View style={[styles.messageBubble, message.me ? styles.sent : styles.received]}>
      <Text style={message.me ? styles.sentText : styles.receivedText}>{message.text}</Text>
      <Text style={message.me ? styles.metaSent : styles.metaReceived}>{message.time}</Text>
    </View>
  );

  return (
    <>
      <ScrollView
        testID="messages-scroll-view"
        style={styles.screen}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
        refreshControl={(
          <RefreshControl
            testID="messages-refresh-control"
            refreshing={listRefreshing}
            onRefresh={() => { void loadConversations(true); }}
            tintColor={colors.coral}
          />
        )}
      >
        <Text variant="label" style={styles.eyebrow}>STAY IN TOUCH</Text>
        <Text variant="display">Messages</Text>
        <Text style={styles.intro}>Conversations around your plans and your people live here.</Text>

        {listError ? (
          <View style={styles.state}>
            <Text accessibilityRole="alert" style={styles.errorText}>{listError}</Text>
            <SecondaryButton label="Try again" onPress={() => { void loadConversations(); }} style={styles.retryButton} />
          </View>
        ) : null}
        {openConversationError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>{openConversationError}</Text>
        ) : null}

        {listLoading ? (
          <View testID="conversations-loading" style={styles.state}>
            <ActivityIndicator color={colors.coral} />
            <Text style={styles.stateText}>Loading conversations…</Text>
          </View>
        ) : null}

        {!listLoading && !listError && conversations.length === 0 ? (
          <View testID="conversations-empty" style={styles.state}>
            <Text variant="title">No conversations yet</Text>
            <Text style={styles.stateText}>Your conversations will appear here.</Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {conversations.map((conversation) => (
            <MessagePreview
              key={conversation.id}
              title={conversation.conversationType === 'group'
                ? getGroupTitle(conversation, profileId)
                : conversation.title}
              lastMessage={conversation.latestMessage?.text ?? ''}
              time={conversation.latestMessage?.time ?? ''}
              unread={conversation.unread}
              accent={conversation.planRelated ? '#F5E7C2' : '#F5D4C8'}
              onPress={() => openConversation(conversation.id)}
            />
          ))}
        </View>
      </ScrollView>

      <Modal visible={Boolean(activeConversation)} onClose={closeConversation}>
        {activeConversation ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoiding}
          >
            <Card style={{ ...styles.chatCard, maxHeight: windowHeight * 0.9 }}>
              <View style={styles.chatHeader}>
                <Text variant="title" numberOfLines={1} style={styles.chatTitle}>
                  {activeConversation.conversationType === 'group'
                    ? getGroupTitle(activeConversation, profileId)
                    : activeConversation.title}
                </Text>
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.inkSoft} />
              </View>

              {historyLoading ? (
                <View testID="history-loading" style={styles.historyState}>
                  <ActivityIndicator color={colors.coral} />
                  <Text style={styles.stateText}>Loading messages…</Text>
                </View>
              ) : null}

              {historyError ? (
                <View style={styles.historyState}>
                  <Text accessibilityRole="alert" style={styles.errorText}>{historyError}</Text>
                  <SecondaryButton label="Try again" onPress={retryHistory} style={styles.retryButton} />
                </View>
              ) : null}

              {!historyLoading && !historyError && messages.length === 0 ? (
                <View testID="history-empty" style={styles.historyState}>
                  <Text style={styles.stateText}>No messages yet. Say hello!</Text>
                </View>
              ) : null}

              {historyReadyConversationId === activeConversationId ? <FlatList
                key={activeConversationId}
                ref={listRef}
                testID="message-history"
                data={messages}
                initialNumToRender={INITIAL_MESSAGE_PAGE_SIZE}
                keyExtractor={(message) => message.id}
                renderItem={renderMessage}
                style={[styles.chatBody, { maxHeight: windowHeight * 0.52, minHeight: 100 }]}
                contentContainerStyle={styles.chatBodyContent}
                keyboardShouldPersistTaps="handled"
                onScroll={(event) => {
                  listOffsetRef.current = event.nativeEvent.contentOffset.y;
                }}
                onScrollBeginDrag={() => { initialScrollPendingRef.current = false; }}
                onLayout={(event) => {
                  listViewportHeightRef.current = event.nativeEvent.layout.height;
                  positionInitialHistory();
                }}
                scrollEventThrottle={16}
                onContentSizeChange={handleContentSizeChange}
                ListHeaderComponent={historyHasMore ? (
                  <View style={styles.olderMessages}>
                    {loadingOlder ? (
                      <ActivityIndicator testID="loading-older-messages" color={colors.coral} />
                    ) : (
                      <SecondaryButton
                        label="Load older messages"
                        onPress={() => { void loadOlderMessages(); }}
                        style={styles.olderMessagesButton}
                      />
                    )}
                  </View>
                ) : null}
              /> : null}

              <View style={styles.composer}>
                <TextInput
                  testID="message-input"
                  value={draftMessage}
                  onChangeText={setDraftMessage}
                  onSubmitEditing={() => { void sendMessage(); }}
                  placeholder="Message"
                  returnKeyType="send"
                  editable={!sending}
                  style={styles.input}
                />
                <PrimaryButton
                  label={sending ? 'Sending…' : 'Send'}
                  onPress={() => { void sendMessage(); }}
                  disabled={sending || Boolean(pendingMessage) || !draftMessage.trim()}
                  style={styles.sendButton}
                />
              </View>
              {sendError ? <Text accessibilityRole="alert" style={styles.errorText}>{sendError}</Text> : null}
              {pendingMessage && !sending ? (
                <View>
                  <Text style={styles.stateText}>Unverified message: {pendingMessage.message.body}</Text>
                  <Text style={styles.stateText}>Retry the original before sending a new message. Your draft will be kept.</Text>
                  <SecondaryButton label="Retry original message" onPress={() => { void sendPendingMessage(pendingMessage, true); }} />
                </View>
              ) : null}
              <SecondaryButton label="Cancel" onPress={closeConversation} style={styles.cancelButton} />
            </Card>
          </KeyboardAvoidingView>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: { color: colors.coralDark, marginBottom: spacing.sm },
  intro: { marginTop: spacing.sm, marginBottom: spacing.lg },
  list: { marginBottom: spacing.xl },
  state: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  stateText: { color: colors.inkSoft, textAlign: 'center' },
  errorText: { color: colors.coralDark, textAlign: 'center', marginTop: spacing.xs },
  retryButton: { marginTop: spacing.xs, minWidth: 140 },
  keyboardAvoiding: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  chatCard: { width: '100%', maxWidth: 420, borderRadius: 24, padding: spacing.md },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  chatTitle: { flex: 1, marginRight: spacing.sm },
  historyState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  chatBody: { flexGrow: 0, marginBottom: spacing.md },
  chatBodyContent: { flexGrow: 1, justifyContent: 'flex-end', paddingVertical: spacing.xs },
  olderMessages: { alignItems: 'center', paddingBottom: spacing.sm },
  olderMessagesButton: { minHeight: 42 },
  messageBubble: { maxWidth: '78%', borderRadius: 18, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  sent: { alignSelf: 'flex-end', backgroundColor: colors.navy },
  received: { alignSelf: 'flex-start', backgroundColor: colors.surfaceMuted },
  sentText: { color: colors.white },
  receivedText: { color: colors.navy },
  metaSent: { color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  metaReceived: { color: colors.inkSoft, marginTop: 4 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: { flex: 1, minHeight: 48, backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, paddingHorizontal: spacing.md },
  sendButton: { minWidth: 98 },
  cancelButton: { marginTop: spacing.sm },
});
