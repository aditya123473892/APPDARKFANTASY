import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Text } from '@/components/ui';
import type { User } from '@/features/auth/types';
import { mockUsers } from '@/mocks/users';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { ActionButtons } from '../components/ActionButtons';
import { CardStack, type CardStackHandle } from '../components/CardStack';

type Mode = 'People' | 'Swipe';
export function DiscoverScreen(): React.JSX.Element {
  const { theme } = useTheme(); const [query, setQuery] = useState(''); const [mode, setMode] = useState<Mode>('People'); const [liked, setLiked] = useState<Set<string>>(new Set()); const stack = useRef<CardStackHandle>(null);
  const people = useMemo(() => mockUsers.filter((user) => `${user.name} ${user.bio}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const like = (id: string): void => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setLiked((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  const row = ({ item }: { item: User }): React.JSX.Element => <View style={[styles.person, { borderBottomColor: theme.colors.divider }]}><Avatar uri={item.avatarUri} label={item.name} size={48} /><View style={styles.copy}><Text variant="label">{item.name}, {item.age}</Text><Text variant="caption" color="muted" numberOfLines={2}>{item.bio}</Text></View><Button label={liked.has(item.id) ? 'Liked' : 'Like'} variant="secondary" size="sm" onPress={() => like(item.id)} /></View>;
  return <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: theme.colors.background }]}>
    <View style={styles.header}><Text variant="title">Discover</Text><View style={[styles.toggle, { backgroundColor: theme.colors.surfaceElevated }]}>{(['People', 'Swipe'] as const).map((item) => <Pressable key={item} onPress={() => setMode(item)} style={[styles.toggleItem, mode === item && { backgroundColor: theme.colors.primarySoft }]}><Text variant="caption" color={mode === item ? 'primary' : 'muted'}>{item}</Text></Pressable>)}</View></View>
    {mode === 'People' ? <FlatList data={people} keyExtractor={(item) => item.id} renderItem={row} keyboardShouldPersistTaps="handled" ListHeaderComponent={<View style={[styles.search, { backgroundColor: theme.colors.surfaceElevated }]}><Ionicons name="search" size={19} color={theme.colors.textMuted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search people" placeholderTextColor={theme.colors.textMuted} style={[styles.searchInput, { color: theme.colors.textPrimary }]} /></View>} contentContainerStyle={styles.list} />
      : <View style={styles.swipe}><View style={styles.stack}><CardStack ref={stack} users={mockUsers} /></View><ActionButtons onAction={(action) => stack.current?.act(action)} /></View>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggle: { flexDirection: 'row', padding: spacing.xs, borderRadius: radius.full }, toggleItem: { minHeight: 32, paddingHorizontal: spacing.md, borderRadius: radius.full, justifyContent: 'center' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }, search: { height: spacing.touch, borderRadius: radius.full, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md }, searchInput: { flex: 1, fontSize: typography.size.md },
  person: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1 }, copy: { flex: 1, gap: spacing.xs }, swipe: { flex: 1, paddingHorizontal: spacing.lg }, stack: { flex: 1, marginVertical: spacing.md },
});
