import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, spacing, typography } from '@/src/theme';
import { Text } from './Text';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = 'primary', style }: ButtonProps) {
  const isSecondary = variant === 'secondary';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.base, isSecondary ? styles.secondary : styles.primary, pressed && styles.pressed, style]}
    >
      <Text style={[styles.label, isSecondary && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  primary: { backgroundColor: colors.coral },
  secondary: { backgroundColor: colors.coralSoft },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  label: { ...typography.label, color: colors.white },
  secondaryLabel: { color: colors.coralDark },
});
