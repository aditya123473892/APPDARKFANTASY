import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { Text } from './Text';
import { mediaUrl } from '@/services/api/backend';

import { useTheme } from '@/theme/useTheme';
import { radius } from '@/theme';
import { StoryRing } from './StoryRing';

type AvatarProps = { uri: string; size?: number; online?: boolean; ring?: boolean; label: string };

export function Avatar({ uri, size = 44, online, ring, label }: AvatarProps): React.JSX.Element {
  const { theme } = useTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const inner = ring ? size - 8 : size;
  const dot = Math.max(10, Math.round(size * 0.24));
  const content = (
    <View
      style={[
        { width: inner, height: inner },
        { alignItems: 'center', justifyContent: 'center' },
      ]}
    >
      {!uri || failedUri === uri ? (
        <View
          accessibilityLabel={label}
          style={{
            width: inner,
            height: inner,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.surfaceElevated,
          }}
        >
          <Text weight="semibold" style={{ fontSize: Math.max(10, size * 0.3) }}>
            {label
              .split(/\s+/)
              .slice(0, 2)
              .map((s) => s[0])
              .join('')
              .toUpperCase()}
          </Text>
        </View>
      ) : (
        <Image
          source={{ uri: mediaUrl(uri) }}
          onError={() => setFailedUri(uri)}
          contentFit="cover"
          transition={160}
          cachePolicy="memory-disk"
          recyclingKey={uri}
          accessibilityLabel={label}
          style={[
            styles.image,
            { width: inner, height: inner, backgroundColor: theme.colors.surfaceElevated },
          ]}
        />
      )}
      {online ? (
        <View
          accessibilityLabel="Online"
          style={[
            styles.online,
            {
              width: dot,
              height: dot,
              backgroundColor: theme.colors.online,
              borderColor: theme.colors.background,
            },
          ]}
        />
      ) : null}
    </View>
  );
  return ring ? (
    <StoryRing size={size}>
      <View style={{ width: inner, height: inner }}>{content}</View>
    </StoryRing>
  ) : (
    content
  );
}

const styles = StyleSheet.create({
  image: { borderRadius: radius.full },
  online: { position: 'absolute', right: 0, bottom: 0, borderRadius: radius.full, borderWidth: 2 },
});
