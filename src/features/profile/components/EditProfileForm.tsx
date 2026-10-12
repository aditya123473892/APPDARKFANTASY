import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Input, Text } from '@/components/ui';
import type { User } from '@/features/auth/types';
export function EditProfileForm({
  user,
  onDone,
}: {
  user: User;
  onDone: () => void;
}): React.JSX.Element {
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  return (
    <View style={styles.form}>
      <Text variant="heading">Edit profile</Text>
      <Input label="Display name" value={name} autoCapitalize="words" onChangeText={setName} />
      <Input label="Bio" value={bio} multiline maxLength={240} onChangeText={setBio} />
      <Text variant="caption" color="muted">
        Changes are local in this UI-only build.
      </Text>
      <Button label="Save changes" onPress={onDone} />
    </View>
  );
}
const styles = StyleSheet.create({ form: { gap: 16 } });
