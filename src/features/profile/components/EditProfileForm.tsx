import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { Button, Chip, Input, Text } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import type { UserView as User } from '@/features/auth/types';
import { describeError } from '@/services/errors';
import { spacing } from '@/theme';
import { useUpdateMyProfile } from '../hooks/useProfiles';

const MAX_INTERESTS = 6;
export const INTEREST_OPTIONS = [
  'Art',
  'Books',
  'Coffee',
  'Cooking',
  'Dance',
  'Film',
  'Fitness',
  'Food',
  'Hiking',
  'Jazz',
  'Live music',
  'Museums',
  'Photography',
  'Poetry',
  'Road trips',
  'Running',
  'Travel',
  'Wine',
];

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Enter at least 2 characters')
    .max(40, 'Keep it under 40 characters'),
  bio: z
    .string()
    .trim()
    .min(10, 'Tell people a little more (10+ characters)')
    .max(240, 'Keep it under 240 characters'),
  interests: z
    .array(z.string())
    .min(1, 'Pick at least one interest')
    .max(MAX_INTERESTS, `Pick up to ${MAX_INTERESTS}`),
});
type Values = z.infer<typeof schema>;

export function EditProfileForm({
  user,
  onDone,
}: {
  user: User;
  onDone: () => void;
}): React.JSX.Element {
  const update = useUpdateMyProfile();
  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user.name,
      bio: user.bio,
      interests: user.interests,
    },
  });
  const options = [...new Set([...INTEREST_OPTIONS, ...user.interests])].sort();

  const save = (values: Values): void => {
    update.mutate(
      {
        ...values,
      },
      {
        onSuccess: () => {
          toast.success('Profile updated');
          onDone();
        },
        onError: (error) =>
          toast.error(describeError(error, "Couldn't save your profile. Please try again.")),
      },
    );
  };

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <Input
            label="Display name"
            value={field.value}
            autoCapitalize="words"
            maxLength={40}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            error={errors.name?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="bio"
        render={({ field }) => (
          <Input
            label="About you"
            value={field.value}
            multiline
            autoCapitalize="sentences"
            maxLength={240}
            showCount
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            error={errors.bio?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="interests"
        render={({ field }) => (
          <View style={styles.group}>
            <Text variant="label" color="secondary">
              Interests · {field.value.length}/{MAX_INTERESTS}
            </Text>
            <View style={styles.chips}>
              {options.map((interest) => {
                const selected = field.value.includes(interest);
                const full = !selected && field.value.length >= MAX_INTERESTS;
                return (
                  <Chip
                    key={interest}
                    label={interest}
                    selected={selected}
                    onPress={
                      full
                        ? () => toast.show(`You can pick up to ${MAX_INTERESTS} interests`)
                        : () =>
                            field.onChange(
                              selected
                                ? field.value.filter((item) => item !== interest)
                                : [...field.value, interest],
                            )
                    }
                  />
                );
              })}
            </View>
            {errors.interests?.message ? (
              <Text variant="caption" color="danger">
                {errors.interests.message}
              </Text>
            ) : null}
          </View>
        )}
      />
      <Button
        label={isDirty ? 'Save changes' : 'No changes yet'}
        disabled={!isDirty}
        loading={update.isPending}
        onPress={handleSubmit(save)}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  group: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
