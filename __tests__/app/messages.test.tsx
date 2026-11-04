import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import type { Conversation, Message, MessageCursor, MessagePage } from '@/src/data/types';
import MessagesScreen from '@/app/(tabs)/messages';

const mockGetConversations = jest.fn(async (): Promise<Conversation[]> => []);
const mockGetConversationMessages = jest.fn(async (
  _conversationId: string,
  _options?: { pageSize?: number; before?: MessageCursor },
): Promise<MessagePage> => ({ messages: [], hasMore: false, nextCursor: null }));
const mockSendMessage = jest.fn(async (_conversationId: string, _body: string): Promise<void> => {});
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
  mockGetConversations.mockResolvedValue([makeConversation()]);
  mockGetConversationMessages.mockResolvedValue(makePage([]));
  mockSendMessage.mockResolvedValue(undefined);
});

describe('MessagesScreen conversation list', () => {
  it('shows an initial loading indicator', async () => {
    const response = deferred<Conversation[]>();
    mockGetConversations.mockReturnValue(response.promise);
    const view = await render(<MessagesScreen />);

    expect(view.getByText('Loading conversations…')).toBeTruthy();
    response.resolve([]);
    await view.findByText('No conversations yet');
  });

  it('shows an empty state when there are no conversations', async () => {
    mockGetConversations.mockResolvedValue([]);
    const view = await render(<MessagesScreen />);

    expect(await view.findByText('No conversations yet')).toBeTruthy();
  });

  it('shows list errors and retries the request', async () => {
    mockGetConversations
      .mockRejectedValueOnce(new Error('Conversation list failed'))
      .mockResolvedValueOnce([makeConversation()]);
    const view = await render(<MessagesScreen />);

    expect(await view.findByText('Conversation list failed')).toBeTruthy();
    await fireEvent.press(view.getByText('Try again'));
    expect(await view.findByText('Alex')).toBeTruthy();
    expect(mockGetConversations).toHaveBeenCalledTimes(2);
  });

  it('refreshes the list from its pull-to-refresh control', async () => {
    const view = await render(<MessagesScreen />);
    await view.findByText('Alex');

    const refreshNodes = view.container.queryAll((instance) => instance.type === 'RCTRefreshControl');
    await fireEvent(refreshNodes[0], 'refresh');
    await waitFor(() => expect(mockGetConversations).toHaveBeenCalledTimes(2));
  });

  it('reloads conversations when the tab regains focus', async () => {
    const view = await render(<MessagesScreen />);
    await view.findByText('Alex');

    await act(async () => {
      mockRefocus?.();
    });
    await waitFor(() => expect(mockGetConversations).toHaveBeenCalledTimes(2));
  });

  it('shows direct titles and the latest-message preview', async () => {
    const view = await render(<MessagesScreen />);

    expect(await view.findByText('Alex')).toBeTruthy();
    expect(view.getByText('Latest preview')).toBeTruthy();
    expect(mockGetConversations).toHaveBeenCalledWith();
  });

  it('labels groups using other participant names and falls back when a name is missing', async () => {
    const group = makeConversation({
      conversationType: 'group',
      title: 'Group conversation',
      participants: [
        { profileId: 'current-profile', firstName: 'Current', profileImageUrl: null, avatarColor: null },
        { profileId: 'profile-a', firstName: 'Amanda', profileImageUrl: null, avatarColor: null },
        { profileId: 'profile-b', firstName: 'Sarah', profileImageUrl: null, avatarColor: null },
        { profileId: 'profile-c', firstName: 'Taylor', profileImageUrl: null, avatarColor: null },
      ],
    });
    const groupWithoutNames = makeConversation({
      id: 'group-without-names',
      conversationType: 'group',
      title: 'Group conversation',
      participants: [
        { profileId: 'current-profile', firstName: 'Current', profileImageUrl: null, avatarColor: null },
        { profileId: 'profile-a', firstName: null, profileImageUrl: null, avatarColor: null },
        { profileId: 'profile-b', firstName: 'Sarah', profileImageUrl: null, avatarColor: null },
      ],
    });
    mockGetConversations.mockResolvedValue([group, groupWithoutNames]);
    const view = await render(<MessagesScreen />);

    expect(await view.findByText('Amanda, Sarah + 1')).toBeTruthy();
    expect(view.getByText('Group conversation')).toBeTruthy();
  });
});

describe('MessagesScreen conversation history', () => {
  it('loads the newest 30 messages when a conversation opens', async () => {
    const newest = makeMessage('newest', 'Newest message', '2026-11-04T10:00:00.000Z');
    mockGetConversationMessages.mockResolvedValue(makePage([newest]));
    const view = await render(<MessagesScreen />);
    await fireEvent.press(await view.findByText('Alex'));

    expect(await view.findByText('Newest message')).toBeTruthy();
    expect(mockGetConversationMessages).toHaveBeenCalledWith('conversation-1', { pageSize: 30 });
  });

  it('shows an empty history state', async () => {
    mockGetConversationMessages.mockResolvedValue(makePage([]));
    const view = await render(<MessagesScreen />);
    await fireEvent.press(await view.findByText('Alex'));

    expect(await view.findByText('No messages yet. Say hello!')).toBeTruthy();
  });

  it('shows a history error and retries the first page', async () => {
    mockGetConversationMessages
      .mockRejectedValueOnce(new Error('History unavailable'))
      .mockResolvedValueOnce(makePage([makeMessage('message-1', 'Recovered', '2026-11-04T10:00:00.000Z')]));
    const view = await render(<MessagesScreen />);
    await fireEvent.press(await view.findByText('Alex'));

    expect(await view.findByText('History unavailable')).toBeTruthy();
    await fireEvent.press(view.getByText('Try again'));
    expect(await view.findByText('Recovered')).toBeTruthy();
    expect(mockGetConversationMessages).toHaveBeenCalledTimes(2);
  });

  it('loads older messages, prepends chronologically, and deduplicates message IDs', async () => {
    const cursor = { createdAt: '2026-11-04T10:01:00.000Z', id: 'middle' };
    const olderResponse = deferred<MessagePage>();
    mockGetConversationMessages
      .mockResolvedValueOnce(makePage([
        makeMessage('middle', 'Middle', '2026-11-04T10:01:00.000Z'),
        makeMessage('newest', 'Newest', '2026-11-04T10:02:00.000Z'),
      ], true, cursor))
      .mockReturnValueOnce(olderResponse.promise);
    const view = await render(<MessagesScreen />);
    await fireEvent.press(await view.findByText('Alex'));
    await view.findByText('Newest');

    const loadOlderButton = view.getByText('Load older messages');
    await fireEvent.press(loadOlderButton);
    await fireEvent.press(loadOlderButton);
    expect(mockGetConversationMessages).toHaveBeenCalledTimes(2);
    expect(mockGetConversationMessages).toHaveBeenLastCalledWith('conversation-1', {
      pageSize: 30,
      before: cursor,
    });

    olderResponse.resolve(makePage([
      makeMessage('oldest', 'Oldest', '2026-11-04T10:00:00.000Z'),
      makeMessage('middle', 'Middle duplicate', '2026-11-04T10:01:00.000Z'),
    ], false));
    const history = view.getByTestId('message-history');
    await within(history).findByText('Oldest');
    await waitFor(() => expect(view.queryByTestId('loading-older-messages')).toBeNull());
    expect(within(history).getAllByText('Middle')).toHaveLength(1);
    expect(within(history).queryByText('Middle duplicate')).toBeNull();
    const renderedMessages = within(history)
      .getAllByText(/^(Oldest|Middle|Newest)$/)
      .map((node) => node.props.children);
    expect(renderedMessages).toEqual(['Oldest', 'Middle', 'Newest']);
  });
});

describe('MessagesScreen composer', () => {
  it('disables empty sends and prevents duplicate sends while one is pending', async () => {
    const pendingSend = deferred<void>();
    mockSendMessage.mockReturnValue(pendingSend.promise);
    const view = await render(<MessagesScreen />);
    await fireEvent.press(await view.findByText('Alex'));
    const emptySendButton = view.getByRole('button', { name: 'Send' });

    expect(emptySendButton.props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(emptySendButton);
    expect(mockSendMessage).not.toHaveBeenCalled();

    await fireEvent.changeText(await view.findByTestId('message-input'), 'One message');
    await fireEvent.press(view.getByRole('button', { name: 'Send' }));
    expect(await view.findByText('Sending…')).toBeTruthy();
    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    const pendingButton = view.getByRole('button', { name: 'Sending…' });
    expect(pendingButton.props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(pendingButton);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    pendingSend.resolve(undefined);
    await view.findByText('No messages yet. Say hello!');
  });

  it('sends successfully, clears the draft, refreshes history and list, and keeps the latest message visible', async () => {
    const updatedMessage = makeMessage(
      'sent-message',
      'Hello there',
      '2026-11-04T10:03:00.000Z',
      true,
    );
    mockGetConversationMessages
      .mockResolvedValueOnce(makePage([]))
      .mockResolvedValueOnce(makePage([updatedMessage]));
    const view = await render(<MessagesScreen />);
    await fireEvent.press(await view.findByText('Alex'));
    const input = await view.findByTestId('message-input');
    await fireEvent.changeText(input, '  Hello there  ');
    await fireEvent.press(view.getByRole('button', { name: 'Send' }));

    expect(mockSendMessage).toHaveBeenCalledWith('conversation-1', 'Hello there');
    expect(await view.findByText('Hello there')).toBeTruthy();
    await waitFor(() => expect(mockGetConversations).toHaveBeenCalledTimes(2));
    expect(mockGetConversationMessages).toHaveBeenCalledTimes(2);
    expect(view.getByTestId('message-input').props.value).toBe('');
  });

  it('preserves the draft and displays an error when sending fails', async () => {
    mockSendMessage.mockRejectedValue(new Error('Send failed'));
    const view = await render(<MessagesScreen />);
    await fireEvent.press(await view.findByText('Alex'));
    const input = await view.findByTestId('message-input');
    await fireEvent.changeText(input, 'Keep this draft');
    await fireEvent.press(view.getByRole('button', { name: 'Send' }));

    expect(await view.findByText('Send failed')).toBeTruthy();
    expect(view.getByTestId('message-input').props.value).toBe('Keep this draft');
  });

  it('clears the draft when closing the modal or switching conversations', async () => {
    const secondConversation = makeConversation({
      id: 'conversation-2',
      title: 'Grace',
      directRecipientId: 'grace-profile',
      otherParticipant: {
        profileId: 'grace-profile',
        firstName: 'Grace',
        profileImageUrl: null,
        avatarColor: null,
      },
    });
    mockGetConversations.mockResolvedValue([makeConversation(), secondConversation]);
    const view = await render(<MessagesScreen />);

    await fireEvent.press(await view.findByText('Alex'));
    await fireEvent.changeText(await view.findByTestId('message-input'), 'First draft');
    await fireEvent.press(view.getByText('Cancel'));
    await fireEvent.press(view.getByText('Alex'));
    expect((await view.findByTestId('message-input')).props.value).toBe('');

    await fireEvent.changeText(view.getByTestId('message-input'), 'Second draft');
    await fireEvent.press(view.getByText('Grace'));
    await waitFor(() => {
      expect(mockGetConversationMessages).toHaveBeenLastCalledWith('conversation-2', { pageSize: 30 });
    });
    expect(view.getByTestId('message-input').props.value).toBe('');
  });
});
