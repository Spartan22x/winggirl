import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing } from '@/src/theme';

type ScreenProps = PropsWithChildren<{ contentContainerStyle?: ViewStyle }>;

export function Screen({ children, contentContainerStyle }: ScreenProps) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, contentContainerStyle]} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
});
