import type { AlertButton } from 'react-native';
import { BottomSheet, Button, Text } from '@/components/ui';

export function MessageActionPopup({ actions, onClose }: { actions: AlertButton[] | null; onClose: () => void }) {
  return <BottomSheet visible={actions !== null} onClose={onClose}>
    <Text accessibilityRole="header" variant="subheading">Message actions</Text>
    {(actions ?? []).map((action, index) => <Button key={`${action.text}-${index}`}
      label={action.text ?? 'Action'} variant="secondary" onPress={() => {
        onClose(); action.onPress?.();
      }} />)}
  </BottomSheet>;
}
