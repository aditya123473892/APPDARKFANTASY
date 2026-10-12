import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Text, ThreadLine, Toast } from '@/components/ui';
import { currentUser } from '@/mocks/users';
import { mockImages } from '@/mocks/images';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/useTheme';

const LIMIT = 500;
const tools: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'image-outline', label: 'Add image' }, { icon: 'camera-outline', label: 'Open camera' },
  { icon: 'happy-outline', label: 'Add GIF' }, { icon: 'stats-chart-outline', label: 'Add poll' }, { icon: 'location-outline', label: 'Add location' },
];

export function CreatePostScreen(): React.JSX.Element {
  const router = useRouter(); const { theme } = useTheme();
  const [value, setValue] = useState(''); const [audience, setAudience] = useState<'Everyone' | 'Matches only'>('Everyone'); const [posted, setPosted] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const enabled = value.trim().length > 0 && value.length <= LIMIT;
  const submit = (): void => { if (!enabled) return; void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setPosted(true); setValue(''); setTimeout(() => { setPosted(false); router.back(); }, 900); };
  const countColor = value.length > LIMIT ? theme.colors.danger : value.length > LIMIT * 0.85 ? theme.colors.primary : theme.colors.textMuted;
  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { borderBottomColor: theme.colors.divider }]}>
        <Pressable onPress={() => router.back()} style={styles.headerAction}><Text>Cancel</Text></Pressable>
        <Text variant="label">New post</Text>
        <Pressable disabled={!enabled} onPress={submit} style={[styles.postButton, { backgroundColor: enabled ? theme.colors.primary : theme.colors.surfaceElevated }]}><Text variant="label" style={{ color: enabled ? theme.palette.white : theme.colors.textMuted }}>Post</Text></Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <View style={styles.composer}>
          <View style={styles.rail}><Avatar uri={currentUser.avatarUri} label="Your avatar" size={40} /><ThreadLine /></View>
          <View style={styles.inputColumn}><Text variant="label">{currentUser.name}</Text><TextInput multiline autoFocus value={value} onChangeText={setValue} maxLength={LIMIT + 20} placeholder="What's on your mind?" placeholderTextColor={theme.colors.textMuted} selectionColor={theme.colors.primary} style={[styles.input, { color: theme.colors.textPrimary }]} />
            <View style={styles.tools}>{tools.map((tool, index) => <Pressable key={tool.label} accessibilityLabel={tool.label} onPress={() => { if (index < 3) setAttachments((items) => [...items, mockImages[(items.length + index) % mockImages.length]!]); }} style={styles.tool}><Ionicons name={tool.icon} size={21} color={theme.colors.textSecondary} /></Pressable>)}</View>
            {attachments.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previews}>{attachments.map((uri, index) => <View key={`${uri}-${index}`}><Image source={{ uri }} contentFit="cover" accessibilityLabel={`Attachment ${index + 1}`} style={[styles.preview, { borderColor: theme.colors.border }]} /><Pressable accessibilityLabel={`Remove attachment ${index + 1}`} onPress={() => setAttachments((items) => items.filter((_, itemIndex) => itemIndex !== index))} style={[styles.remove, { backgroundColor: theme.colors.surfaceElevated }]}><Ionicons name="close" size={16} color={theme.colors.textPrimary} /></Pressable></View>)}</ScrollView> : null}
          </View>
        </View>
        <Pressable style={styles.addThread}><View style={styles.miniAvatar}><Avatar uri={currentUser.avatarUri} label="Your avatar" size={24} /></View><Text color="muted">Add to thread</Text></Pressable>
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: theme.colors.divider }]}>
        <Pressable onPress={() => setAudience((v) => v === 'Everyone' ? 'Matches only' : 'Everyone')} style={styles.audience}><Ionicons name="globe-outline" size={18} color={theme.colors.primary} /><Text variant="label" color="primary">{audience}</Text></Pressable>
        <Text variant="caption" style={{ color: countColor }}>{value.length}/{LIMIT}</Text>
      </View>
      {posted ? <View style={styles.toast}><Toast message="Posted" /></View> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 }, header: { height: 56, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  headerAction: { minWidth: 64, minHeight: spacing.touch, justifyContent: 'center' }, postButton: { minWidth: 64, minHeight: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  body: { flexGrow: 1, padding: spacing.lg }, composer: { flexDirection: 'row', minHeight: 260 }, rail: { width: 40, alignItems: 'center', marginRight: spacing.md }, inputColumn: { flex: 1, gap: spacing.sm },
  input: { minHeight: 140, fontSize: typography.size.md, lineHeight: typography.lineHeight.md, textAlignVertical: 'top', padding: 0 }, tools: { flexDirection: 'row', marginLeft: -spacing.md }, tool: { width: spacing.touch, height: spacing.touch, alignItems: 'center', justifyContent: 'center' },
  previews: { gap: spacing.sm, paddingVertical: spacing.sm }, preview: { width: 112, height: 140, borderRadius: radius.md, borderWidth: 1 }, remove: { position: 'absolute', top: spacing.xs, right: spacing.xs, width: 28, height: 28, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  addThread: { minHeight: spacing.touch, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, miniAvatar: { width: 40, alignItems: 'center', opacity: 0.55 },
  footer: { minHeight: 64, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg }, audience: { minHeight: spacing.touch, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, toast: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: 76 },
});
