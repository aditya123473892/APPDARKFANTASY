import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';
import { RemoteMedia } from '@/components/ui/RemoteMedia';
import { spacing } from '@/theme';

/** All chat photos stay in the viewer's memory; no disk cache or gallery export. */
export function ChatPhotoViewer({
  visible,
  uri,
  mimetype,
  loading,
  label,
  onClose,
  onLoad,
  onError,
  reportTarget,
}: {
  visible: boolean;
  uri: string | null;
  mimetype?: string;
  loading: boolean;
  label: string;
  onClose: () => void;
  onLoad: () => void;
  onError: () => void;
  reportTarget?: { messageId: string; mediaId: string };
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  return (
    <Modal visible={visible} animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Text weight="semibold" numberOfLines={1} style={styles.text}>
            {label}
          </Text>
          {reportTarget ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Report image"
              style={styles.close}
              onPress={() => {
                onClose();
                router.push({
                  pathname: '/report' as never,
                  params: {
                    targetType: 'chat_media',
                    targetId: reportTarget.mediaId,
                    messageId: reportTarget.messageId,
                  },
                });
              }}
            >
              <Ionicons name="flag-outline" color="#fff" size={24} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            onPress={onClose}
            style={styles.close}
          >
            <Ionicons name="close" color="#fff" size={28} />
          </Pressable>
        </View>
        <View style={styles.content}>
          {visible && uri && mimetype?.startsWith('video/') ? (
            <RemoteMedia
              uri={uri}
              mimetype={mimetype}
              width={width}
              height={Math.max(1, height - insets.top - insets.bottom - 56)}
              privateMedia
            />
          ) : visible && uri ? (
            <Image
              source={{ uri }}
              contentFit="contain"
              cachePolicy="none"
              onLoad={onLoad}
              onError={onError}
              style={styles.image}
              accessibilityLabel="Chat photo"
            />
          ) : null}
          {loading ? <ActivityIndicator color="#fff" size="large" style={styles.spinner} /> : null}
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    minHeight: 64,
    gap: spacing.sm,
  },
  text: { color: '#fff', flex: 1 },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1 },
  image: { width: '100%', height: '100%' },
  spinner: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
});
