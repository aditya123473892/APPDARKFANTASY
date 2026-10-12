import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Text } from '@/components/ui';
import { mockImages } from '@/mocks/images';
import { mockUsers } from '@/mocks/users';
import { InterestChips } from '../components/InterestChips';
import { PhotoGrid } from '../components/PhotoGrid';
import { ProfileHeader } from '../components/ProfileHeader';
export function UserProfileScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = mockUsers.find((item) => item.id === id) ?? mockUsers[0]!;
  return (
    <Screen scroll>
      <Header title="Profile" back />
      <View style={styles.content}>
        <ProfileHeader user={user} onMessage={() => router.push('/chat/c1')} />
        <Text variant="heading">Into</Text>
        <InterestChips interests={user.interests} />
        <Text variant="heading">More of {user.name}</Text>
        <PhotoGrid photos={[user.avatarUri, mockImages[1]!, mockImages[3]!, mockImages[5]!]} />
      </View>
      <View style={styles.bottom} />
    </Screen>
  );
}
const styles = StyleSheet.create({ content: { gap: 20, paddingTop: 18 }, bottom: { height: 30 } });
