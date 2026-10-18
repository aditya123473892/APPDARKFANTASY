import { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Header, Screen } from '@/components/layout';
import { Button, Input, Loader, Text } from '@/components/ui';
import { ErrorState } from '@/components/feedback/ErrorState';
import { toast } from '@/components/ui/Toast';
import { pickImage } from '@/features/create-post/pickMedia';
import type { UploadAsset } from '@/features/feed/types';
import { usePhotoDraftCleanup } from '@/hooks/usePhotoDraftCleanup';
import { sessionIdentity, isSessionCurrent } from '@/features/auth/sessionRuntime';
import { describeError } from '@/services/errors';
import { mediaUrl } from '@/services/api/backend';
import { radius, spacing } from '@/theme';
import { useEvent } from './hooks';
import { eventsService } from './service';
import { localEventDate, parseEventDate, type Event, type EventInput } from './types';

export function EventEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const eventId = typeof id === 'string' ? id : undefined;
  const query = useEvent(eventId ?? '');
  if (eventId && query.isPending)
    return (
      <Screen>
        <Header title="Edit event" back />
        <Loader />
      </Screen>
    );
  if (eventId && !query.data)
    return (
      <Screen>
        <Header title="Edit event" back />
        <ErrorState
          title="Event unavailable"
          message={describeError(query.error)}
          onRetry={() => void query.refetch()}
        />
      </Screen>
    );
  return <EventForm key={eventId ?? 'new'} event={query.data} />;
}

function EventForm({ event }: { event?: Event }) {
  const router = useRouter();
  const client = useQueryClient();
  const [name, setName] = useState(event?.name ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [theme, setTheme] = useState(event?.theme ?? '');
  const [type, setType] = useState<'online' | 'offline'>(event?.type ?? 'offline');
  const [location, setLocation] = useState(event?.location ?? '');
  const [startAt, setStartAt] = useState(localEventDate(event?.startAt));
  const [endAt, setEndAt] = useState(localEventDate(event?.endAt));
  const [deadline, setDeadline] = useState(localEventDate(event?.registrationDeadline));
  const [capacity, setCapacity] = useState(event?.capacity == null ? '' : String(event.capacity));
  const [cover, setCover] = useState<UploadAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  usePhotoDraftCleanup(cover ? [cover] : []);
  const selectCover = async () => {
    try {
      const photo = await pickImage();
      if (photo) setCover(photo);
    } catch {
      toast.error('Could not select that photo. Please try another.');
    }
  };
  const save = async () => {
    if (lock.current) return;
    setError('');
    const start = parseEventDate(startAt);
    const end = parseEventDate(endAt);
    const registrationDeadline = deadline.trim() ? parseEventDate(deadline) : undefined;
    if (!name.trim() || !description.trim()) {
      setError('Enter an event name and description.');
      return;
    }
    if (!start || !end) {
      setError('Enter valid start and end times as YYYY-MM-DD HH:mm.');
      return;
    }
    if (Date.parse(end) <= Date.parse(start)) {
      setError('End time must be after start time.');
      return;
    }
    if (
      deadline.trim() &&
      (!registrationDeadline || Date.parse(registrationDeadline) > Date.parse(start))
    ) {
      setError('Enter a valid registration deadline on or before the start time.');
      return;
    }
    if (
      capacity.trim() &&
      (!/^\d+$/.test(capacity.trim()) ||
        !Number.isSafeInteger(Number(capacity)) ||
        Number(capacity) <= 0)
    ) {
      setError('Capacity must be a positive whole number.');
      return;
    }
    if (type === 'offline' && !location.trim()) {
      setError('Enter a location for an in-person event.');
      return;
    }
    // The API cannot clear an existing optional date/number with an empty string.
    if (event?.registrationDeadline && !deadline.trim()) {
      setError('Enter a registration deadline.');
      return;
    }
    if (event?.capacity != null && !capacity.trim()) {
      setError('Enter the event capacity.');
      return;
    }
    const input: EventInput = {
      name: name.trim(),
      description: description.trim(),
      theme: theme.trim(),
      type,
      location: location.trim(),
      startAt: start,
      endAt: end,
      ...(capacity.trim() ? { capacity: Number(capacity) } : {}),
      ...(registrationDeadline ? { registrationDeadline } : {}),
    };
    lock.current = true;
    setBusy(true);
    const scope = sessionIdentity.generation;
    try {
      const result = await eventsService.save(input, event?._id, cover ?? undefined);
      if (!isSessionCurrent(scope)) return;
      await client.invalidateQueries({ queryKey: ['events'] });
      if (!isSessionCurrent(scope)) return;
      toast.success(event ? 'Event updated' : 'Event created');
      router.replace({ pathname: '/events/[id]', params: { id: result._id } });
    } catch (failure) {
      if (isSessionCurrent(scope))
        setError(
          describeError(
            failure,
            'Could not save the event. Check the Events list before trying again.',
          ),
        );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const coverUri = cover?.uri || mediaUrl(event?.cover?.url);
  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <Header title={event ? 'Edit event' : 'Create event'} back backFallback="/events" />
      <View style={styles.form}>
        <Text color="secondary">
          Bring your community together. All times use your device's local time.
        </Text>
        <Input
          label="Event name"
          value={name}
          onChangeText={setName}
          editable={!busy}
          autoCapitalize="sentences"
        />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          editable={!busy}
          autoCapitalize="sentences"
        />
        <Input label="Theme (optional)" value={theme} onChangeText={setTheme} editable={!busy} />
        <Text variant="label">Event type</Text>
        <View style={styles.row}>
          <Button
            label="In person"
            variant={type === 'offline' ? 'primary' : 'secondary'}
            fullWidth={false}
            style={styles.choice}
            disabled={busy}
            onPress={() => setType('offline')}
          />
          <Button
            label="Online"
            variant={type === 'online' ? 'primary' : 'secondary'}
            fullWidth={false}
            style={styles.choice}
            disabled={busy}
            onPress={() => setType('online')}
          />
        </View>
        <Input
          label={type === 'offline' ? 'Location' : 'Meeting details or link (optional)'}
          value={location}
          onChangeText={setLocation}
          editable={!busy}
        />
        <Input
          label="Start time"
          placeholder="YYYY-MM-DD HH:mm"
          hint="Example: 2026-12-20 18:30"
          value={startAt}
          onChangeText={setStartAt}
          editable={!busy}
        />
        <Input
          label="End time"
          placeholder="YYYY-MM-DD HH:mm"
          value={endAt}
          onChangeText={setEndAt}
          editable={!busy}
        />
        <Input
          label="Registration deadline (optional)"
          placeholder="YYYY-MM-DD HH:mm"
          value={deadline}
          onChangeText={setDeadline}
          editable={!busy}
        />
        <Input
          label="Capacity (optional)"
          keyboardType="number-pad"
          value={capacity}
          onChangeText={setCapacity}
          editable={!busy}
        />
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={styles.cover} contentFit="cover" />
        ) : null}
        <Button
          label={coverUri ? 'Change cover photo' : 'Add cover photo'}
          variant="secondary"
          disabled={busy}
          onPress={() => void selectCover()}
        />
        {cover && (
          <Button
            label="Discard selected photo"
            variant="ghost"
            disabled={busy}
            onPress={() => setCover(null)}
          />
        )}
        {error ? (
          <Text color="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Button
          label={event ? 'Save changes' : 'Create event'}
          loading={busy}
          onPress={() => void save()}
        />
        {!busy && (
          <Button
            label="Cancel"
            variant="ghost"
            onPress={() =>
              Alert.alert('Discard changes?', 'Your unsaved changes will be lost.', [
                { text: 'Keep editing', style: 'cancel' },
                {
                  text: 'Discard',
                  style: 'destructive',
                  onPress: () => (router.canGoBack() ? router.back() : router.replace('/events')),
                },
              ])
            }
          />
        )}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingBottom: spacing.xxxl },
  cover: { width: '100%', height: 180, borderRadius: radius.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  choice: { flex: 1 },
});
