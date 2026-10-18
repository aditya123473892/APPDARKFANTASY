import { ProtectedRoute } from '@/features/auth/components/Access';
import { EventEditorScreen } from '@/features/events/EventEditorScreen';
export default function EditEvent() {
  return (
    <ProtectedRoute capability="canViewAdminScreens">
      <EventEditorScreen />
    </ProtectedRoute>
  );
}
