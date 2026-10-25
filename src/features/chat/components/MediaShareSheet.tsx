import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Button, Text } from '@/components/ui';
import { SocialSheet } from '@/components/ui/SocialSheet';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

export type MediaShareChoice = { viewOnce?: boolean; viewDurationSeconds?: number };

export function MediaShareSheet({
  visible,
  count,
  previewUri,
  canViewOnce,
  onChoose,
}: {
  visible: boolean;
  count: number;
  previewUri?: string;
  canViewOnce: boolean;
  onChoose: (choice: MediaShareChoice | null) => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  const [once, setOnce] = useState(false);
  const [seconds, setSeconds] = useState<number>();
  const restricted = once && canViewOnce && count === 1;
  const modes: {
    value: boolean;
    title: string;
    detail: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { value: false, title: 'Keep in chat', detail: 'Open again anytime', icon: 'image-outline' },
    ...(canViewOnce && count === 1
      ? [
          {
            value: true,
            title: 'View once',
            detail: 'One opening, then it disappears',
            icon: 'eye-off-outline' as const,
          },
        ]
      : []),
  ];
  return (
    <SocialSheet visible={visible} onClose={() => onChoose(null)} title="Send photo">
      <ScrollView contentContainerStyle={styles.content}>
        {previewUri ? (
          <Image
            source={{ uri: previewUri }}
            contentFit="contain"
            cachePolicy="none"
            style={{
              width: '100%',
              height: 200,
              borderRadius: radius.lg,
              backgroundColor: theme.colors.mediaBackground,
            }}
            accessibilityLabel="Selected photo preview"
          />
        ) : null}
        <Text weight="semibold" style={{ fontSize: 14 }}>
          How can this photo be viewed?
        </Text>
        {modes.map((mode) => (
          <Pressable
            key={String(mode.value)}
            accessibilityRole="radio"
            accessibilityLabel={mode.title}
            accessibilityState={{ checked: restricted === mode.value }}
            onPress={() => setOnce(mode.value)}
            style={[
              styles.option,
              {
                backgroundColor:
                  restricted === mode.value ? theme.colors.primarySoft : theme.colors.surfaceMuted,
              },
            ]}
          >
            <Ionicons name={mode.icon} size={22} color={theme.colors.primaryText} />
            <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
              <Text weight="semibold" style={{ fontSize: 14 }}>
                {mode.title}
              </Text>
              <Text variant="caption" weight="regular" color="muted">
                {mode.detail}
              </Text>
            </View>
            <Ionicons
              name={restricted === mode.value ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={restricted === mode.value ? theme.colors.primaryText : theme.colors.textMuted}
            />
          </Pressable>
        ))}
        {restricted ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="caption" weight="regular" color="muted">
              Close automatically after opening
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm }}
            >
              {[undefined, 3, 10, 30, 60].map((value) => (
                <Pressable
                  key={String(value)}
                  accessibilityRole="radio"
                  accessibilityLabel={value ? `${value} seconds` : 'No timer'}
                  accessibilityState={{ checked: seconds === value }}
                  onPress={() => setSeconds(value)}
                  style={[
                    styles.timer,
                    {
                      backgroundColor:
                        seconds === value ? theme.colors.primarySoft : theme.colors.surfaceMuted,
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    weight="semibold"
                    color={seconds === value ? 'primary' : 'muted'}
                  >
                    {value ? `${value}s` : 'No timer'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
        <Text variant="caption" weight="regular" color="muted">
          {restricted
            ? 'Closing the photo or leaving the app uses the view. A timer starts only when the photo loads.'
            : 'The photo stays in this conversation until it expires or is removed.'}
        </Text>
      </ScrollView>
      <View style={{ padding: spacing.lg }}>
        <Button
          label={`Send ${count === 1 ? 'photo' : `${count} photos`}${restricted ? ' · View once' : ''}`}
          onPress={() =>
            onChoose(
              restricted
                ? { viewOnce: true, ...(seconds ? { viewDurationSeconds: seconds } : {}) }
                : {},
            )
          }
        />
      </View>
    </SocialSheet>
  );
}
const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  timer: {
    minWidth: 56,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
});
