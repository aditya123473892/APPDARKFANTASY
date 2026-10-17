import { Button } from '@/components/ui';
export function SocialButtons(): React.JSX.Element {
  return (
    <Button
      label="Continue with a social account"
      icon="people-outline"
      variant="secondary"
      disabled
      accessibilityLabel="Social sign-in is currently unavailable"
      onPress={() => undefined}
    />
  );
}
