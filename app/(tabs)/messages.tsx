import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { Card, Screen, Text } from '@/src/components';
import { colors, radii, spacing } from '@/src/theme';

export default function MessagesScreen() {
  return (
    <Screen>
      <Text variant="label" style={styles.eyebrow}>STAY IN TOUCH</Text>
      <Text variant="display">Messages</Text>
      <Text style={styles.intro}>Conversations around your plans and your people will live here.</Text>
      <Card style={styles.emptyCard}>
        <View style={styles.iconCircle}><Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.coralDark} /></View>
        <Text variant="title">Your inbox is quiet</Text>
        <Text style={styles.emptyText}>Once you join a plan or connect with a Wing, your conversations will show up here.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.coralDark, marginBottom: spacing.sm },
  intro: { marginTop: spacing.sm, marginBottom: spacing.xl },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  iconCircle: { width: 64, height: 64, borderRadius: radii.pill, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  emptyText: { textAlign: 'center', marginTop: spacing.sm },
});
