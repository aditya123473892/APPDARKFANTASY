import { Image, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/theme';

export function BrandLogo({ size = 64, wordmark = false }: { size?: number; wordmark?: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm }}>
      <Image
        source={require('../../assets/branding/icon.png')}
        accessibilityLabel="DARKFANTASY logo"
        style={{ width: size, height: size, borderRadius: size / 4 }}
      />
      {wordmark ? (
        <Text weight="semibold" style={{ letterSpacing: 2 }}>
          DARKFANTASY
        </Text>
      ) : null}
    </View>
  );
}
