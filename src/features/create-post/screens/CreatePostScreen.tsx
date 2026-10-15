import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingScreen, useSafeBack } from '@/components/layout';
import { Avatar, Button, Text } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useCreatePost } from '@/features/feed/hooks/useFeed';
import type { PostAudience, UploadAsset } from '@/features/feed/types';
import { pickMedia } from '../pickMedia';
import { useKeyboard } from '@/hooks/useKeyboard';
import { describeError } from '@/services/errors';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/useTheme';

const LIMIT = 500;
const audiences: { value: PostAudience; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'everyone', label: 'Everyone', icon: 'globe-outline' },
  { value: 'private', label: 'Private', icon: 'lock-closed-outline' },
];

export function CreatePostScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const close = useSafeBack('/home');
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboard();
  const me = useAuthStore((state) => state.user);
  const [value, setValue] = useState('');
  const [audience, setAudience] = useState<PostAudience>('everyone');
  const [assets, setAssets] = useState<UploadAsset[]>([]);
  const createPost = useCreatePost();
  const submitted = useRef(false);

  const trimmed = value.trim();
  const over = value.length > LIMIT;
  const canPost = assets.length > 0 && !over && !createPost.isPending;
  const dirty = trimmed.length > 0 || assets.length > 0;

  // Confirm before discarding a draft — covers the Cancel button, Android back, and swipe-to-dismiss.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (!dirty || submitted.current) return;
        event.preventDefault();
        Alert.alert('Discard this post?', "Your draft won't be saved.", [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(event.data.action),
          },
        ]);
      }),
    [dirty, navigation],
  );

  const submit = (): void => {
    if (!canPost) return;
    createPost.mutate(
      { body: trimmed, audience, assets },
      {
        onSuccess: (post) => {
          submitted.current = true;
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          toast.success(
            post.status === 'approved'
              ? 'Post published'
              : 'Post submitted for approval. Find it on your profile.',
          );
          close();
        },
        onError: (error) =>
          toast.error(
            describeError(error, "Couldn't publish your post. Your draft is still here."),
          ),
      },
    );
  };

  const countColor = over ? 'danger' : value.length > LIMIT * 0.85 ? 'primary' : 'muted';

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingScreen>
        <View style={[styles.header, { borderBottomColor: theme.colors.divider }]}>
          <Button label="Cancel" variant="ghost" size="sm" fullWidth={false} onPress={close} />
          <Text variant="subheading" accessibilityRole="header">
            New post
          </Text>
          <Button
            label="Post"
            size="sm"
            fullWidth={false}
            disabled={!canPost}
            loading={createPost.isPending}
            onPress={submit}
            style={styles.postButton}
          />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          <View style={styles.composer}>
            {me ? <Avatar uri={me.avatarUri} label="Your photo" size={44} /> : null}
            <View style={styles.inputColumn}>
              <Text variant="label">{me?.name}</Text>
              <TextInput
                accessibilityLabel="Post text"
                multiline
                autoFocus
                value={value}
                onChangeText={setValue}
                editable={!createPost.isPending}
                maxLength={LIMIT + 50}
                placeholder="What's on your mind?"
                placeholderTextColor={theme.colors.textMuted}
                selectionColor={theme.colors.primary}
                cursorColor={theme.colors.primary}
                maxFontSizeMultiplier={typography.maxFontScale}
                style={[styles.input, { color: theme.colors.text }]}
              />
            </View>
          </View>
          {over ? (
            <Text variant="caption" color="danger" style={styles.error}>
              Posts can be up to {LIMIT} characters. Remove {value.length - LIMIT} to continue.
            </Text>
          ) : null}
          <View style={{ gap: 12, marginTop: 20 }}>
            <Button
              label={assets.length ? 'Change media' : 'Add photos or videos'}
              icon="images-outline"
              variant="secondary"
              disabled={createPost.isPending}
              onPress={() => {
                void pickMedia()
                  .then((selected) => {
                    if (selected.length) setAssets(selected);
                  })
                  .catch(() => toast.error('Unable to open your photo library.'));
              }}
            />
            <Text variant="caption" color="secondary">
              Choose at least one photo or video. Posts may require approval before appearing in the
              public feed.
            </Text>
            {assets.map((asset, index) => (
              <View
                key={`${asset.uri}-${index}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Text numberOfLines={1} style={{ flex: 1 }}>
                  {asset.name}
                </Text>
                <Button
                  label="Remove"
                  size="sm"
                  variant="ghost"
                  fullWidth={false}
                  disabled={createPost.isPending}
                  onPress={() => setAssets((items) => items.filter((_, i) => i !== index))}
                />
              </View>
            ))}
          </View>
        </ScrollView>
        <View
          style={[
            styles.footer,
            {
              borderTopColor: theme.colors.divider,
              paddingBottom: (keyboardVisible ? 0 : insets.bottom) + spacing.sm,
            },
          ]}
        >
          <View
            style={styles.audiences}
            accessibilityRole="radiogroup"
            accessibilityLabel="Who can see this post"
          >
            {audiences.map((item) => {
              const selected = item.value === audience;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setAudience(item.value)}
                  style={[
                    styles.audience,
                    {
                      backgroundColor: selected
                        ? theme.colors.primarySoft
                        : theme.colors.surfaceElevated,
                      borderColor: selected ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={15}
                    color={selected ? theme.colors.primary : theme.colors.textSecondary}
                  />
                  <Text
                    variant="caption"
                    weight="semibold"
                    color={selected ? 'primary' : 'secondary'}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text
            variant="caption"
            color={countColor}
            accessibilityLabel={`${value.length} of ${LIMIT} characters`}
          >
            {value.length}/{LIMIT}
          </Text>
        </View>
      </KeyboardAvoidingScreen>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  postButton: { minWidth: 76 },
  body: {
    flexGrow: 1,
    padding: spacing.screen,
    width: '100%',
    maxWidth: spacing.contentMax,
    alignSelf: 'center',
  },
  composer: { flexDirection: 'row', gap: spacing.md },
  inputColumn: { flex: 1, gap: spacing.xs },
  input: {
    minHeight: 160,
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg + 2,
    textAlignVertical: 'top',
    padding: 0,
  },
  error: { marginTop: spacing.sm },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  audiences: { flexDirection: 'row', gap: spacing.sm, flexShrink: 1 },
  audience: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
  },
});
