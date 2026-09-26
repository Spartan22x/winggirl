import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PrimaryButton, Screen, Text } from '@/src/components';
import { useAuth } from '@/src/auth/AuthProvider';
import { saveProfile } from '@/src/data/api';
import { colors, spacing } from '@/src/theme';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [firstName, setFirstName] = useState(user?.user_metadata.first_name ?? '');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');

  const submit = async () => {
    if (!user || !firstName.trim() || !age.trim()) return;
    try {
      await saveProfile(user.id, { firstName: firstName.trim(), age: Number(age), bio: bio.trim() });
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Unable to save profile', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return <Screen>
    <Text variant="label" style={styles.eyebrow}>YOUR PROFILE</Text>
    <Text variant="display">Make it yours.</Text>
    <View style={styles.form}>
      <Text>First name</Text><TextInput value={firstName} onChangeText={setFirstName} placeholder="Your first name" style={styles.input} />
      <Text>Age</Text><TextInput value={age} onChangeText={setAge} placeholder="Your age" keyboardType="number-pad" style={styles.input} />
      <Text>Bio</Text><TextInput value={bio} onChangeText={setBio} placeholder="A little about you" multiline style={[styles.input, styles.bio]} />
      <PrimaryButton label="Continue to WingGirl" onPress={submit} style={styles.button} />
    </View>
  </Screen>;
}

const styles = StyleSheet.create({ eyebrow: { color: colors.coralDark, marginBottom: spacing.sm }, form: { marginTop: spacing.xl, gap: spacing.sm }, input: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, backgroundColor: colors.surfaceMuted, borderRadius: 12 }, bio: { minHeight: 96 }, button: { marginTop: spacing.md } });