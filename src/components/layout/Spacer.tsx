import { View } from 'react-native';
import { spacing } from '@/theme';
export function Spacer({ size = 'lg' }: { size?: keyof typeof spacing }): React.JSX.Element {
  return <View style={{ height: spacing[size], width: spacing[size] }} />;
}
