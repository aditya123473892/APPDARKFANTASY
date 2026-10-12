import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Modal, PostCard, Tabs, Text } from '@/components/ui';
import { posts } from '@/data/posts';
import { currentUser } from '@/mocks/users';
import { spacing } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { EditProfileForm } from '../components/EditProfileForm';

type ProfileTab = 'Posts' | 'Replies' | 'Media';
export function MyProfileScreen(): React.JSX.Element {
  const router = useRouter(); const { theme } = useTheme(); const [editing, setEditing] = useState(false); const [tab, setTab] = useState<ProfileTab>('Posts');
  const visible = tab === 'Media' ? posts.filter((post) => post.media?.length) : tab === 'Replies' ? posts.slice(1, 3) : posts;
  return <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: theme.colors.background }]}><ScrollView contentContainerStyle={styles.scroll}>
    <View style={styles.topbar}><Text variant="heading">Profile</Text><Pressable accessibilityLabel="Settings" onPress={() => router.push('/settings')} style={styles.settings}><Ionicons name="menu-outline" size={26} color={theme.colors.textPrimary} /></Pressable></View>
    <View style={styles.identity}><View style={styles.nameBlock}><Text variant="title">{currentUser.name}</Text><Text variant="caption" color="muted">@alexmorgan</Text></View><Avatar uri={currentUser.avatarUri} label={currentUser.name} size={78} ring /></View>
    <Text style={styles.bio}>{currentUser.bio}</Text><View style={styles.stats}><Text variant="caption" color="muted"><Text weight="semibold">24</Text> posts</Text><Text variant="caption" color="muted"><Text weight="semibold">18</Text> matches</Text></View>
    <View style={styles.buttons}><Button label="Edit profile" variant="secondary" size="sm" onPress={() => setEditing(true)} style={styles.button} /><Button label="Share profile" variant="secondary" size="sm" onPress={() => { void Share.share({ message: 'Meet Alex on DARKFANTASY.' }); }} style={styles.button} /></View>
    <Tabs items={['Posts', 'Replies', 'Media'] as const} value={tab} onChange={setTab} />
    <View style={styles.posts}>{visible.map((post) => <PostCard key={`${tab}-${post.id}`} post={post} />)}</View>
  </ScrollView><Modal visible={editing} title="Edit profile" onClose={() => setEditing(false)}><EditProfileForm user={currentUser} onDone={() => setEditing(false)} /></Modal></SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, scroll: { paddingBottom: spacing.xxl }, topbar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg }, settings: { width: spacing.touch, height: spacing.touch, alignItems: 'flex-end', justifyContent: 'center' }, identity: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.lg }, nameBlock: { gap: spacing.xs }, bio: { paddingHorizontal: spacing.lg, paddingTop: spacing.md }, stats: { flexDirection: 'row', gap: spacing.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.md }, buttons: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg }, button: { flex: 1 }, posts: { minHeight: 240 } });
