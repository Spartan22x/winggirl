import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { typography } from '@/src/theme';

type Variant = keyof typeof typography;

type TextProps = RNTextProps & {
  variant?: Variant;
};

export function Text({ variant = 'body', style, ...props }: TextProps) {
  return <RNText style={[typography[variant], style]} {...props} />;
}
