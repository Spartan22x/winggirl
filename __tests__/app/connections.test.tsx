import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockUseEffect = require('react').useEffect;
const mockUser = { id: 'current-profile' };
const mockNavigate = jest.fn();
const mockGetAcceptedConnections = jest.fn(async () => [{
  profileId: 'accepted-profile',
  connectedAt: '2026-11-04T10:00:00.000Z',
  profile: {
    id: 'accepted-profile',
    firstName: 'Alex',
    age: 30,
    bio: '',
    avatarColor: '#123456',
  },
}]);
const mockGetIncomingConnectionRequests = jest.fn(async () => []);
const mockStartDirectConversation = jest.fn(async (_profileId: string) => 'resumed-conversation');

jest.mock('@/src/data/api', () => ({
  getAcceptedConnections: () => mockGetAcceptedConnections(),
  getIncomingConnectionRequests: () => mockGetIncomingConnectionRequests(),
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
    React.createElement('Text', null, label),
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
  mockGetAcceptedConnections.mockResolvedValue([{
    profileId: 'accepted-profile',
    connectedAt: '2026-11-04T10:00:00.000Z',
    profile: {
      id: 'accepted-profile',
      firstName: 'Alex',
      age: 30,
      bio: '',
      avatarColor: '#123456',
    },
  }]);
  mockGetIncomingConnectionRequests.mockResolvedValue([]);
  mockStartDirectConversation.mockResolvedValue('resumed-conversation');
});

describe('ConnectionsScreen messaging entry point', () => {
  it('starts or resumes a direct conversation and navigates to its returned ID', async () => {
    const view = await render(<ConnectionsScreen />);
    await view.findByText('Alex, 30');
    await fireEvent.press(view.getByText('Message'));

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
    await fireEvent.press(view.getByText('Message'));

    expect(await view.findByText(
      'We couldn’t open this conversation. Direct messages require an accepted connection and no active block.',
    )).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
