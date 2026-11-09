import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import type { Conversation, Message, MessageCursor, MessagePage } from '@/src/data/types';
import MessagesScreen from '@/app/(tabs)/messages';

const mockGetConversations = jest.fn(async (): Promise<Conversation[]> => []);
const mockGetConversationMessages = jest.fn(async (
  _conversationId: string,
  _options?: { pageSize?: number; before?: MessageCursor },
): Promise<MessagePage> => ({ messages: [], hasMore: false, nextCursor: null }));
const mockSendMessage = jest.fn(async (_conversationId: string, _body: string): Promise<void> => {});
const mockSetParams = jest.fn();
let mockRouteParams: { conversationId?: string } = {};
let mockRefocus: (() => void | (() => void)) | null = null;

jest.mock('@/src/data/api', () => ({
  getConversations: () => mockGetConversations(),
  getConversationMessages: (
    conversationId: string,
    options?: { pageSize?: number; before?: MessageCursor },
  ) => mockGetConversationMessages(conversationId, options),
  sendMessage: (conversationId: string, body: string) => mockSendMessage(conversationId, body),
}));

jest.mock('@expo/vector-icons/Ionicons', () => () => null);

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockRouteParams,
  useRouter: () => ({ setParams: mockSetParams }),
}));

jest.mock('@/src/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'current-profile' } }),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = require('react');
    React.useEffect(() => {
      mockRefocus = callback;
      return callback();
    }, [callback]);
  },
}));

jest.mock('@/src/components/Modal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Modal: ({
      visible,
      children,
    }: {
      visible: boolean;
      children: import('react').ReactNode;
    }) => visible ? React.createElement(View, { testID: 'conversation-modal' }, children) : null,
  };
});

function makeMessage(
  id: string,
  text: string,
  timestamp: string,
  me = false,
): Message {
  return {
    id,
    conversationId: 'conversation-1',
    senderId: me ? 'current-profile' : 'other-profile',
    sender: me ? 'Me' : 'Alex',
    text,
    createdAt: timestamp,
    time: timestamp,
    me,
  };
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  const latestMessage = makeMessage(
    'latest-message',
    'Latest preview',
    '2026-11-04T10:00:00.000Z',
  );
  return {
    id: 'conversation-1',
    createdBy: 'current-profile',
    planId: null,
    conversationType: 'direct',
    directRecipientId: 'other-profile',
    otherParticipant: {
      profileId: 'other-profile',
      firstName: 'Alex',
      profileImageUrl: null,
      avatarColor: null,
    },
    participants: [
      {
        profileId: 'current-profile',
        firstName: 'Current',
        profileImageUrl: null,
        avatarColor: null,
      },
      {
        profileId: 'other-profile',
        firstName: 'Alex',
        profileImageUrl: null,
        avatarColor: null,
      },
    ],
    title: 'Alex',
    unread: 0,
    lastMessage: latestMessage.text,
    lastTime: latestMessage.time,
    latestMessage,
    messages: [latestMessage],
    ...overrides,
  };
}

function makePage(
  messages: Message[],
  hasMore = false,
  nextCursor: MessageCursor | null = null,
): MessagePage {
  return { messages, hasMore, nextCursor };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockRefocus = null;
  mockRouteParams = {};
  mockGetConversations.mockResolvedValue([makeConversation()]);
  mockGetConversationMessages.mockResolvedValue(makePage([]));
  mockSendMessage.mockResolvedValue(undefined);
});

describe('MessagesScreen pagination button visibility after send', () => {
  it('button remains visible after sending when older messages have been loaded', async () => {
    // This test verifies that the "Load older messages" button doesn't disappear
    // after sending a message when older pages have been previously loaded.
    // Uses the exact same setup as the existing "preserves loaded history..." test
    // but explicitly checks button visibility.

    const firstCursor = { createdAt: '2026-11-04T10:01:00.000Z', id: 'middle' };
    const loadedHistoryCursor = { createdAt: '2026-11-04T09:59:00.000Z', id: 'older-first' };
    mockGetConversationMessages
      .mockResolvedValueOnce(makePage([
        makeMessage('middle', 'Middle', '2026-11-04T10:01:00.000Z'),
        makeMessage('newest', 'Newest', '2026-11-04T10:02:00.000Z'),
      ], true, firstCursor))
      .mockResolvedValueOnce(makePage([
        makeMessage('older-first', 'Older first', '2026-11-04T09:59:00.000Z'),
        makeMessage('older-second', 'Older second', '2026-11-04T10:00:00.000Z'),
      ], true, loadedHistoryCursor))
      .mockResolvedValueOnce(makePage([
        makeMessage('middle', 'Middle duplicate', '2026-11-04T10:01:00.000Z'),
        makeMessage('newest', 'Newest duplicate', '2026-11-04T10:02:00.000Z'),
        makeMessage('sent', 'Sent message', '2026-11-04T10:03:00.000Z', true),
      ], true, firstCursor));

    const view = await render(<MessagesScreen />);
    await fireEvent.press(await view.findByText('Alex'));
    await view.findByText('Newest');

    // Load older messages
    await fireEvent.press(view.getByText('Load older messages'));
    const history = view.getByTestId('message-history');
    await within(history).findByText('Older first');

    // Button should be visible before sending
    let button = view.queryByText('Load older messages');
    expect(button).not.toBeNull();

    // Send a message
    const input = await view.findByTestId('message-input');
    await fireEvent.changeText(input, 'Sent message');
    await fireEvent.press(view.getByRole('button', { name: 'Send' }));

    // Wait for send to complete
    await within(history).findByText('Sent message');
    await waitFor(() => expect(mockGetConversations).toHaveBeenCalledTimes(2));

    // CRITICAL ASSERTION: Button should still be visible after send
    button = view.queryByText('Load older messages');
    expect(button).not.toBeNull();
    expect(button).toBeTruthy();
  });
});
