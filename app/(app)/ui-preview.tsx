import { Redirect } from 'expo-router';
import { SocialPreviewScreen } from '@/features/feed/screens/SocialPreviewScreen';
export default function Preview() {
  return __DEV__ ? <SocialPreviewScreen /> : <Redirect href="/home" />;
}
