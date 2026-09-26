import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '@/src/theme';
import { Text } from './Text';

type SecondaryButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
};

export function SecondaryButton({ label, onPress, disabled, style }: SecondaryButtonProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled, style]}>
      <Text variant="label" style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.coralSoft, minHeight: 52, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.6 },
  label: { color: colors.coralDark, letterSpacing: 0.5 },
});
