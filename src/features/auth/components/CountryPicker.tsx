import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CountryCode } from 'libphonenumber-js';
import { Header } from '@/components/layout';
import { SearchField, Text } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { countries, findCountry } from '../phone';

export function CountryPicker({
  value,
  onChange,
  disabled,
}: {
  value: CountryCode;
  onChange: (code: CountryCode) => void;
  disabled?: boolean;
}): React.JSX.Element {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = findCountry(value);
  const rows = useMemo(() => {
    const term = query.trim().toLowerCase().replace(/^\+/, '');
    if (!term) return countries();
    return countries().filter(
      (country) =>
        country.name.toLowerCase().includes(term) ||
        country.code.toLowerCase() === term ||
        country.dialCode.startsWith(term),
    );
  }, [query]);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Country code ${selected.name}, plus ${selected.dialCode}`}
        accessibilityHint="Opens the country list"
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceElevated },
        ]}
      >
        <Text>{selected.flag}</Text>
        <Text weight="semibold">+{selected.dialCode}</Text>
        <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={[styles.sheet, { backgroundColor: theme.colors.background }]}>
          <View style={styles.sheetHeader}>
            <Header
              title="Country code"
              action={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  hitSlop={8}
                  onPress={() => setOpen(false)}
                >
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </Pressable>
              }
            />
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder="Search country or code"
              autoFocus
            />
          </View>
          <FlatList
            data={rows}
            keyExtractor={(country) => country.code}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: item.code === value }}
                accessibilityLabel={`${item.name}, plus ${item.dialCode}`}
                onPress={() => {
                  onChange(item.code);
                  setQuery('');
                  setOpen(false);
                }}
                style={[styles.row, { borderBottomColor: theme.colors.border }]}
              >
                <Text>{item.flag}</Text>
                <Text style={styles.name}>{item.name}</Text>
                <Text color="muted">+{item.dialCode}</Text>
                {item.code === value ? (
                  <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
                ) : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  trigger: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sheet: { flex: 1 },
  sheetHeader: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.md },
  row: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { flex: 1 },
});
