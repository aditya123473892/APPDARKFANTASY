import { useKeyboardState } from 'react-native-keyboard-controller';
export function useKeyboard(): boolean {
  return useKeyboardState((state) => state.isVisible);
}
