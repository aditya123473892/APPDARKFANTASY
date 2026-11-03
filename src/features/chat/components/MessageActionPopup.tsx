import { Platform, type AlertButton } from 'react-native';
import { BottomSheet, Button, Text } from '@/components/ui';

/** iOS cannot present the confirm dialog while this sheet's modal is still sliding out. */
const SHEET_CLOSE_MS = Platform.OS === 'ios' ? 350 : 0;

export function MessageActionPopup({ actions, onClose }: { actions: AlertButton[] | null; onClose: () => void }) {
  return <BottomSheet visible={actions !== null} onClose={onClose}>
    <Text accessibilityRole="header" variant="subheading">Message actions</Text>
    {(actions ?? []).map((action, index) => <Button key={`${action.text}-${index}`}
      label={action.text ?? 'Action'} variant="secondary" onPress={() => {
        onClose(); setTimeout(() => action.onPress?.(), SHEET_CLOSE_MS);
      }} />)}
  </BottomSheet>;
}
