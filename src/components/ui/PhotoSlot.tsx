import { useState } from 'react';
import { FitImage } from './FitImage';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { mediaUrl } from '@/services/api/backend';
import { media, radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { Text } from './Text';

export function PhotoSlot({
  uri,
  label,
  main = false,
  onAdd,
  onRemove,
  disabled,
  style,
}: {
  uri?: string;
  label: string;
  main?: boolean;
  onAdd?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <View
      style={[
        styles.slot,
        { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
        !uri && styles.empty,
        uri ? { aspectRatio: undefined } : null,
        style,
      ]}
    >
      {uri ? (
        <>
          <FitImage uri={mediaUrl(uri)} onError={() => setFailed(uri)} accessibilityLabel={label} />
          {failed === uri ? (
            <Ionicons
              name="image-outline"
              size={24}
              color={theme.colors.textMuted}
              accessibilityLabel="Photo unavailable"
            />
          ) : null}
          {main ? (
            <View style={[styles.main, { backgroundColor: theme.colors.overlayStrong }]}>
              <Text variant="caption" style={{ color: theme.colors.onImage }}>
                Main
              </Text>
            </View>
          ) : null}
          {onRemove ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${label}`}
              disabled={disabled}
              onPress={onRemove}
              style={({ pressed }) => [styles.remove, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[styles.close, { backgroundColor: theme.colors.overlayStrong }]}>
                <Ionicons name="close" size={20} color={theme.colors.onImage} />
              </View>
            </Pressable>
          ) : null}
        </>
      ) : (
        <Pressable
          accessibilityRole={onAdd ? 'button' : undefined}
          accessibilityLabel={onAdd ? `Add ${label}` : `Empty ${label}`}
          disabled={disabled || !onAdd}
          onPress={onAdd}
          style={({ pressed }) => [styles.add, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="add" size={24} color={theme.colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  slot: {
    aspectRatio: media.profileRatio,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { borderWidth: spacing.hairline, borderStyle: 'dashed' },
  add: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: spacing.touch,
    height: spacing.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: { borderRadius: radius.full, padding: spacing.xs },
  main: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
});
