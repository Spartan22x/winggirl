import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/auth/AuthProvider';
import { PrimaryButton, Screen, Text } from '@/src/components';
import { colors, spacing } from '@/src/theme';

type ResetState = 'loading' | 'ready' | 'invalid' | 'success';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { updatePassword } = useAuth();
  const handledUrl = useRef('');
  const [state, setState] = useState<ResetState>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    const handleRecoveryUrl = async (url: string | null) => {
      if (!url || handledUrl.current === url) return;
      handledUrl.current = url;

      try {
        const parsedUrl = new URL(url);
        const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
        const errorDescription = parsedUrl.searchParams.get('error_description') ?? hashParams.get('error_description');
        if (errorDescription) {
          if (active) {
            setFeedback(errorDescription.replace(/\+/g, ' '));
            setFeedbackIsError(true);
            setState('invalid');
          }
          return;
        }

        const code = parsedUrl.searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          const type = hashParams.get('type') ?? parsedUrl.searchParams.get('type');
          if (!accessToken || !refreshToken || type !== 'recovery') {
            if (active) {
              setFeedback('This reset link is invalid or has expired. Request a new one to continue.');
              setFeedbackIsError(true);
              setState('invalid');
            }
            return;
          }

          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        }

        if (active) {
          setFeedback('');
          setState('ready');
          if (Platform.OS === 'web') {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      } catch (error) {
        if (active) {
          setFeedback(error instanceof Error ? error.message : 'Unable to verify this reset link. Request a new one to continue.');
          setFeedbackIsError(true);
          setState('invalid');
        }
      }
    };

    if (Platform.OS === 'web') {
      void handleRecoveryUrl(window.location.href);
    } else {
      const subscription = Linking.addEventListener('url', ({ url }) => {
        void handleRecoveryUrl(url);
      });
      void Linking.getInitialURL().then(handleRecoveryUrl).catch((error: unknown) => {
        if (active) {
          setFeedback(error instanceof Error ? error.message : 'Unable to open the reset link.');
          setFeedbackIsError(true);
          setState('invalid');
        }
      });
      return () => {
        active = false;
        subscription.remove();
      };
    }

    return () => {
      active = false;
    };
  }, []);

  const submit = async () => {
    if (password.length < 8) {
      setFeedback('Your new password must be at least 8 characters.');
      setFeedbackIsError(true);
      return;
    }
    if (password !== confirmPassword) {
      setFeedback('The passwords do not match.');
      setFeedbackIsError(true);
      return;
    }

    setSubmitting(true);
    setFeedback('');
    try {
      const { error } = await updatePassword(password);
      if (error) {
        setFeedback(error.message);
        setFeedbackIsError(true);
      } else {
        setFeedback('Your password has been updated. You can continue to WingGirl.');
        setFeedbackIsError(false);
        setState('success');
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to update your password. Please try again.');
      setFeedbackIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return <Screen>
    <Text variant="label" style={styles.eyebrow}>PASSWORD HELP</Text>
    <Text variant="display">{state === 'success' ? 'Password updated' : 'Choose a new password'}</Text>
    {feedback ? <Text accessibilityRole={feedbackIsError ? 'alert' : 'text'} style={[styles.feedback, feedbackIsError && styles.feedbackError]}>{feedback}</Text> : null}
    {state === 'loading' ? <Text style={styles.intro}>Verifying your reset link…</Text> : null}
    {state === 'ready' ? <View style={styles.form}>
      <Text>New password</Text>
      <TextInput value={password} onChangeText={setPassword} placeholder="At least 8 characters" autoCapitalize="none" secureTextEntry style={styles.input} />
      <Text>Confirm new password</Text>
      <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Enter your new password again" autoCapitalize="none" secureTextEntry style={styles.input} />
      <PrimaryButton label={submitting ? 'Updating…' : 'Update password'} disabled={submitting} onPress={submit} style={styles.button} />
    </View> : null}
    {state === 'success' ? <PrimaryButton label="Continue to WingGirl" onPress={() => router.replace('/(tabs)')} style={styles.button} /> : null}
    {state === 'invalid' ? <PrimaryButton label="Request a new link" onPress={() => router.replace('/(auth)/forgot-password')} style={styles.button} /> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.coralDark, marginBottom: spacing.sm },
  intro: { marginTop: spacing.sm, marginBottom: spacing.xl },
  feedback: { color: colors.navyMuted, marginVertical: spacing.md },
  feedbackError: { color: colors.coralDark },
  form: { gap: spacing.sm },
  input: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, backgroundColor: colors.surfaceMuted, borderRadius: 12 },
  button: { marginTop: spacing.md },
});
