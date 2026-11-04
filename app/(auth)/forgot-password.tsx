import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/auth/AuthProvider';
import { PrimaryButton, Screen, Text } from '@/src/components';
import { colors, spacing } from '@/src/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!email.trim()) {
      setFeedback('Enter the email address associated with your account.');
      setFeedbackIsError(true);
      return;
    }

    setSubmitting(true);
    setFeedback('');
    try {
      const { error } = await resetPassword(email.trim());
      if (error) {
        setFeedback(error.message);
        setFeedbackIsError(true);
      } else {
        setSubmitted(true);
        setFeedback('If an account exists for that email, a password reset link is on its way. Check your inbox and spam folder.');
        setFeedbackIsError(false);
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to send a reset link. Please try again.');
      setFeedbackIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return <Screen>
    <Text variant="label" style={styles.eyebrow}>PASSWORD HELP</Text>
    <Text variant="display">Reset your password</Text>
    <Text style={styles.intro}>Enter your account email and we’ll send you a link to choose a new password.</Text>
    {feedback ? <Text accessibilityRole={feedbackIsError ? 'alert' : 'text'} style={[styles.feedback, feedbackIsError && styles.feedbackError]}>{feedback}</Text> : null}
    {!submitted ? <View style={styles.form}>
      <Text>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Enter your email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        style={styles.input}
      />
      <PrimaryButton label={submitting ? 'Sending...' : 'Send reset link'} disabled={submitting} onPress={submit} style={styles.button} />
    </View> : null}
    <Text accessibilityRole="link" onPress={() => router.replace('/(auth)/sign-in')} style={styles.backLink}>Back to sign in</Text>
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
  backLink: { color: colors.coralDark, textAlign: 'center', paddingVertical: spacing.lg },
});
