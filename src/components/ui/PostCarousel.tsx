import { useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { PostMedia as Media } from '@/features/feed/types';
import { postRatio } from '@/features/feed/presentation';
import { useTheme } from '@/theme/useTheme';
import { PostMedia } from './PostMedia';
import { Text } from './Text';

/** One shared crop for every page; only the visible page may mount a video player. */
export function PostCarousel({
  items,
  active = false,
  locked,
  ratio = postRatio(items[0]),
  onDoubleTap,
  onRetry,
}: {
  items: Media[];
  active?: boolean;
  locked?: boolean;
  ratio?: number;
  onDoubleTap?: () => void;
  onRetry?: () => void;
}) {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const list = useRef<FlatList<Media>>(null);
  if (!items.length) return null;
  if (items.length === 1)
    return (
      <PostMedia
        media={items[0]!}
        active={active}
        locked={locked}
        ratio={ratio}
        onDoubleTap={onDoubleTap}
        onRetry={onRetry}
      />
    );
  const page = Math.min(index, items.length - 1);
  return (
    <View
      onLayout={({ nativeEvent }) => {
        const next = nativeEvent.layout.width;
        if (next > 0 && next !== width) {
          setWidth(next);
          requestAnimationFrame(() =>
            list.current?.scrollToOffset({ offset: page * next, animated: false }),
          );
        }
      }}
      accessibilityLabel={`Post media, ${page + 1} of ${items.length}. Swipe to see more.`}
    >
      <View style={{ aspectRatio: ratio, overflow: 'hidden' }}>
        {width > 0 ? (
          <FlatList
            ref={list}
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            data={items}
            extraData={[page, active, dragging, width]}
            keyExtractor={(item, itemIndex) => `${item.id ?? itemIndex}`}
            getItemLayout={(_, itemIndex) => ({
              length: width,
              offset: width * itemIndex,
              index: itemIndex,
            })}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            onScrollBeginDrag={() => setDragging(true)}
            onScroll={(event) =>
              setIndex(
                Math.max(
                  0,
                  Math.min(items.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)),
                ),
              )
            }
            scrollEventThrottle={32}
            onMomentumScrollEnd={() => setDragging(false)}
            onScrollEndDrag={() => setDragging(false)}
            renderItem={({ item, index: itemIndex }) => (
              <View style={{ width }}>
                <PostMedia
                  media={item}
                  ratio={ratio}
                  locked={locked}
                  active={active && !dragging && itemIndex === page}
                  onDoubleTap={onDoubleTap}
                  onRetry={onRetry}
                />
              </View>
            )}
          />
        ) : null}
        <View pointerEvents="none" style={styles.counter}>
          <Text style={{ color: 'white', fontSize: 12, fontVariant: ['tabular-nums'] }}>
            {page + 1}/{items.length}
          </Text>
        </View>
      </View>
      <View pointerEvents="none" style={styles.dots}>
        {items.map((item, itemIndex) => (
          <View
            key={item.id ?? itemIndex}
            style={[
              styles.dot,
              {
                backgroundColor: itemIndex === page ? theme.colors.primary : theme.colors.textMuted,
                opacity: itemIndex === page ? 1 : 0.4,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  counter: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderRadius: 16,
    backgroundColor: '#00000099',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dots: {
    height: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
