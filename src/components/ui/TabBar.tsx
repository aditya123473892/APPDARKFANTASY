// SDK 57's router owns its navigation implementation and context.
import {
  BottomTabBar,
  type BottomTabBarProps,
} from 'expo-router/build/react-navigation/bottom-tabs';

/** Retains router links, accessibility, badges, and tab-press events. */
export function TabBar(props: BottomTabBarProps): React.JSX.Element {
  return <BottomTabBar {...props} />;
}
