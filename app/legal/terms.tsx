import { LegalDocumentScreen } from '@/features/legal/LegalDocumentScreen';
import { termsOfUse } from '@/features/legal/legalContent';

export default function TermsOfUseRoute(): React.JSX.Element {
  return <LegalDocumentScreen doc={termsOfUse} />;
}
