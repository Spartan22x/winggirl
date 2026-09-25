import { View, StyleSheet } from 'react-native';
import { spacing } from '@/src/theme';
import { Text } from './Text';

type SectionHeaderProps = {
  title: string;
  action?: string;
  actionColor?: string;
};

export function SectionHeader({ title, action, actionColor }: SectionHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <Text variant="title">{title}</Text>
      {action ? <Text variant="label" style={[styles.action, actionColor ? { color: actionColor } : undefined]}>{action}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  action: { color: '#C85E55' },
});
