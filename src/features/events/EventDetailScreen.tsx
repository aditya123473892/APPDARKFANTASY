import { useCallback } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Header, Screen } from '@/components/layout';
import { Button, Loader, Text } from '@/components/ui';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useCan, useCurrentUserId } from '@/features/auth/hooks/useCurrentUser';
import { displayName } from '@/features/auth/userModel';
import { mediaUrl } from '@/services/api/backend';
import { describeError } from '@/services/errors';
import { spacing, radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { useEvent, useEventAction, useEvents } from './hooks';
import { eventsService } from './service';
import { applicationsClosed, referenceId } from './types';
import { isSessionCurrent } from '@/features/auth/sessionRuntime';
import { eventTime } from './EventsScreen';

export function EventDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const userId = useCurrentUserId();
  const admin = useCan('canViewAdminScreens');
  const router = useRouter();
  const { theme } = useTheme();
  const query = useEvent(id);
  const list = useEvents();
  const event = query.data;
  const owner = Boolean(event && referenceId(event.creator) === userId);
  const participants = useQuery({
    queryKey: ['events', userId, id, 'participants'],
    queryFn: () => eventsService.participants(id),
    enabled: Boolean(userId && event),
  });
  const requests = useQuery({
    queryKey: ['events', userId, id, 'requests'],
    queryFn: () => eventsService.requests(id),
    enabled: owner,
  });
  const { refetch: refetchEvent } = query;
  const { refetch: refetchParticipants } = participants;
  const { refetch: refetchRequests } = requests;
  const refresh = useCallback(() => {
    void refetchEvent();
    void refetchParticipants();
    if (owner) void refetchRequests();
  }, [refetchEvent, refetchParticipants, refetchRequests, owner]);
  const hasEvent = Boolean(event);
  useFocusEffect(
    useCallback(() => {
      if (hasEvent) refresh();
    }, [hasEvent, refresh]),
  );
  const join = useEventAction(() => eventsService.join(id, userId!), 'Application sent');
  const decide = useEventAction(
    ({ memberId, status }: { memberId: string; status: 'accepted' | 'rejected' }) =>
      eventsService.decide(memberId, status),
    'Application updated',
  );
  const remove = useEventAction(
    (memberId: string) => eventsService.removeMember(memberId),
    'Participant removed',
  );
  const deletion = useEventAction(() => eventsService.delete(id), 'Event deleted');
  const accepted = participants.data?.some((member) => member.user?._id === userId);
  const applied = list.data
    ?.find((item) => item._id === id)
    ?.users?.some((user) => referenceId(user) === userId);
  const full = Boolean(
    event?.capacity && participants.data && participants.data.length >= event.capacity,
  );
  const busy = decide.isPending || remove.isPending || deletion.isPending;
  const confirmDelete = () =>
    Alert.alert('Delete event?', 'This removes the event for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deletion.mutate(undefined, {
            onSuccess: (scope) => {
              if (isSessionCurrent(scope)) router.replace('/events');
            },
          }),
      },
    ]);
  return (
    <Screen padded={false} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Header title="Event details" back backFallback="/events" />
      </View>
      {query.isPending ? (
        <Loader />
      ) : !event ? (
        <ErrorState
          title="Event unavailable"
          message={describeError(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching || participants.isRefetching || requests.isRefetching}
              onRefresh={refresh}
              tintColor={theme.colors.primary}
            />
          }
        >
          {query.isError && <Text color="danger">Could not refresh. Pull down to try again.</Text>}
          {mediaUrl(event.cover?.url) ? (
            <Image
              source={{ uri: mediaUrl(event.cover?.url) }}
              style={styles.cover}
              contentFit="cover"
            />
          ) : null}
          <Text variant="caption" color="primary">
            {event.type === 'online' ? 'Online' : 'In person'} · {event.status}
          </Text>
          <Text variant="title">{event.name}</Text>
          {event.theme ? <Text variant="subheading">{event.theme}</Text> : null}
          <Text>{event.description}</Text>
          <Text color="secondary">Starts: {eventTime(event.startAt)}</Text>
          <Text color="secondary">Ends: {eventTime(event.endAt)}</Text>
          {event.location ? <Text>Location: {event.location}</Text> : null}
          {event.capacity != null ? <Text>Capacity: {event.capacity}</Text> : null}
          {event.registrationDeadline ? (
            <Text>Apply by: {eventTime(event.registrationDeadline)}</Text>
          ) : null}
          {!owner && (
            <>
              {accepted ? (
                <Text color="success">You're on the participant list.</Text>
              ) : applied ? (
                <Text color="secondary">
                  Application on file. Approved members appear in the participant list below.
                </Text>
              ) : (
                <Button
                  label={
                    applicationsClosed(event)
                      ? 'Applications closed'
                      : full
                        ? 'Event full'
                        : 'Apply to join'
                  }
                  disabled={
                    applicationsClosed(event) ||
                    full ||
                    !userId ||
                    list.isPending ||
                    list.isError ||
                    participants.isPending ||
                    participants.isError
                  }
                  loading={join.isPending}
                  onPress={() => join.mutate(undefined)}
                />
              )}
              {list.isError && (
                <Button
                  label="Reload application information"
                  variant="ghost"
                  onPress={() => void list.refetch()}
                />
              )}
              <Button
                label="Report event"
                variant="ghost"
                onPress={() =>
                  router.push({
                    pathname: '/report' as never,
                    params: { targetType: 'event', targetId: id },
                  })
                }
              />
            </>
          )}
          {admin && (
            <>
              <Button
                label="Edit event"
                variant="secondary"
                disabled={busy}
                onPress={() => router.push({ pathname: '/events/[id]/edit', params: { id } })}
              />
              <Button
                label="Delete event"
                variant="danger"
                loading={deletion.isPending}
                disabled={busy}
                onPress={confirmDelete}
              />
            </>
          )}
          {owner && (
            <>
              <Text variant="heading">Pending applications</Text>
              {requests.isPending ? (
                <Loader />
              ) : requests.isError ? (
                <ErrorState
                  title="Couldn't load applications"
                  message={describeError(requests.error)}
                  onRetry={() => void requests.refetch()}
                />
              ) : requests.data?.length ? (
                requests.data.map((member) => (
                  <View
                    key={member._id}
                    style={[styles.member, { borderColor: theme.colors.border }]}
                  >
                    <Text>{member.user ? displayName(member.user) : 'Unavailable member'}</Text>
                    <Button
                      label="Approve"
                      disabled={busy}
                      onPress={() => decide.mutate({ memberId: member._id, status: 'accepted' })}
                    />
                    <Button
                      label="Decline"
                      variant="secondary"
                      disabled={busy}
                      onPress={() => decide.mutate({ memberId: member._id, status: 'rejected' })}
                    />
                  </View>
                ))
              ) : (
                <Text color="muted">No pending applications.</Text>
              )}
            </>
          )}
          <Text variant="heading">
            Participants{participants.data ? ` (${participants.data.length})` : ''}
          </Text>
          {participants.isPending ? (
            <Loader />
          ) : participants.isError ? (
            <ErrorState
              title="Couldn't load participants"
              message={describeError(participants.error)}
              onRetry={() => void participants.refetch()}
            />
          ) : participants.data?.length ? (
            participants.data.map((member) => (
              <View key={member._id} style={[styles.member, { borderColor: theme.colors.border }]}>
                <Text>{member.user ? displayName(member.user) : 'Unavailable member'}</Text>
                {owner && (
                  <Button
                    label="Remove participant"
                    variant="danger"
                    disabled={busy}
                    onPress={() =>
                      Alert.alert('Remove participant?', 'They will be removed from this event.', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: () => remove.mutate(member._id),
                        },
                      ])
                    }
                  />
                )}
              </View>
            ))
          ) : (
            <Text color="muted">No participants yet.</Text>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.screen },
  content: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxxl },
  cover: { width: '100%', height: 220, borderRadius: radius.lg },
  member: { padding: spacing.md, borderWidth: 1, borderRadius: radius.md, gap: spacing.sm },
});
