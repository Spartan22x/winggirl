import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '@/src/theme';
import { Avatar } from './Avatar';
import { Text } from './Text';

type MessagePreviewProps = {
  title: string;
  lastMessage: string;
  time: string;
  unread?: number;
  onPress?: () => void;
  accent?: string;
};

export function MessagePreview({ title, lastMessage, time, unread = 0, onPress, accent = '#F5D4C8' }: MessagePreviewProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Avatar label={title.slice(0, 1)} color={accent} size={48} textColor={colors.navy} />
      <View style={styles.center}>
        <View style={styles.row}>
          <Text variant="title" style={styles.name}>{title}</Text>
          <Text variant="label" style={styles.time}>{time}</Text>
        </View>
        <Text style={styles.message} numberOfLines={1}>{lastMessage}</Text>
      </View>
      {unread > 0 ? <View style={styles.badge}><Text variant="label" style={styles.badgeText}>{unread}</Text></View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  pressed: { opacity: 0.9 },
  center: { flex: 1, marginLeft: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontSize: 18, lineHeight: 24 },
  time: { color: colors.inkSoft, fontSize: 10 },
  message: { color: colors.navyMuted },
  badge: { minWidth: 22, height: 22, borderRadius: radii.pill, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm },
  badgeText: { color: colors.white, fontSize: 10 },
});
