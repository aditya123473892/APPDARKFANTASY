import { LegalDocumentScreen } from '@/features/legal/LegalDocumentScreen';
import { privacyPolicy } from '@/features/legal/legalContent';

export default function PrivacyPolicyRoute(): React.JSX.Element {
  return <LegalDocumentScreen doc={privacyPolicy} />;
}
