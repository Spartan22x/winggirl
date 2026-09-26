import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PrimaryButton, Screen, SecondaryButton, Text } from '@/src/components';
import { useAuth } from '@/src/auth/AuthProvider';
import { colors, spacing } from '@/src/theme';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, signUp, signInWithProvider } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (createAccount: boolean) => {
    if (!email.trim() || !password) {
      setFeedback('Enter an email address and password to continue.');
      setFeedbackIsError(true);
      return;
    }
    setSubmitting(true);
    setFeedback('');
    try {
      const result = createAccount ? await signUp(email.trim(), password) : await signIn(email.trim(), password);
      if (result.error) {
        setFeedback(result.error.message);
        setFeedbackIsError(true);
      } else if (result.session) {
        router.replace(createAccount ? '/onboarding' : '/(tabs)');
      } else if (createAccount) {
        setFeedback('Account created. Check your email to confirm your address, then sign in.');
        setFeedbackIsError(false);
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to continue. Please try again.');
      setFeedbackIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const continueWithProvider = async (provider: 'google' | 'apple' | 'facebook') => {
    setSubmitting(true);
    setFeedback('');
    const result = await signInWithProvider(provider);
    if (result.error) {
      setFeedback(result.error.message);
      setFeedbackIsError(true);
    }
    setSubmitting(false);
  };

  return <Screen>
    <Text variant="label" style={styles.eyebrow}>WELCOME TO WINGGIRL</Text>
    <Text variant="display">Make room for good plans.</Text>
    <Text style={styles.intro}>Sign in to find your people and keep your plans in one place.</Text>
    {feedback ? <Text style={[styles.feedback, feedbackIsError && styles.feedbackError]}>{feedback}</Text> : null}
    <View style={styles.form}>
      <Text>Email</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="Enter your email" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <Text>Password</Text>
      <TextInput value={password} onChangeText={setPassword} placeholder="Enter your password" secureTextEntry style={styles.input} />
      <PrimaryButton label="Sign in" disabled={submitting} onPress={() => submit(false)} style={styles.button} />
      <SecondaryButton label="Create account" disabled={submitting} onPress={() => submit(true)} style={styles.button} />
      <SecondaryButton label="Continue with Google" disabled={submitting} onPress={() => continueWithProvider('google')} style={styles.button} />
      <SecondaryButton label="Continue with Apple" disabled={submitting} onPress={() => continueWithProvider('apple')} style={styles.button} />
      <SecondaryButton label="Continue with Facebook" disabled={submitting} onPress={() => continueWithProvider('facebook')} style={styles.button} />
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.coralDark, marginBottom: spacing.sm },
  intro: { marginTop: spacing.sm, marginBottom: spacing.xl },
  feedback: { color: colors.navyMuted, marginBottom: spacing.md },
  feedbackError: { color: colors.coralDark },
  form: { gap: spacing.sm },
  input: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, backgroundColor: colors.surfaceMuted, borderRadius: 12 },
  button: { marginTop: spacing.sm },
});