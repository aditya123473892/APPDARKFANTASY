import { useState } from 'react';
import { View } from 'react-native';
import { Header, Screen } from '@/components/layout';
import { Button, Modal, PhotoGrid, Text } from '@/components/ui';
import { useAuthStore } from '@/features/auth/store/authStore';
import { EditProfileForm } from '@/features/profile/components/EditProfileForm';
import { spacing } from '@/theme';

export default function PhotosScreen() {
  const user = useAuthStore((state) => state.user);
  const [editing, setEditing] = useState(false);
  if (!user) return <Screen />;
  const photos = (user.photos?.length ? user.photos : [user.avatarUri]).filter(Boolean);
  return (
    <Screen scroll>
      <Header title="Photos" back backFallback="/profile" />
      <View style={{ gap: spacing.xl, paddingVertical: spacing.xl }}>
        <PhotoGrid photos={photos} name={user.name} />
        <Text color="secondary">Your main photo appears on your profile and in conversations.</Text>
        <Button label="Edit profile photo" icon="camera-outline" onPress={() => setEditing(true)} />
      </View>
      <Modal visible={editing} title="Edit profile" onClose={() => setEditing(false)}>
        <EditProfileForm user={user} onDone={() => setEditing(false)} />
      </Modal>
    </Screen>
  );
}
