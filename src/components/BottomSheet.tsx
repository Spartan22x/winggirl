import { PropsWithChildren, useEffect, useRef } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/src/theme';

type BottomSheetProps = PropsWithChildren<{ visible: boolean; onClose: () => void; title?: string; }>; 

export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  const translateY = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    Animated.spring(translateY, {
      toValue: visible ? 0 : 300,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [translateY, visible]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: Platform.OS === 'web' ? 0 : translateY }] }]}>
        <View style={styles.handle} />
        {title ? <View style={styles.header} /> : null}
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(9, 15, 24, 0.35)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  handle: { width: 52, height: 5, backgroundColor: '#D9D9D9', borderRadius: 10, alignSelf: 'center', marginBottom: spacing.md },
  header: { height: 0 },
});
