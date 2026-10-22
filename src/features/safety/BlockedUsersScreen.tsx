import { useInfiniteQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Button, Text, Loader } from '@/components/ui';
import { ErrorState } from '@/components/feedback/ErrorState';
import { listBlocks } from './blocks';
import { useBlock } from './useBlock';
import { useBlockState } from './blockState';
export function BlockedUsersScreen() {
  const query = useInfiniteQuery({
    queryKey: ['blocked-users'],
    queryFn: ({ pageParam }) => listBlocks(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const block = useBlock();
  const pending = useBlockState((state) => state.pending);
  const blocked = useBlockState((state) => state.ids);
  return (
    <Screen scroll>
      <Header title="Blocked users" back />
      {query.isPending ? (
        <Loader />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <>
          {!query.data?.pages.some((page) => page.blocks.length) && <Text>No blocked users.</Text>}
          {query.data?.pages
            .flatMap((page) => page.blocks)
            .filter((user) => !pending.includes(user.id) || blocked.includes(user.id))
            .map((user) => (
              <View key={user.id} style={{ paddingVertical: 12, gap: 8 }}>
                <Text>{user.name}</Text>
                <Button
                  label="Unblock"
                  loading={pending.includes(user.id)}
                  disabled={pending.includes(user.id)}
                  onPress={() => block.mutate({ id: user.id, blocked: false })}
                />
              </View>
            ))}
          {query.hasNextPage && (
            <Button
              label="Load more"
              loading={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
          )}
        </>
      )}
    </Screen>
  );
}
