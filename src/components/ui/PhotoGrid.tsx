import { StyleSheet, View } from 'react-native';
import { spacing } from '@/theme';
import { PhotoSlot } from './PhotoSlot';

export function PhotoGrid({
  photos,
  name = 'Your',
  onAdd,
  onRemove,
  disabled,
  maxPhotos = 6,
}: {
  photos: string[];
  name?: string;
  onAdd?: (index: number) => void;
  onRemove?: (index: number) => void;
  disabled?: boolean;
  maxPhotos?: number;
}) {
  return (
    <View style={styles.grid}>
      {[0, 1].map((row) => (
        <View key={row} style={styles.row}>
          {[0, 1, 2].map((col) => {
            const index = row * 3 + col;
            return (
              <PhotoSlot
                key={index}
                uri={photos[index]}
                label={`${name} photo ${index + 1}`}
                main={index === 0}
                disabled={disabled || index >= maxPhotos}
                onAdd={onAdd && index < maxPhotos ? () => onAdd(index) : undefined}
                onRemove={onRemove && photos[index] ? () => onRemove(index) : undefined}
                style={styles.slot}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  grid: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  slot: { flex: 1 },
});
