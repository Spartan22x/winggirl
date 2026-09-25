import { PropsWithChildren } from 'react';
import { Modal as RNModal, Pressable, StyleSheet, View } from 'react-native';
import { spacing } from '@/src/theme';

type ModalProps = PropsWithChildren<{ visible: boolean; onClose: () => void }>; 

export function Modal({ visible, onClose, children }: ModalProps) {
  return (
    <RNModal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.container}>{children}</View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(8, 13, 20, 0.35)' },
  container: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
});
