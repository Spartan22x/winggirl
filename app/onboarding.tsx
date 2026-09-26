import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { PrimaryButton, Screen, Text } from '@/src/components';
import { colors, spacing } from '@/src/theme';

export default function OnboardingScreen() {
  const router = useRouter();
  return <Screen>
    <Text variant="label" style={styles.eyebrow}>A LITTLE ABOUT YOU</Text>
    <Text variant="display">Let&apos;s set up your profile.</Text>
    <Text style={styles.body}>A few details help WingGirl make better, more thoughtful recommendations.</Text>
    <PrimaryButton label="Set up my profile" onPress={() => router.replace('/profile-setup')} />
  </Screen>;
}

const styles = StyleSheet.create({ eyebrow: { color: colors.coralDark, marginBottom: spacing.sm }, body: { marginVertical: spacing.xl } });