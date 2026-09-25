import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Card, MessagePreview, Modal, PrimaryButton, Screen, SecondaryButton, Text } from '@/src/components';
import { initialConversations } from '@/src/mockData';
import { colors, radii, spacing } from '@/src/theme';

export default function MessagesScreen() {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState('');

  const activeConversation = activeConversationId
    ? conversations.find((conversation) => conversation.id === activeConversationId)
    : undefined;

  const sendMessage = () => {
    if (!draftMessage.trim() || !activeConversation) return;

    const nextMessage = {
      id: `msg-${Date.now()}`,
      sender: 'me',
      text: draftMessage.trim(),
      time: 'now',
      me: true,
    };

    setConversations((current) => current.map((conversation) => conversation.id === activeConversation.id ? { ...conversation, lastMessage: nextMessage.text, lastTime: 'now', messages: [...conversation.messages, nextMessage] } : conversation));
    setDraftMessage('');
  };

  return (
    <Screen>
      <Text variant="label" style={styles.eyebrow}>STAY IN TOUCH</Text>
      <Text variant="display">Messages</Text>
      <Text style={styles.intro}>Conversations around your plans and your people live here.</Text>

      <View style={styles.list}>
        {conversations.map((conversation) => (
          <MessagePreview
            key={conversation.id}
            title={conversation.title}
            lastMessage={conversation.lastMessage}
            time={conversation.lastTime}
            unread={conversation.unread}
            accent={conversation.planRelated ? '#F5E7C2' : '#F5D4C8'}
            onPress={() => setActiveConversationId(conversation.id)}
          />
        ))}
      </View>

      <Modal visible={Boolean(activeConversation)} onClose={() => setActiveConversationId(null)}>
        {activeConversation ? (
          <Card style={styles.chatCard}>
            <View style={styles.chatHeader}>
              <Text variant="title">{activeConversation.title}</Text>
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.inkSoft} />
            </View>

            <View style={styles.chatBody}>
              {activeConversation.messages.map((message) => (
                <View key={message.id} style={[styles.messageBubble, message.me ? styles.sent : styles.received]}>
                  <Text style={message.me ? styles.sentText : styles.receivedText}>{message.text}</Text>
                  <Text style={message.me ? styles.metaSent : styles.metaReceived}>{message.time}</Text>
                </View>
              ))}
            </View>

            <View style={styles.inputRow}>
              <TextInput value={draftMessage} onChangeText={setDraftMessage} placeholder="Message" style={styles.input} />
              <PrimaryButton label="Send" onPress={sendMessage} style={styles.sendButton} />
            </View>
            <SecondaryButton label="Cancel" onPress={() => setActiveConversationId(null)} style={styles.cancelButton} />
          </Card>
        ) : null}
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.coralDark, marginBottom: spacing.sm },
  intro: { marginTop: spacing.sm, marginBottom: spacing.lg },
  list: { marginBottom: spacing.xl },
  chatCard: { width: '100%', maxWidth: 420, borderRadius: 24, padding: spacing.md },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  chatBody: { maxHeight: 360, marginBottom: spacing.md },
  messageBubble: { maxWidth: '78%', borderRadius: 18, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  sent: { alignSelf: 'flex-end', backgroundColor: colors.navy },
  received: { alignSelf: 'flex-start', backgroundColor: colors.surfaceMuted },
  sentText: { color: colors.white },
  receivedText: { color: colors.navy },
  metaSent: { color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  metaReceived: { color: colors.inkSoft, marginTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: { flex: 1, minHeight: 48, backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, paddingHorizontal: spacing.md },
  sendButton: { minWidth: 98 },
  cancelButton: { marginTop: spacing.sm },
});
