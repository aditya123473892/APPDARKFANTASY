import { featureFlags } from '@/config/featureFlags';
import { RegisterForm } from '../components/RegisterForm';
import { PhoneRegisterScreen } from './PhoneRegisterScreen';

export function RegisterScreen(): React.JSX.Element {
  if (featureFlags.PHONE_AUTH_REQUIRED) return <PhoneRegisterScreen />;
  return <RegisterForm />;
}
