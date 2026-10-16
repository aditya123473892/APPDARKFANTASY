import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { spacing } from '@/theme';
import { formatRemaining } from '../disappearing';

/** Time left before a disappearing message is deleted. */
export function ExpiryCountdown({
  expiresAt,
  color,
}: {
  expiresAt: string;
  color: string;
}): React.JSX.Element {
  const [now, setNow] = useState(() => Date.now());
  const remaining = Date.parse(expiresAt) - now;
  useEffect(() => {
    if (remaining <= 0) return;
    // Tick each second during the last minute, otherwise each 30 seconds.
    const timer = setTimeout(() => setNow(Date.now()), remaining <= 60_000 ? 1000 : 30_000);
    return () => clearTimeout(timer);
  }, [now, remaining]);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Disappears in ${formatRemaining(remaining)}`}
    >
      <Ionicons name="timer-outline" size={12} color={color} />
      <Text variant="caption" style={{ color }}>
        {formatRemaining(remaining)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs / 2 },
});
