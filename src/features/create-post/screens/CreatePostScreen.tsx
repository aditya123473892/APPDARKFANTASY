import * as Haptics from 'expo-haptics';
import { usePreventRemove } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Header, Screen, KeyboardAvoidingScreen, useSafeBack } from '@/components/layout';
import { Button, Text } from '@/components/ui';
import { PostCarousel } from '@/components/ui/PostCarousel';
import { Pressable } from '@/components/ui/Pressable';
import { toast } from '@/components/ui/Toast';
import { useCreatePost } from '@/features/feed/hooks/useFeed';
import type { ContentVisibility, PostAudience } from '@/features/feed/types';
import { mediaPreviews } from '@/features/feed/presentation';
import { usePhotoDraftCleanup } from '@/hooks/usePhotoDraftCleanup';
import { createClientId } from '@/utils/clientId';
import { describeError } from '@/services/errors';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { pickPostMedia, POST_MAX_PHOTOS, type SelectedMedia } from '../singleMedia';
import { RecentMediaGrid } from '../RecentMediaGrid';
import { uploadPostMedia } from '../uploadSingleMedia';

export function CreatePostScreen() {
  const close = useSafeBack('/home');
  const { theme } = useTheme();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<SelectedMedia[]>([]);
  const [ratio, setRatio] = useState(0.8);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [audience, setAudience] = useState<PostAudience>('everyone');
  const [visibility, setVisibility] = useState<ContentVisibility>('normal');
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const clientId = useRef(createClientId());
  const create = useCreatePost();
  usePhotoDraftCleanup(selected.map((item) => item.asset));
  const disablePrevention = usePreventRemove(
    Boolean(selected.length || caption.trim()) && !submitted,
    ({ repeat }) =>
      Alert.alert('Discard this post?', "Your draft won't be saved.", [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setSubmitted(true);
            repeat();
          },
        },
      ]),
  );
  const choose = async (camera = false) => {
    setPicking(true);
    setError('');
    try {
      const result = await pickPostMedia(camera);
      if (result) {
        setSelected(result);
        result.forEach(registerPreview);
        clientId.current = createClientId();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open media.');
    } finally {
      setPicking(false);
    }
  };
  const registerPreview = (media: SelectedMedia) => {
    mediaPreviews.set(media.asset.uri, {
      thumbnail: media.thumbnail,
      duration: media.duration,
      ratio,
    });
  };
  const select = (media: SelectedMedia) => {
    const existing = selected.findIndex((item) => item.asset.uri === media.asset.uri);
    if (existing >= 0) {
      setSelected(selected.filter((_, index) => index !== existing));
    } else if (media.asset.type.startsWith('video/')) {
      setSelected([media]);
    } else {
      const photos = selected.filter((item) => !item.asset.type.startsWith('video/'));
      if (photos.length >= POST_MAX_PHOTOS) {
        setError(`Choose up to ${POST_MAX_PHOTOS} photos. Remove one to select another.`);
        return;
      }
      setSelected([...photos, media]);
    }
    registerPreview(media);
    setError('');
    clientId.current = createClientId();
  };
  const publish = async () => {
    if (!selected.length || publishing || caption.length > 500) return;
    setPublishing(true);
    setProgress(0);
    setError('');
    try {
      const post = await uploadPostMedia(
        {
          body: caption.trim(),
          assets: selected.map((item) => item.asset),
          audience,
          contentVisibility: visibility,
          clientId: clientId.current,
        },
        create.mutateAsync,
        setProgress,
      );
      post.media?.forEach((item, index) => {
        if (item.uri)
          mediaPreviews.set(item.uri, {
            thumbnail: selected[index]?.thumbnail,
            duration: selected[index]?.duration,
            ratio,
            location: location.trim(),
          });
      });
      setSubmitted(true);
      disablePrevention();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      toast.success(post.status === 'approved' ? 'Post published' : 'Post submitted for approval');
      close();
    } catch (cause) {
      setError(describeError(cause, "Couldn't publish. Your draft is still here."));
    } finally {
      setPublishing(false);
    }
  };
  const field = {
    backgroundColor: theme.colors.surfaceMuted,
    color: theme.colors.text,
    fontFamily: typography.family.regular,
    fontSize: 14,
    borderRadius: radius.input,
    padding: spacing.md,
  };
  return (
    <Screen padded={false} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingScreen>
        <View style={{ paddingHorizontal: spacing.md }}>
          <Header
            title={step === 1 ? 'New post' : 'Add details'}
            back
            onBack={() => (step === 2 && !publishing ? setStep(1) : close())}
            action={
              step === 1 ? (
                <Button
                  label="Next"
                  size="sm"
                  fullWidth={false}
                  disabled={!selected.length || picking}
                  onPress={() => setStep(2)}
                />
              ) : undefined
            }
          />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        >
          {selected.length ? (
            <PostCarousel
              key={selected.map((item) => item.asset.uri).join('|')}
              items={selected.map((item) => ({
                uri: item.asset.uri,
                width: item.width,
                height: item.height,
                mimetype: item.asset.type,
              }))}
              ratio={step === 1 ? 1 : ratio}
            />
          ) : (
            <View
              style={{
                aspectRatio: 1,
                backgroundColor: theme.colors.surfaceMuted,
                alignItems: 'center',
                justifyContent: 'center',
                padding: spacing.xl,
                gap: spacing.sm,
              }}
            >
              <Text weight="semibold">Share your moments.</Text>
              <Text color="muted" center>
                Choose up to {POST_MAX_PHOTOS} photos or one video up to 60 seconds.
              </Text>
            </View>
          )}
          {selected.length > 0 ? (
            <View
              style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm }}
            >
              <Text variant="caption" color="muted">
                {selected.length === 1 && selected[0]?.asset.type.startsWith('video/')
                  ? '1 video'
                  : `${selected.length}/${POST_MAX_PHOTOS} photos`}{' '}
                · Swipe preview to see all
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm }}
              >
                {selected.map((item, index) => (
                  <View key={item.asset.uri} style={{ width: 80 }}>
                    <View
                      style={{
                        height: 80,
                        borderRadius: radius.sm,
                        overflow: 'hidden',
                        backgroundColor: theme.colors.surfaceMuted,
                      }}
                    >
                      {item.thumbnail || !item.asset.type.startsWith('video/') ? (
                        <Image
                          source={{ uri: item.thumbnail ?? item.asset.uri }}
                          contentFit="cover"
                          style={{ width: 80, height: 80 }}
                        />
                      ) : (
                        <Ionicons
                          name="play"
                          color={theme.colors.text}
                          size={28}
                          style={{ margin: 24 }}
                        />
                      )}
                      <View
                        style={{
                          position: 'absolute',
                          left: 4,
                          bottom: 4,
                          backgroundColor: theme.colors.primary,
                          borderRadius: 12,
                          paddingHorizontal: 7,
                        }}
                      >
                        <Text style={{ color: 'white', fontSize: 12 }}>{index + 1}</Text>
                      </View>
                      <Pressable
                        accessibilityLabel={`Remove media ${index + 1}`}
                        disabled={publishing}
                        onPress={() => {
                          setSelected(selected.filter((_, current) => current !== index));
                          clientId.current = createClientId();
                          setError('');
                        }}
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          width: 44,
                          height: 44,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#00000080',
                        }}
                      >
                        <Ionicons name="close" color="white" size={20} />
                      </Pressable>
                    </View>
                    {selected.length > 1 ? (
                      <Pressable
                        accessibilityLabel={`Move photo ${index + 1} earlier`}
                        disabled={index === 0 || publishing}
                        onPress={() => {
                          const next = [...selected];
                          [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                          setSelected(next);
                          clientId.current = createClientId();
                        }}
                        style={{
                          height: 44,
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: index === 0 ? 0.3 : 1,
                        }}
                      >
                        <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
          {step === 1 ? (
            <>
              <View style={{ padding: spacing.lg, flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  label={picking ? 'Opening…' : 'Choose media'}
                  icon="image-outline"
                  variant="secondary"
                  style={{ flex: 1 }}
                  disabled={picking}
                  onPress={() => void choose()}
                />
                <Button
                  label="Camera"
                  icon="camera-outline"
                  variant="secondary"
                  style={{ flex: 1 }}
                  disabled={picking}
                  onPress={() => void choose(true)}
                />
              </View>
              <Text
                variant="caption"
                weight="regular"
                color="muted"
                style={{ paddingHorizontal: spacing.lg }}
              >
                Up to {POST_MAX_PHOTOS} photos · or one video up to 60s / 50 MB
              </Text>
              {error ? (
                <Text
                  accessibilityLiveRegion="polite"
                  color="danger"
                  style={{ padding: spacing.lg }}
                >
                  {error}
                </Text>
              ) : null}
              <RecentMediaGrid
                selected={selected.map((item) => item.selectionUri ?? item.asset.uri)}
                onSelect={select}
                onError={setError}
                disabled={picking}
              />
            </>
          ) : (
            <View style={{ padding: spacing.lg, gap: spacing.lg }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                <Text weight="semibold" style={{ flex: 1 }}>
                  Aspect ratio
                </Text>
                {[1, 0.8].map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={value === 1 ? 'Square 1:1' : 'Portrait 4:5'}
                    accessibilityState={{ checked: ratio === value }}
                    disabled={publishing}
                    onPress={() => {
                      setRatio(value);
                      selected.forEach((item) =>
                        mediaPreviews.set(item.asset.uri, {
                          thumbnail: item.thumbnail,
                          duration: item.duration,
                          ratio: value,
                        }),
                      );
                    }}
                    style={{
                      borderRadius: radius.sm,
                      paddingHorizontal: spacing.lg,
                      justifyContent: 'center',
                      backgroundColor:
                        ratio === value ? theme.colors.primarySoft : theme.colors.surfaceMuted,
                    }}
                  >
                    <Text color={ratio === value ? 'primary' : 'muted'}>
                      {value === 1 ? '1:1' : '4:5'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                accessibilityLabel="Caption"
                multiline
                maxLength={550}
                value={caption}
                onChangeText={setCaption}
                editable={!publishing}
                placeholder="Write a caption…"
                placeholderTextColor={theme.colors.textMuted}
                style={[field, { minHeight: 120, textAlignVertical: 'top' }]}
              />
              <Text
                variant="caption"
                weight="regular"
                color={caption.length > 500 ? 'danger' : 'muted'}
              >
                {caption.length}/500
              </Text>
              <TextInput
                accessibilityLabel="Optional location"
                value={location}
                onChangeText={setLocation}
                editable={!publishing}
                placeholder="Add location (optional)"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={100}
                style={field}
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {(['everyone', 'private'] as const).map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={`Audience: ${value}`}
                    accessibilityState={{ checked: audience === value }}
                    disabled={publishing}
                    onPress={() => setAudience(value)}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radius.sm,
                      backgroundColor:
                        audience === value ? theme.colors.primarySoft : theme.colors.surfaceMuted,
                    }}
                  >
                    <Text color={audience === value ? 'primary' : 'muted'}>
                      {value === 'everyone' ? 'Everyone' : 'Private'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {(['normal', 'premium'] as const).map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={`Media access: ${value}`}
                    accessibilityState={{ checked: visibility === value }}
                    disabled={publishing}
                    onPress={() => setVisibility(value)}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radius.sm,
                      backgroundColor:
                        visibility === value ? theme.colors.primarySoft : theme.colors.surfaceMuted,
                    }}
                  >
                    <Text color={visibility === value ? 'primary' : 'muted'}>
                      {value === 'normal' ? 'Normal' : 'Premium'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {error ? (
                <Text accessibilityLiveRegion="polite" color="danger">
                  {error}
                </Text>
              ) : null}
              {publishing ? (
                <View
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: 100, now: progress }}
                >
                  <View style={{ height: 3, backgroundColor: theme.colors.surfaceMuted }}>
                    <View
                      style={{
                        height: 3,
                        width: `${progress}%`,
                        backgroundColor: theme.colors.primary,
                      }}
                    />
                  </View>
                  <Text variant="caption" color="muted">
                    {progress ? `Uploading ${Math.round(progress)}%` : 'Preparing upload…'}
                  </Text>
                </View>
              ) : null}
              <Button
                label={publishing ? 'Posting…' : 'Post'}
                disabled={!selected.length || caption.length > 500 || publishing}
                loading={publishing}
                onPress={() => void publish()}
              />
              <Button
                label="Change media"
                variant="ghost"
                disabled={publishing}
                onPress={() => setStep(1)}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingScreen>
    </Screen>
  );
}
