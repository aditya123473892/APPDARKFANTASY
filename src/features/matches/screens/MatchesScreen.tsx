import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Tabs, Text } from '@/components/ui';
import { activities, type ActivityItem } from '@/data/posts';
import { mockUsers } from '@/mocks/users';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';

type Filter = 'All' | 'Matches' | 'Likes' | 'Replies';
export function MatchesScreen(): React.JSX.Element {
  const { theme } = useTheme(); const [filter, setFilter] = useState<Filter>('All');
  const data = activities.filter((item) => filter === 'All' || (filter === 'Matches' && item.kind === 'match') || (filter === 'Likes' && item.kind === 'like') || (filter === 'Replies' && item.kind === 'reply'));
  const render = ({ item }: { item: ActivityItem }): React.JSX.Element => { const user = mockUsers.find((candidate) => candidate.id === item.userId) ?? mockUsers[0]!; return <View style={[styles.row, { borderBottomColor: theme.colors.divider }]}><Avatar uri={user.avatarUri} label={user.name} size={44} /><View style={styles.copy}><Text><Text weight="semibold">{user.name} </Text>{item.text}</Text><Text variant="caption" color="muted">{item.time}</Text></View>{item.kind === 'match' ? <View style={[styles.badge, { backgroundColor: theme.colors.primarySoft }]}><Text variant="caption" color="primary">Message</Text></View> : null}</View>; };
  return <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: theme.colors.background }]}><View style={styles.header}><Text variant="title">Activity</Text></View><Tabs items={['All', 'Matches', 'Likes', 'Replies'] as const} value={filter} onChange={setFilter} /><FlatList data={data} keyExtractor={(item) => item.id} renderItem={render} contentContainerStyle={styles.list} /></SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg }, list: { paddingHorizontal: spacing.lg }, row: { minHeight: 76, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, copy: { flex: 1, gap: spacing.xs }, badge: { minHeight: 32, paddingHorizontal: spacing.md, borderRadius: 999, justifyContent: 'center' } });
