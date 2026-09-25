import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { colors, typography } from '@/src/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const icons: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: 'home', inactive: 'home-outline' },
  discover: { active: 'compass', inactive: 'compass-outline' },
  plans: { active: 'calendar', inactive: 'calendar-outline' },
  messages: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.coral,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarLabelStyle: { ...typography.label, fontSize: 11, lineHeight: 14 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 84, paddingTop: 8 },
        tabBarIcon: ({ focused, color, size }) => {
          const icon = icons[route.name];
          return <Ionicons name={focused ? icon.active : icon.inactive} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
      <Tabs.Screen name="plans" options={{ title: 'Plans' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
