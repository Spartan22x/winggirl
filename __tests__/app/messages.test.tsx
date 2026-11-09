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

  it('opens the requested conversation from navigation parameters', async () => {
    mockRouteParams = { conversationId: 'conversation-1' };
    const firstMessage = makeMessage('first-message', 'Opened from connection', '2026-11-04T10:00:00.000Z');
    mockGetConversationMessages.mockResolvedValue(makePage([firstMessage]));
    const view = await render(<MessagesScreen />);

    expect(await view.findByText('Opened from connection')).toBeTruthy();
    expect(mockGetConversationMessages).toHaveBeenCalledWith('conversation-1', { pageSize: 30 });
    expect(mockSetParams).toHaveBeenCalledWith({ conversationId: undefined });
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

  it('preserves loaded history and its cursor when sending, then loads another older page', async () => {
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
      ], true, firstCursor))
      .mockResolvedValueOnce(makePage([
        makeMessage('earlier', 'Earlier message', '2026-11-04T09:58:00.000Z'),
      ]));
    const view = await render(<MessagesScreen />);
    await fireEvent.press(await view.findByText('Alex'));
    await view.findByText('Newest');
    await fireEvent.press(view.getByText('Load older messages'));

    const history = view.getByTestId('message-history');
    await within(history).findByText('Older first');
    const input = await view.findByTestId('message-input');
    await fireEvent.changeText(input, 'Sent message');
    await fireEvent.press(view.getByRole('button', { name: 'Send' }));

    await within(history).findByText('Sent message');
    await waitFor(() => expect(mockGetConversations).toHaveBeenCalledTimes(2));
    expect(within(history).getAllByText('Middle')).toHaveLength(1);
    expect(within(history).queryByText('Middle duplicate')).toBeNull();
    expect(within(history).queryByText('Newest duplicate')).toBeNull();
    expect(within(history).getAllByText(/^(Older first|Older second|Middle|Newest|Sent message)$/)
      .map((node) => node.props.children)).toEqual([
      'Older first',
      'Older second',
      'Middle',
      'Newest',
      'Sent message',
    ]);

    await fireEvent.press(view.getByText('Load older messages'));
    expect(mockGetConversationMessages).toHaveBeenLastCalledWith('conversation-1', {
      pageSize: 30,
      before: loadedHistoryCursor,
    });
    await within(history).findByText('Earlier message');
    expect(within(history).getAllByText(/^(Earlier message|Older first|Older second|Middle|Newest|Sent message)$/)
      .map((node) => node.props.children)).toEqual([
      'Earlier message',
      'Older first',
      'Older second',
      'Middle',
      'Newest',
      'Sent message',
    ]);
  });

  it('ignores a pending older-page response after switching conversations', async () => {
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
    const olderResponse = deferred<MessagePage>();
    mockGetConversations.mockResolvedValue([makeConversation(), secondConversation]);
    mockGetConversationMessages
      .mockResolvedValueOnce(makePage([
        makeMessage('middle', 'Middle', '2026-11-04T10:01:00.000Z'),
        makeMessage('newest', 'Newest', '2026-11-04T10:02:00.000Z'),
      ], true, { createdAt: '2026-11-04T10:01:00.000Z', id: 'middle' }))
      .mockReturnValueOnce(olderResponse.promise)
      .mockResolvedValueOnce(makePage([
        makeMessage('grace-message', 'Grace history', '2026-11-04T11:00:00.000Z'),
      ]));
    const view = await render(<MessagesScreen />);
    await fireEvent.press(await view.findByText('Alex'));
    await view.findByText('Newest');
    await fireEvent.press(view.getByText('Load older messages'));
    await fireEvent.press(view.getByText('Grace'));
    const history = view.getByTestId('message-history');
    await within(history).findByText('Grace history');

    olderResponse.resolve(makePage([
      makeMessage('stale-older', 'Stale older message', '2026-11-04T10:00:00.000Z'),
    ]));

    await waitFor(() => expect(view.queryByTestId('loading-older-messages')).toBeNull());
    expect(within(history).queryByText('Stale older message')).toBeNull();
    expect(within(history).getByText('Grace history')).toBeTruthy();
  });

  it('does not let a send completion invalidate the newly opened conversation history', async () => {
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
    const pendingSend = deferred<void>();
    const secondHistory = deferred<MessagePage>();
    mockGetConversations.mockResolvedValue([makeConversation(), secondConversation]);
    mockGetConversationMessages
      .mockResolvedValueOnce(makePage([
        makeMessage('alex-message', 'Alex history', '2026-11-04T10:00:00.000Z'),
      ]))
      .mockReturnValueOnce(secondHistory.promise);
    mockSendMessage.mockReturnValue(pendingSend.promise);

    const view = await render(<MessagesScreen />);
    await fireEvent.press(await view.findByText('Alex'));
    await view.findByText('Alex history');
    await fireEvent.changeText(await view.findByTestId('message-input'), 'Pending send');
    await fireEvent.press(view.getByRole('button', { name: 'Send' }));

    await fireEvent.press(view.getByText('Cancel'));
    await fireEvent.press(view.getByText('Grace'));
    expect(await view.findByTestId('history-loading')).toBeTruthy();
    expect(mockGetConversationMessages).toHaveBeenCalledTimes(2);
    expect(mockGetConversationMessages).toHaveBeenLastCalledWith('conversation-2', {
      pageSize: 30,
    });

    await act(async () => {
      pendingSend.resolve(undefined);
      await pendingSend.promise;
    });
    await waitFor(() => expect(mockGetConversations).toHaveBeenCalledTimes(2));
    expect(mockGetConversationMessages).toHaveBeenCalledTimes(2);
    expect(view.getByTestId('history-loading')).toBeTruthy();

    await act(async () => {
      secondHistory.resolve(makePage([
        makeMessage('grace-message', 'Grace history loaded', '2026-11-04T11:00:00.000Z'),
      ]));
      await secondHistory.promise;
    });
    const history = view.getByTestId('message-history');
    expect(await within(history).findByText('Grace history loaded')).toBeTruthy();
    expect(view.queryByTestId('history-loading')).toBeNull();
  });

  it('keeps a pending older-page cursor retryable after sending a message', async () => {
    const firstCursor = { createdAt: '2026-11-04T10:01:00.000Z', id: 'middle' };
    const retryCursor = { createdAt: '2026-11-04T10:00:00.000Z', id: 'older' };
    const pendingOlderPage = deferred<MessagePage>();
    const pendingSend = deferred<void>();
    const latestPage = deferred<MessagePage>();
    const retryPage = deferred<MessagePage>();
    mockGetConversationMessages
      .mockResolvedValueOnce(makePage([
        makeMessage('middle', 'Middle', '2026-11-04T10:01:00.000Z'),
        makeMessage('newest', 'Newest', '2026-11-04T10:02:00.000Z'),
      ], true, firstCursor))
      .mockReturnValueOnce(pendingOlderPage.promise)
      .mockReturnValueOnce(latestPage.promise)
      .mockReturnValueOnce(retryPage.promise)
      .mockResolvedValueOnce(makePage([
        makeMessage('oldest', 'Oldest', '2026-11-04T09:59:00.000Z'),
      ]));
    mockSendMessage.mockReturnValue(pendingSend.promise);

    const view = await render(<MessagesScreen />);
    await fireEvent.press(await view.findByText('Alex'));
    await view.findByText('Newest');
    await fireEvent.press(view.getByText('Load older messages'));
    expect(await view.findByTestId('loading-older-messages')).toBeTruthy();

    await fireEvent.changeText(await view.findByTestId('message-input'), 'Sent while loading');
    await fireEvent.press(view.getByRole('button', { name: 'Send' }));
    await act(async () => {
      pendingSend.resolve(undefined);
      await pendingSend.promise;
    });
    await waitFor(() => expect(mockGetConversationMessages).toHaveBeenCalledTimes(3));
    expect(mockGetConversationMessages).toHaveBeenLastCalledWith('conversation-1', {
      pageSize: 30,
    });

    await act(async () => {
      latestPage.resolve(makePage([
        makeMessage('middle', 'Middle duplicate', '2026-11-04T10:01:00.000Z'),
        makeMessage('newest', 'Newest duplicate', '2026-11-04T10:02:00.000Z'),
        makeMessage('sent', 'Sent while loading', '2026-11-04T10:03:00.000Z', true),
      ], true, firstCursor));
      await latestPage.promise;
    });
    const history = view.getByTestId('message-history');
    expect(await within(history).findByText('Sent while loading')).toBeTruthy();
    expect(view.queryByTestId('loading-older-messages')).toBeNull();
    expect(view.getByText('Load older messages')).toBeTruthy();

    await act(async () => {
      pendingOlderPage.resolve(makePage([
        makeMessage('stale-older', 'Stale older page', '2026-11-04T09:58:00.000Z'),
      ], true, retryCursor));
      await pendingOlderPage.promise;
    });
    expect(within(history).queryByText('Stale older page')).toBeNull();
    expect(view.queryByTestId('loading-older-messages')).toBeNull();
    expect(view.getByText('Load older messages')).toBeTruthy();

    await fireEvent.press(view.getByText('Load older messages'));
    expect(mockGetConversationMessages).toHaveBeenLastCalledWith('conversation-1', {
      pageSize: 30,
      before: firstCursor,
    });
    await act(async () => {
      retryPage.resolve(makePage([
        makeMessage('older', 'Older page', '2026-11-04T10:00:00.000Z'),
        makeMessage('middle', 'Middle duplicate', '2026-11-04T10:01:00.000Z'),
      ], true, retryCursor));
      await retryPage.promise;
    });
    expect(await within(history).findByText('Older page')).toBeTruthy();
    expect(within(history).queryByText('Middle duplicate')).toBeNull();
    expect(within(history).queryByText('Stale older page')).toBeNull();
    expect(within(history).getAllByText(/^(Older page|Middle|Newest|Sent while loading)$/)
      .map((node) => node.props.children)).toEqual([
      'Older page',
      'Middle',
      'Newest',
      'Sent while loading',
    ]);

    await fireEvent.press(view.getByText('Load older messages'));
    expect(mockGetConversationMessages).toHaveBeenLastCalledWith('conversation-1', {
      pageSize: 30,
      before: retryCursor,
    });
    expect(await within(history).findByText('Oldest')).toBeTruthy();
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
