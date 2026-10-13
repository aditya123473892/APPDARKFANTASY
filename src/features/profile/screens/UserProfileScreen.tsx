import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useSafeBack } from '@/components/layout';
import { Button, EmptyState, Skeleton, Text } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useRequestActions, useSendRequest } from '@/features/requests/hooks/useRequests';
import type { ConnectionRequest } from '@/features/requests/types';
import { usePreferences } from '@/features/settings/store/preferencesStore';
import { featureFlags } from '@/config/featureFlags';
import { isServiceError } from '@/services/errors';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { formatDistance, formatPresence } from '@/utils/formatters';
import { InterestChips } from '../components/InterestChips';
import { PhotoGrid } from '../components/PhotoGrid';
import { ProfileHeader } from '../components/ProfileHeader';
import { useProfile } from '../hooks/useProfiles';
import type { ProfileView } from '../types';

function asRequest(
  profile: ProfileView,
  requestId: string,
  direction: ConnectionRequest['direction'],
): ConnectionRequest {
  return {
    id: requestId,
    user: profile,
    direction,
    createdAt: new Date().toISOString(),
    superLike: false,
  };
}

/** Bottom action bar — the single place a relationship is acted on from a profile. */
function RelationshipActions({ profile }: { profile: ProfileView }): React.JSX.Element {
  const router = useRouter();
  const send = useSendRequest();
  const { accept, decline, cancel, pendingId } = useRequestActions();
  const { relationship } = profile;
  const sending = send.isPending;

  switch (relationship.status) {
    case 'connected':
      return (
        <Button
          label={`Message ${profile.name}`}
          icon="chatbubble-ellipses"
          onPress={() => router.push(`/chat/${relationship.conversationId}`)}
        />
      );
    case 'incoming': {
      const request = asRequest(profile, relationship.requestId, 'incoming');
      const busy = pendingId === relationship.requestId;
      return (
        <View style={styles.actionRow}>
          <Button
            label="Decline"
            variant="secondary"
            disabled={busy}
            onPress={() => decline.mutate(request)}
            style={styles.flex}
          />
          <Button
            label="Accept"
            icon="heart"
            loading={busy && accept.isPending}
            disabled={busy}
            onPress={() => accept.mutate(request)}
            style={styles.flex}
          />
        </View>
      );
    }
    case 'outgoing': {
      const request = asRequest(profile, relationship.requestId, 'outgoing');
      return (
        <Button
          label="Request sent · Cancel"
          icon="time-outline"
          variant="secondary"
          loading={pendingId === relationship.requestId}
          onPress={() =>
            Alert.alert(`Cancel your request to ${profile.name}?`, 'They will no longer see it.', [
              { text: 'Keep request', style: 'cancel' },
              {
                text: 'Cancel request',
                style: 'destructive',
                onPress: () => cancel.mutate(request),
              },
            ])
          }
        />
      );
    }
    default:
      return (
        <View style={styles.actionRow}>
          {featureFlags.ENABLE_SUPER_LIKE ? (
            <Button
              label="Super like"
              icon="star"
              variant="secondary"
              fullWidth={false}
              disabled={sending}
              onPress={() =>
                send.mutate({ userId: profile.id, name: profile.name, superLike: true })
              }
              accessibilityLabel={`Super like ${profile.name}`}
            />
          ) : null}
          <Button
            label="Send request"
            icon="heart"
            loading={sending}
            onPress={() => send.mutate({ userId: profile.id, name: profile.name })}
            style={styles.flex}
            accessibilityLabel={`Send a connection request to ${profile.name}`}
          />
        </View>
      );
  }
}

export function UserProfileScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const goBack = useSafeBack('/discover');
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const myId = useAuthStore((state) => state.user?.id);
  const myInterests = useAuthStore((state) => state.user?.interests) ?? [];
  const showDistance = usePreferences((state) => state.showDistance);
  const showPresence = usePreferences((state) => state.showActiveStatus);
  const { data: profile, isPending, isError, error, refetch } = useProfile(id === myId ? '' : id);

  if (id && id === myId) return <Redirect href="/profile" />;

  const backButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={goBack}
      style={[
        styles.floatingBack,
        { top: insets.top + spacing.sm, backgroundColor: theme.colors.overlay },
      ]}
    >
      <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
    </Pressable>
  );

  if (!id || isServiceError(error, 'NOT_FOUND')) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          icon="person-outline"
          title="Profile unavailable"
          message="This person may have paused or deleted their account."
          actionLabel="Back to Discover"
          onAction={() => router.replace('/discover')}
        />
      </SafeAreaView>
    );
  }
  if (isPending) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <Skeleton style={{ height: Math.min(width * 1.1, height * 0.6), borderRadius: 0 }} />
        <View style={styles.content}>
          <Skeleton style={styles.skeletonTitle} />
          <Skeleton style={styles.skeletonLine} />
          <Skeleton />
        </View>
        {backButton}
      </View>
    );
  }
  if (isError || !profile) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <ErrorState onRetry={() => void refetch()} message="We couldn't load this profile." />
        {backButton}
      </SafeAreaView>
    );
  }

  const heroHeight = Math.min(width * 1.15, height * 0.62);
  const photos = (profile.photos ?? [profile.avatarUri]).slice(1);
  const shared = profile.interests.filter((interest) => myInterests.includes(interest));

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={{ height: heroHeight }}>
          <Image
            source={{ uri: profile.avatarUri }}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            accessibilityLabel={`${profile.name}'s main photo`}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[theme.colors.overlayTransparent, theme.colors.background]}
            locations={[0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View style={styles.content}>
          <ProfileHeader
            user={profile}
            presence={showPresence ? formatPresence(profile.presence) : null}
            distance={showDistance ? formatDistance(profile.distanceKm) : null}
          />
          <View style={styles.section}>
            <Text variant="label" color="muted">
              ABOUT
            </Text>
            <Text>{profile.bio}</Text>
          </View>
          {profile.interests.length ? (
            <View style={styles.section}>
              <Text variant="label" color="muted">
                INTERESTS{shared.length ? ` · ${shared.length} IN COMMON` : ''}
              </Text>
              <InterestChips interests={profile.interests} highlight={shared} />
            </View>
          ) : null}
          {photos.length ? (
            <View style={styles.section}>
              <Text variant="label" color="muted">
                PHOTOS
              </Text>
              <PhotoGrid photos={photos} name={profile.name} />
            </View>
          ) : null}
        </View>
      </ScrollView>
      <View
        style={[
          styles.bar,
          {
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: theme.colors.background,
            borderTopColor: theme.colors.border,
          },
        ]}
      >
        <View style={styles.barInner}>
          <RelationshipActions profile={profile} />
        </View>
      </View>
      {backButton}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: spacing.xxl },
  content: {
    width: '100%',
    maxWidth: spacing.contentMax,
    alignSelf: 'center',
    paddingHorizontal: spacing.screen,
    gap: spacing.xl,
    marginTop: -spacing.xxxl,
  },
  section: { gap: spacing.sm },
  floatingBack: {
    position: 'absolute',
    left: spacing.md,
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.screen,
  },
  barInner: { width: '100%', maxWidth: spacing.contentMax, alignSelf: 'center' },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  skeletonTitle: { width: '50%', height: 28 },
  skeletonLine: { width: '70%' },
});
