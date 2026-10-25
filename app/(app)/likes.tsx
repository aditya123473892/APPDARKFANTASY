import { Header, Screen } from '@/components/layout';
import { FollowRequestsScreen } from '@/features/activity/screens/ActivityScreen';
import { View } from 'react-native';
import { spacing } from '@/theme';

export default function LikesScreen() {
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.screen }}>
        <Header
          title="Likes"
          subtitle="People who want to follow you"
          back
          backFallback="/profile"
        />
      </View>
      <FollowRequestsScreen />
    </Screen>
  );
}
