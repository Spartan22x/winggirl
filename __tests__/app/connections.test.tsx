import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockUseEffect = require('react').useEffect;
const mockUser = { id: 'current-profile' };
const mockNavigate = jest.fn();
const mockAcceptedConnections = [
  {
    profileId: 'accepted-profile',
    connectedAt: '2026-11-04T10:00:00.000Z',
    profile: {
      id: 'accepted-profile',
      firstName: 'Alex',
      age: 30,
      bio: '',
      avatarColor: '#123456',
    },
  },
  {
    profileId: 'second-accepted-profile',
    connectedAt: '2026-11-04T11:00:00.000Z',
    profile: {
      id: 'second-accepted-profile',
      firstName: 'Taylor',
      age: 31,
      bio: '',
      avatarColor: '#654321',
    },
  },
];
const mockGetAcceptedConnections = jest.fn(async () => mockAcceptedConnections);
const mockGetIncomingConnectionRequests = jest.fn(async () => []);
const mockStartDirectConversation = jest.fn(async (_profileId: string) => 'resumed-conversation');
const mockCreateGroupConversation = jest.fn(async (_inviteeProfileIds: string[]) => 'new-group-conversation');

jest.mock('@/src/data/api', () => ({
  getAcceptedConnections: () => mockGetAcceptedConnections(),
  getIncomingConnectionRequests: () => mockGetIncomingConnectionRequests(),
  createGroupConversation: (invitees: string[]) => mockCreateGroupConversation(invitees),
  respondToConnectionRequest: jest.fn(),
  startDirectConversation: (profileId: string) => mockStartDirectConversation(profileId),
}));

jest.mock('@/src/auth/AuthProvider', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    mockUseEffect(() => callback(), [callback]);
  },
}));

jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Platform: { select: (options: Record<string, unknown>) => options.default },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: {
    create: (styles: object) => styles,
    flatten: (style: unknown) => style,
  },
  Text: 'Text',
  View: 'View',
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    navigate: mockNavigate,
    back: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock('@/src/components', () => {
  const React = require('react');
  const Button = ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) => React.createElement(
    'Pressable',
    { accessibilityRole: 'button', accessibilityState: { disabled }, onPress, disabled },
    React.createElement('Text', { accessibilityState: { disabled } }, label),
  );
  const Group = ({ children }: { children: ReactNode }) =>
    React.createElement('View', null, children);

  return {
    Avatar: Group,
    Card: Group,
    EmptyState: ({ title, message }: { title: string; message: string }) =>
      React.createElement('View', null, React.createElement('Text', null, title), React.createElement('Text', null, message)),
    PrimaryButton: Button,
    Screen: Group,
    SecondaryButton: Button,
    SectionHeader: ({ title }: { title: string }) => React.createElement('Text', null, title),
    Text: ({ children, ...props }: { children: ReactNode }) =>
      React.createElement('Text', props, children),
  };
});

const ConnectionsScreen = require('@/app/connections').default;

beforeEach(() => {
  jest.resetAllMocks();
  mockGetAcceptedConnections.mockResolvedValue(mockAcceptedConnections);
  mockGetIncomingConnectionRequests.mockResolvedValue([]);
  mockStartDirectConversation.mockResolvedValue('resumed-conversation');
  mockCreateGroupConversation.mockResolvedValue('new-group-conversation');
});

describe('ConnectionsScreen messaging entry point', () => {
  it('starts or resumes a direct conversation and navigates to its returned ID', async () => {
    const view = await render(<ConnectionsScreen />);
    await view.findByText('Alex, 30');
    await fireEvent.press(view.getAllByText('Message')[0]);

    await waitFor(() => {
      expect(mockStartDirectConversation).toHaveBeenCalledWith('accepted-profile');
      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/(tabs)/messages',
        params: { conversationId: 'resumed-conversation' },
      });
    });
  });

  it('shows a useful error when the direct-conversation RPC rejects', async () => {
    mockStartDirectConversation.mockRejectedValue(new Error('Conversation unavailable.'));
    const view = await render(<ConnectionsScreen />);
    await view.findByText('Alex, 30');
    await fireEvent.press(view.getAllByText('Message')[0]);

    expect(await view.findByText(
      'We couldn’t open this conversation. Direct messages require an accepted connection and no active block.',
    )).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('lets the user select accepted connections and requires at least two invitees', async () => {
    const view = await render(<ConnectionsScreen />);
    await view.findByText('Alex, 30');
    const createButtons = view.getAllByText('Create group');
    expect(createButtons[createButtons.length - 1].props.accessibilityState?.disabled).toBe(true);

    await fireEvent.press(view.getAllByText('Add to group')[0]);
    expect(view.getByText('1 invitees selected (choose at least 2)')).toBeTruthy();
    expect(view.getAllByText('Create group').at(-1)?.props.accessibilityState?.disabled).toBe(true);

    await fireEvent.press(view.getByText('Add to group'));
    expect(view.getByText('2 invitees selected (choose at least 2)')).toBeTruthy();
    expect(view.getAllByText('Create group').at(-1)?.props.accessibilityState?.disabled).toBe(false);
  });

  it('prevents duplicate selections by toggling a selected connection off', async () => {
    const view = await render(<ConnectionsScreen />);
    await view.findByText('Alex, 30');
    const addButtons = view.getAllByText('Add to group');

    await fireEvent.press(addButtons[0]);
    expect(view.getByText('1 invitees selected (choose at least 2)')).toBeTruthy();
    await fireEvent.press(view.getByText('Selected'));

    expect(view.getByText('0 invitees selected (choose at least 2)')).toBeTruthy();
    expect(view.getAllByText('Add to group')).toHaveLength(2);
  });

  it('does not make the current user selectable as a group invitee', async () => {
    mockGetAcceptedConnections.mockResolvedValue([
      ...mockAcceptedConnections,
      {
        profileId: 'current-profile',
        connectedAt: '2026-11-04T12:00:00.000Z',
        profile: {
          id: 'current-profile',
          firstName: 'Current',
          age: 29,
          bio: '',
          avatarColor: '#222222',
        },
      },
    ]);
    const view = await render(<ConnectionsScreen />);
    await view.findByText('Current, 29');

    expect(view.getAllByText('Add to group')).toHaveLength(2);
  });

  it('creates a group with invitees only and navigates to the returned conversation ID', async () => {
    const view = await render(<ConnectionsScreen />);
    await view.findByText('Alex, 30');
    await fireEvent.press(view.getAllByText('Add to group')[0]);
    await fireEvent.press(view.getByText('Add to group'));
    await fireEvent.press(view.getAllByText('Create group').at(-1)!);

    await waitFor(() => {
      expect(mockCreateGroupConversation).toHaveBeenCalledWith([
        'accepted-profile',
        'second-accepted-profile',
      ]);
      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/(tabs)/messages',
        params: { conversationId: 'new-group-conversation' },
      });
    });
  });

  it('shows a group creation error and keeps the selections after failure', async () => {
    mockCreateGroupConversation.mockRejectedValue(new Error('Group creation failed'));
    const view = await render(<ConnectionsScreen />);
    await view.findByText('Alex, 30');
    await fireEvent.press(view.getAllByText('Add to group')[0]);
    await fireEvent.press(view.getByText('Add to group'));
    await fireEvent.press(view.getAllByText('Create group').at(-1)!);

    expect(await view.findByText('We couldn’t create this group. Please try again.')).toBeTruthy();
    expect(view.getByText('2 invitees selected (choose at least 2)')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows a pending state and prevents duplicate group submissions', async () => {
    let resolveCreation!: (conversationId: string) => void;
    mockCreateGroupConversation.mockReturnValue(new Promise((resolve) => {
      resolveCreation = resolve;
    }));
    const view = await render(<ConnectionsScreen />);
    await view.findByText('Alex, 30');
    await fireEvent.press(view.getAllByText('Add to group')[0]);
    await fireEvent.press(view.getByText('Add to group'));
    await fireEvent.press(view.getAllByText('Create group').at(-1)!);

    expect(view.getByText('Creating group…')).toBeTruthy();
    await fireEvent.press(view.getByText('Creating group…'));
    expect(mockCreateGroupConversation).toHaveBeenCalledTimes(1);

    resolveCreation('pending-group-conversation');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/(tabs)/messages',
      params: { conversationId: 'pending-group-conversation' },
    }));
  });

  it('creates a new group on each explicit action without attempting to find an existing group', async () => {
    const view = await render(<ConnectionsScreen />);
    await view.findByText('Alex, 30');

    await fireEvent.press(view.getAllByText('Add to group')[0]);
    await fireEvent.press(view.getByText('Add to group'));
    await fireEvent.press(view.getAllByText('Create group').at(-1)!);
    await waitFor(() => expect(mockCreateGroupConversation).toHaveBeenCalledTimes(1));

    await fireEvent.press(view.getAllByText('Add to group')[0]);
    await fireEvent.press(view.getByText('Add to group'));
    await fireEvent.press(view.getAllByText('Create group').at(-1)!);
    await waitFor(() => expect(mockCreateGroupConversation).toHaveBeenCalledTimes(2));

    expect(mockCreateGroupConversation).toHaveBeenNthCalledWith(1, [
      'accepted-profile',
      'second-accepted-profile',
    ]);
    expect(mockCreateGroupConversation).toHaveBeenNthCalledWith(2, [
      'accepted-profile',
      'second-accepted-profile',
    ]);
  });
});
