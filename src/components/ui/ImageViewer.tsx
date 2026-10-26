import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  useExclusiveGestures,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import type { PostMedia } from '@/features/feed/types';
import { radius, spacing } from '@/theme';
import { Pressable } from './Pressable';
import { Text } from './Text';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

/** One page: pinch and double-tap zoom, pan while zoomed, swipe down to close. */
function ZoomableImage({
  image,
  width,
  height,
  onZoomChange,
  onClose,
}: {
  image: PostMedia;
  width: number;
  height: number;
  onZoomChange: (zoomed: boolean) => void;
  onClose: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const dismiss = useSharedValue(0);

  const reportZoom = (next: boolean) => {
    setZoomed(next);
    onZoomChange(next);
  };
  // Keeps the scaled image covering the screen edge to edge while panning.
  const bound = (value: number, size: number, factor: number) => {
    'worklet';
    const limit = Math.max(0, (size * factor - size) / 2);
    return clamp(value, -limit, limit);
  };
  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    x.value = withTiming(0);
    y.value = withTiming(0);
    savedX.value = 0;
    savedY.value = 0;
    scheduleOnRN(reportZoom, false);
  };

  const pinch = usePinchGesture({
    onUpdate: (event) => {
      'worklet';
      scale.value = clamp(savedScale.value * event.scale, 0.8, MAX_SCALE);
    },
    onDeactivate: () => {
      'worklet';
      if (scale.value <= 1.02) reset();
      else {
        savedScale.value = scale.value;
        x.value = withTiming(bound(x.value, width, scale.value));
        y.value = withTiming(bound(y.value, height, scale.value));
        savedX.value = x.value;
        savedY.value = y.value;
        scheduleOnRN(reportZoom, true);
      }
    },
  });

  const pan = usePanGesture({
    // Not zoomed: only vertical drags (swipe to close); horizontal ones page the list.
    activeOffsetY: [-10, 10],
    activeOffsetX: zoomed ? [-10, 10] : [-10000, 10000],
    onUpdate: (event) => {
      'worklet';
      if (savedScale.value > 1) {
        x.value = bound(savedX.value + event.translationX, width, savedScale.value);
        y.value = bound(savedY.value + event.translationY, height, savedScale.value);
      } else dismiss.value = event.translationY;
    },
    onDeactivate: (event) => {
      'worklet';
      if (savedScale.value > 1) {
        savedX.value = x.value;
        savedY.value = y.value;
      } else if (
        Math.abs(event.translationY) > DISMISS_DISTANCE ||
        Math.abs(event.velocityY) > DISMISS_VELOCITY
      ) {
        dismiss.value = withTiming(Math.sign(event.translationY || 1) * height, { duration: 160 });
        scheduleOnRN(onClose);
      } else dismiss.value = withSpring(0);
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onDeactivate: (event) => {
      'worklet';
      if (event.canceled) return;
      if (savedScale.value > 1) {
        reset();
        return;
      }
      // Zoom toward the tapped point.
      const targetX = bound(
        (width / 2 - event.x) * (DOUBLE_TAP_SCALE - 1),
        width,
        DOUBLE_TAP_SCALE,
      );
      const targetY = bound(
        (height / 2 - event.y) * (DOUBLE_TAP_SCALE - 1),
        height,
        DOUBLE_TAP_SCALE,
      );
      scale.value = withTiming(DOUBLE_TAP_SCALE);
      savedScale.value = DOUBLE_TAP_SCALE;
      x.value = withTiming(targetX);
      y.value = withTiming(targetY);
      savedX.value = targetX;
      savedY.value = targetY;
      scheduleOnRN(reportZoom, true);
    },
  });

  const gesture = useExclusiveGestures(doubleTap, useSimultaneousGestures(pinch, pan));
  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value + dismiss.value },
      { scale: scale.value },
    ],
  }));
  const backdrop = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(0.8, Math.abs(dismiss.value) / (height * 0.6)),
  }));

  return (
    <View style={{ width, height }}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]} />
      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ width, height }, imageStyle]}>
          <Image
            source={{ uri: image.uri }}
            placeholder={image.blurhash ? { blurhash: image.blurhash } : undefined}
            contentFit="contain"
            allowDownscaling
            cachePolicy="memory-disk"
            accessibilityLabel="Photo, full screen. Pinch or double tap to zoom"
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/** Full-screen, uncropped photo viewer for a post's images. */
export function ImageViewer({
  images,
  index,
  onClose,
}: {
  images: PostMedia[];
  /** Page to open on; null closes the viewer. */
  index: number | null;
  onClose: () => void;
}): React.JSX.Element | null {
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(index ?? 0);
  const [zoomed, setZoomed] = useState(false);
  const [opened, setOpened] = useState(index);
  // Re-sync the page when the viewer is reopened on another image.
  if (opened !== index) {
    setOpened(index);
    setPage(index ?? 0);
    setZoomed(false);
  }
  if (index === null || !images.length) return null;
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={onClose}
    >
      {/* Modals render outside the app's root view, so gestures need their own root. */}
      <GestureHandlerRootView style={styles.root}>
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed && images.length > 1}
          initialScrollIndex={Math.min(index, images.length - 1)}
          getItemLayout={(_, item) => ({ length: width, offset: width * item, index: item })}
          keyExtractor={(item, itemIndex) => item.id ?? `${itemIndex}`}
          showsHorizontalScrollIndicator={false}
          windowSize={3}
          onMomentumScrollEnd={(event) =>
            setPage(Math.round(event.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item }) => (
            <ZoomableImage
              image={item}
              width={width}
              height={height}
              onZoomChange={setZoomed}
              onClose={onClose}
            />
          )}
        />
        <SafeAreaView
          pointerEvents="box-none"
          style={styles.chrome}
          edges={['top', 'left', 'right']}
        >
          {images.length > 1 ? (
            <View style={styles.counter} accessibilityLiveRegion="polite">
              <Text style={styles.counterText}>
                {page + 1}/{images.length}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            onPress={onClose}
            style={styles.close}
          >
            <Ionicons name="close" size={26} color="white" />
          </Pressable>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: 'black' },
  chrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  counter: {
    marginLeft: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: '#00000099',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  counterText: { color: 'white', fontVariant: ['tabular-nums'] },
  close: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00000066',
  },
});
