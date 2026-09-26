import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/src/auth/AuthProvider';
import { getProfile } from '@/src/data/api';
import { colors } from '@/src/theme';

export default function EntryRoute() {
  const { user, loading } = useAuth();
  const [profileReady, setProfileReady] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setProfileReady(null);
      return;
    }
    getProfile(user.id).then((profile) => setProfileReady(profile.age !== null)).catch(() => setProfileReady(false));
  }, [user]);

  if (loading || (user && profileReady === null)) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.coral} /></View>;
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  return <Redirect href={profileReady ? '/(tabs)' : '/onboarding'} />;
}