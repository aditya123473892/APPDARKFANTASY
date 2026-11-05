import { LegalDocumentScreen } from '@/features/legal/LegalDocumentScreen';
import { accountDeletion } from '@/features/legal/legalContent';

export default function AccountDeletionRoute(): React.JSX.Element {
  return <LegalDocumentScreen doc={accountDeletion} />;
}
