import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, type Href } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Header, Screen } from '@/components/layout';
import { Button, Chip, Text, TextField } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import { useHasRole } from '@/features/auth/hooks/useCurrentUser';
import { useTheme } from '@/theme/useTheme';
import { radius, spacing } from '@/theme';
import { reasonLabel } from './adminMedia';
import { caseDetail, startReview, takeAction, type ModAction, type ModCase } from './moderation';

const actions: { value: ModAction; label: string; adminOnly?: boolean }[] = [
  { value: 'dismiss', label: 'Dismiss' },
  { value: 'warn', label: 'Warn' },
  { value: 'soft_remove', label: 'Remove content' },
  { value: 'suspend', label: 'Suspend' },
  { value: 'escalate', label: 'Escalate' },
  { value: 'ban', label: 'Ban', adminOnly: true },
];
const suspensions = [1, 3, 7, 30] as const;
// Server-escaped evidence text: decode the few entities it produces, for display only.
const decode = (value: string) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
function Snapshot({ value }: { value?: Record<string, unknown> }) {
  if (!value) return null;
  const rows = Object.entries(value).filter(([, item]) =>
    ['string', 'number', 'boolean'].includes(typeof item),
  );
  return (
    <View style={styles.snapshot}>
      {rows.map(([key, item]) => (
        <Text key={key} variant="caption">
          <Text variant="caption" color="secondary">
            {key}:{' '}
          </Text>
          {decode(String(item))}
        </Text>
      ))}
    </View>
  );
}

/** One report case: evidence, then review and enforcement actions with a required note. */
export function ModerationCaseScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const client = useQueryClient();
  const admin = useHasRole(['admin']);
  const [action, setAction] = useState<ModAction>('dismiss');
  const [days, setDays] = useState<(typeof suspensions)[number]>(1);
  const [note, setNote] = useState('');
  const query = useQuery({ queryKey: ['mod-case', id], queryFn: () => caseDetail(id) });
  const refresh = (next: ModCase) => {
    client.setQueryData(['mod-case', id], (old: unknown) => ({ ...(old as object), ...next }));
    void client.invalidateQueries({ queryKey: ['mod-cases'] });
    void query.refetch();
    setNote('');
  };
  const review = useMutation({
    mutationFn: (item: ModCase) => startReview(item, note.trim()),
    onSuccess: (next) => {
      toast.success('Case is now in review');
      refresh(next);
    },
    onError: (error) => toast.error(error.message),
  });
  const act = useMutation({
    mutationFn: (item: ModCase) =>
      takeAction(
        item,
        action,
        note.trim(),
        action === 'suspend' ? new Date(Date.now() + days * 86_400_000).toISOString() : undefined,
      ),
    onSuccess: (next) => {
      toast.success('Decision saved');
      refresh(next);
    },
    onError: (error) => toast.error(error.message),
  });
  const item = query.data;
  const closed = item && ['actioned', 'dismissed'].includes(item.status);
  const busy = review.isPending || act.isPending;
  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <Header title="Report case" back backFallback={'/moderation' as Href} />
      {query.isPending ? (
        <ActivityIndicator style={styles.gap} />
      ) : query.isError || !item ? (
        <View style={styles.gap}>
          <Text color="danger">{query.error?.message ?? 'Case unavailable.'}</Text>
          <Button label="Try again" variant="secondary" onPress={() => void query.refetch()} />
        </View>
      ) : (
        <View style={styles.content}>
          <View
            style={[
              styles.card,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
            ]}
          >
            <Text variant="subheading">{reasonLabel(item.category)}</Text>
            <Text color="secondary">
              {item.targetType.replace(/_/g, ' ')} · {item.status.replace(/_/g, ' ')}
              {item.restricted ? ' · restricted (child safety)' : ''}
            </Text>
            <Text variant="caption" color="muted">
              Case {item.reportId} · {new Date(item.createdAt).toLocaleString()}
            </Text>
            {!!item.details && <Text>{decode(item.details)}</Text>}
          </View>
          <Text variant="label">Evidence</Text>
          {item.evidence.length ? (
            item.evidence.map((evidence) => (
              <View
                key={evidence.evidenceId}
                style={[styles.card, { borderColor: theme.colors.border }]}
              >
                <Snapshot value={evidence.snapshot} />
                {(evidence.context ?? []).map((context, index) => (
                  <Snapshot key={index} value={context} />
                ))}
                {!!evidence.images?.length && (
                  <Text variant="caption" color="secondary">
                    {evidence.images.length} preserved image
                    {evidence.images.length === 1 ? '' : 's'} (
                    {evidence.images.map((image) => image.state.replace(/_/g, ' ')).join(', ')})
                  </Text>
                )}
              </View>
            ))
          ) : (
            <Text color="secondary">No evidence snapshot.</Text>
          )}
          {closed ? (
            <Text color="secondary">This case is closed.</Text>
          ) : (
            <>
              <TextField
                label="Moderator note (required)"
                value={note}
                onChangeText={setNote}
                maxLength={500}
                multiline
                placeholder="What did you check and why?"
              />
              {item.status === 'open' ? (
                <Button
                  label="Start review"
                  icon="eye-outline"
                  loading={review.isPending}
                  disabled={busy || !note.trim()}
                  onPress={() => review.mutate(item)}
                />
              ) : (
                <>
                  <Text variant="label">Decision</Text>
                  <View style={styles.chips}>
                    {actions
                      .filter((option) => !option.adminOnly || admin)
                      .map((option) => (
                        <Chip
                          key={option.value}
                          label={option.label}
                          selected={action === option.value}
                          onPress={() => setAction(option.value)}
                        />
                      ))}
                  </View>
                  {action === 'suspend' && (
                    <View style={styles.chips}>
                      {suspensions.map((value) => (
                        <Chip
                          key={value}
                          size="sm"
                          label={`${value} day${value === 1 ? '' : 's'}`}
                          selected={days === value}
                          onPress={() => setDays(value)}
                        />
                      ))}
                    </View>
                  )}
                  <Button
                    label="Save decision"
                    variant={
                      ['ban', 'suspend', 'soft_remove'].includes(action) ? 'danger' : 'primary'
                    }
                    loading={act.isPending}
                    disabled={busy || !note.trim()}
                    onPress={() => act.mutate(item)}
                  />
                </>
              )}
            </>
          )}
        </View>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  gap: { marginTop: 32, gap: 12 },
  content: { gap: spacing.md, paddingVertical: spacing.md },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: 6,
  },
  snapshot: { gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
