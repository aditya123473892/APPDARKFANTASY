import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
export function ChatInput({ onSend }: { onSend: (value: string) => void }): React.JSX.Element {
  const [value, setValue] = useState('');
  const { theme } = useTheme();
  const send = (): void => {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue('');
  };
  return (
    <View
      style={[
        styles.root,
        { borderTopColor: theme.colors.border, backgroundColor: theme.colors.background },
      ]}
    >
      <TextInput
        accessibilityLabel="Message"
        placeholder="Write a message…"
        placeholderTextColor={theme.colors.textMuted}
        multiline
        maxLength={1000}
        value={value}
        onChangeText={setValue}
        style={[
          styles.input,
          { color: theme.colors.text, backgroundColor: theme.colors.surfaceMuted },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send message"
        disabled={!value.trim()}
        onPress={send}
        style={[
          styles.send,
          { backgroundColor: value.trim() ? theme.colors.primary : theme.colors.surfaceMuted },
        ]}
      >
        <Ionicons
          name="arrow-up"
          size={22}
          color={value.trim() ? theme.palette.white : theme.colors.textMuted}
        />
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { borderTopWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 46,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    fontSize: 15,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
