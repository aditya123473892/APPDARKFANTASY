import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { spacing } from '@/theme';
import { useLikers } from '@/features/feed/hooks/useFeed';
import { useCurrentUserId } from '@/features/auth/hooks/useCurrentUser';
import { FollowButton } from '@/features/requests/components/FollowButton';
import { Avatar } from './Avatar';
import { Loader } from './Loader';
import { Pressable } from './Pressable';
import { SocialSheet } from './SocialSheet';
import { Text } from './Text';

/** The people who liked a post, newest first, with the viewer's own follow state. */
export function LikesSheet({
  postId,
  visible,
  onClose,
}: {
  postId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const me = useCurrentUserId();
  const likers = useLikers(postId, visible);
  const users = likers.data?.pages.flatMap((page) => page.users) ?? [];
  return (
    <SocialSheet visible={visible} onClose={onClose} title="Likes">
      {likers.isPending ? (
        <Loader />
      ) : likers.isError && !users.length ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void likers.refetch()}
          style={{ padding: spacing.lg, alignItems: 'center' }}
        >
          <Text color="primary">Couldn't load likes. Tap to retry.</Text>
        </Pressable>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          onEndReached={() => {
            if (likers.hasNextPage && !likers.isFetchingNextPage) void likers.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <Text color="muted" center style={{ padding: spacing.lg }}>
              No likes yet.
            </Text>
          }
          ListFooterComponent={likers.isFetchingNextPage ? <Loader /> : undefined}
          renderItem={({ item }) => (
            <View
              style={{
                minHeight: 64,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.lg,
                gap: spacing.md,
              }}
            >
              <Pressable
                accessibilityLabel={`Open ${item.name}'s profile`}
                onPress={() => {
                  onClose();
                  router.push(item.id === me ? '/profile' : `/profile/${item.id}`);
                }}
                style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
              >
                <Avatar uri={item.avatarUri} label={item.name} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text weight="semibold" numberOfLines={1} style={{ fontSize: 14 }}>
                    {item.handle || item.name}
                  </Text>
                  {item.handle && item.handle !== item.name ? (
                    <Text variant="caption" weight="regular" color="muted" numberOfLines={1}>
                      {item.name}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              {item.id !== me ? <FollowButton userId={item.id} /> : null}
            </View>
          )}
        />
      )}
    </SocialSheet>
  );
}
