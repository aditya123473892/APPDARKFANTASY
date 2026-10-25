import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Ionicons } from '@expo/vector-icons';
import { Header, Screen } from '@/components/layout';
import { Button, Text } from '@/components/ui';
import { useTheme } from '@/theme/useTheme';
import { radius, spacing } from '@/theme';
import { useBlock } from './useBlock';
import {
  getReportDraft,
  reportCategories,
  setReportDraft,
  submitReport,
  type ReportDraft,
  type ReportTarget,
} from './reports';
import { isSessionCurrent, sessionIdentity } from '@/features/auth/sessionRuntime';
export function ReportScreen() {
  const params = useLocalSearchParams<{
    targetType: string;
    targetId: string;
    messageId?: string;
  }>();
  const target = {
    targetType: params.targetType,
    targetId: params.targetId,
    ...(params.messageId ? { messageId: params.messageId } : {}),
  } as ReportTarget;
  const [draft, setDraft] = useState<ReportDraft>(() => getReportDraft(target));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [result, setResult] = useState<{ reportId: string; targetOwnerId: string }>();
  const submitting = useRef(false),
    block = useBlock(),
    router = useRouter(),
    { theme } = useTheme();
  const update = (value: ReportDraft) => {
    setDraft(value);
    setReportDraft(target, value);
  };
  const submit = async () => {
    if (submitting.current || result) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    const scope = sessionIdentity.generation;
    try {
      const saved = await submitReport(target, draft);
      if (isSessionCurrent(scope)) setResult(saved);
    } catch (cause) {
      if (isSessionCurrent(scope))
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not submit. Your draft is still in memory.',
        );
    } finally {
      submitting.current = false;
      if (isSessionCurrent(scope)) setBusy(false);
    }
  };
  return (
    <Screen scroll>
      <Header title="Report" back />
      <View style={{ gap: spacing.md, paddingVertical: spacing.md }}>
        {result ? (
          <>
            <Text variant="subheading">We received your report</Text>
            <Text>
              Your identity is kept private from the reported person. Check My reports for status.
            </Text>
            <Button
              label="Also block this user"
              onPress={() => block.confirm(result.targetOwnerId)}
            />
            <Button
              label="My reports"
              variant="secondary"
              onPress={() => router.replace('/settings/my-reports' as Href)}
            />
          </>
        ) : (
          <>
            <Text variant="subheading">Why are you reporting this?</Text>
            <View accessibilityRole="radiogroup" style={styles.options}>
              {reportCategories.map((category) => (
                <Pressable
                  key={category}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: draft.category === category }}
                  disabled={busy}
                  onPress={() => update({ ...draft, category })}
                  style={[
                    styles.option,
                    {
                      borderColor:
                        draft.category === category ? theme.colors.primary : theme.colors.border,
                      backgroundColor:
                        draft.category === category
                          ? theme.colors.primarySoft
                          : theme.colors.surface,
                    },
                  ]}
                >
                  <Ionicons
                    name={draft.category === category ? 'radio-button-on' : 'radio-button-off'}
                    size={21}
                    color={
                      draft.category === category ? theme.colors.primary : theme.colors.textMuted
                    }
                  />
                  <Text style={styles.optionLabel}>
                    {category.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase())}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              accessibilityLabel="Optional report note"
              placeholder="Optional note (500 characters maximum)"
              multiline
              maxLength={500}
              value={draft.details}
              editable={!busy}
              onChangeText={(details) => update({ ...draft, details })}
              placeholderTextColor={theme.colors.textMuted}
              textAlignVertical="top"
              style={[
                styles.note,
                {
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!draft.childSafetySuspected }}
              disabled={busy}
              style={styles.checkbox}
              onPress={() =>
                update({ ...draft, childSafetySuspected: !draft.childSafetySuspected })
              }
            >
              <Ionicons
                name={draft.childSafetySuspected ? 'checkbox' : 'square-outline'}
                size={24}
                color={theme.colors.primary}
              />
              <Text style={styles.optionLabel}>May involve child sexual abuse or exploitation</Text>
            </Pressable>
            <Text>
              Submit online. Offline drafts stay only in memory and are never sent automatically.
              Reports preserve relevant content and conversation context for review.
            </Text>
            {error ? <Text color="danger">{error}</Text> : null}
            <Button
              label="Submit report"
              disabled={!draft.category || busy}
              loading={busy}
              onPress={() => void submit()}
            />
          </>
        )}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  optionLabel: { flex: 1, minWidth: 0 },
  note: { minHeight: 120, padding: spacing.md, borderWidth: 1, borderRadius: radius.md },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
});
