import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, ScrollView, View, StyleSheet } from 'react-native';
import { BottomSheet, Button, Text } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

export type MediaShareChoice = { viewOnce?: boolean; viewDurationSeconds?: number };
const options = [
  { key: 'unlimited', label: 'Unlimited views', choice: {} },
  { key: 'once', label: 'View once', choice: { viewOnce: true } },
  ...[3, 10, 30, 60].map((seconds) => ({
    key: String(seconds),
    label: `${seconds} seconds`,
    choice: { viewOnce: true, viewDurationSeconds: seconds },
  })),
];

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
  const [selected, setSelected] = useState('unlimited');
  const option = options.find((item) => item.key === selected)!;
  return (
    <BottomSheet visible={visible} onClose={() => onChoose(null)}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.copy}>
        <Text variant="heading">Share {count === 1 ? 'photo' : `${count} photos`}</Text>
        {previewUri ? (
          <Image
            source={{ uri: previewUri }}
            cachePolicy="none"
            contentFit="contain"
            style={styles.preview}
          />
        ) : null}
        <Text color="muted">Choose how your photos can be viewed.</Text>
        <View style={styles.options}>
          {options
            .filter((item) => canViewOnce || item.key === 'unlimited')
            .map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: item.key === selected }}
                onPress={() => setSelected(item.key)}
                style={[
                  styles.option,
                  {
                    borderColor: item.key === selected ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <Text weight={item.key === selected ? 'semibold' : undefined}>{item.label}</Text>
              </Pressable>
            ))}
        </View>
        <Text variant="caption" color="muted">
          {selected === 'unlimited'
            ? 'Open again anytime. No photos are saved to your gallery.'
            : selected === 'once'
              ? 'One opening. Closing the photo or leaving the app uses the view.'
              : 'One opening. The countdown starts when the photo loads. Closing early also uses the view.'}
        </Text>
      </ScrollView>
      <Button
        label={`Send ${count === 1 ? 'photo' : 'photos'}`}
        onPress={() => onChoose(option.choice)}
      />
      <Button label="Cancel" variant="ghost" onPress={() => onChoose(null)} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 480 },
  copy: { gap: spacing.md },
  preview: { width: '100%', height: 160, borderRadius: radius.md },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
