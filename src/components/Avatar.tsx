import { StyleSheet, View } from 'react-native';
import { colors } from '@/src/theme';
import { Text } from './Text';

type AvatarProps = {
  label: string;
  color?: string;
  size?: number;
  textColor?: string;
  style?: any;
};

export function Avatar({ label, color = colors.navy, size = 44, textColor = colors.white, style }: AvatarProps) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]}>
      <Text variant="title" style={[styles.text, { color: textColor, fontSize: Math.max(12, size * 0.38) }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  text: { fontWeight: '700' },
});
