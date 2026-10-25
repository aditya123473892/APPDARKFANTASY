import { useContext } from 'react';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/theme';

/** Also works in stack screens and modals outside the tab navigator. */
export function useContentInsets() {
  const tabHeight = useContext(BottomTabBarHeightContext);
  const safe = useSafeAreaInsets();
  return { bottom: (tabHeight ?? safe.bottom) + spacing.xl, inTabs: tabHeight != null };
}
