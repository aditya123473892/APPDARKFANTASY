import { AppState, Platform } from 'react-native';
import * as FS from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import { bytesToUtf8, utf8ToBytes } from '@noble/hashes/utils';
import {
  isSessionCurrent,
  registerSessionTeardown,
  sessionIdentity,
} from '@/features/auth/sessionRuntime';
import { useAuthStore } from '@/features/auth/store/authStore';
import { isPeerBlocked } from '@/features/safety/blockState';
import { queryClient } from '@/services/queryClient';
import { queryKeys } from '@/services/queryKeys';
import { HISTORY_PAGE } from './chatState';
import { messagePreview } from './inbox';
import type { Conversation, Message } from '../types';

/**
 * The inbox and recent messages, kept on the device so chats open instantly on the
 * next launch while the server catches up. Encrypted with AES-GCM under a per-account
 * key in SecureStore. Disappearing and view-once messages are never written, the
 * cache holds one account at a time, and an explicit logout deletes it.
 */
type Snapshot = {
  v: 1;
  owner: string;
  savedAt: number;
  conversations: Conversation[];
  messages: Record<string, Message[]>;
};

const MAX_CONVERSATIONS = 200;
/** Conversations whose recent messages are kept, newest activity first. */
const MAX_HISTORIES = 20;
const SAVE_DELAY_MS = 2000;
const objectId = /^[a-f0-9]{24}$/i;
const conversationKey = /^(user|group):[a-f0-9]{24}$/i;
const keyName = (owner: string) => `darkfantasy.chat-cache.${owner}`;
const additionalData = (owner: string) => utf8ToBytes(`${owner}:chat-cache:v1`);
const directory = () => {
  if (!FS.documentDirectory) throw new Error('Chat cache requires device storage');
  return `${FS.documentDirectory}chat-cache/`;
};
const fileFor = (owner: string) => `${directory()}${owner}.bin`;

const keys = new Map<string, AESEncryptionKey>();
/** The session generation whose saved chats were restored; saving waits for it. */
let restored = -1;
let restoring = -1;
let timer: ReturnType<typeof setTimeout> | undefined;
let writes: Promise<void> = Promise.resolve();

async function cacheKey(owner: string, create: boolean): Promise<AESEncryptionKey | null> {
  const known = keys.get(owner);
  if (known) return known;
  const saved = await SecureStore.getItemAsync(keyName(owner));
  let key: AESEncryptionKey;
  if (saved) key = await AESEncryptionKey.import(saved, 'hex');
  else if (!create) return null;
  else {
    key = await AESEncryptionKey.generate();
    await SecureStore.setItemAsync(keyName(owner), await key.encoded('hex'), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  keys.set(owner, key);
  return key;
}

const visible = (key: string) => !key.startsWith('user:') || !isPeerBlocked(key.slice(5));
const ephemeral = (message: Message) =>
  Boolean(message.expiresAt || message.viewOnce || message.viewDurationSeconds);

function snapshot(owner: string): Snapshot {
  const conversations = (queryClient.getQueryData<Conversation[]>(queryKeys.conversations) ?? [])
    .filter((item) => conversationKey.test(item.id) && visible(item.id))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, MAX_CONVERSATIONS);
  const messages: Record<string, Message[]> = {};
  const saved: Conversation[] = [];
  for (const item of conversations) {
    const rows = (queryClient.getQueryData<Message[]>(queryKeys.messages(item.id)) ?? []).filter(
      (row) => row.conversationId === item.id && !ephemeral(row) && !row.blockedSender,
    );
    if (rows.length && Object.keys(messages).length < MAX_HISTORIES)
      messages[item.id] = rows.slice(-HISTORY_PAGE);
    const latest = rows[rows.length - 1];
    // A disappearing or view-once preview is replaced by the newest durable message.
    const preview = item.lastMessage?.ephemeral
      ? latest
        ? messagePreview(latest)
        : null
      : item.lastMessage;
    saved.push({
      ...item,
      lastMessage: preview,
      previewState: item.lastMessage?.ephemeral && !preview ? 'loading' : item.previewState,
      presence: null,
      historyLoaded: undefined,
      restored: undefined,
    });
  }
  return { v: 1, owner, savedAt: Date.now(), conversations: saved, messages };
}

async function write(owner: string, scope: number, data: Snapshot): Promise<void> {
  if (restored !== scope || !isSessionCurrent(scope) || sessionIdentity.userId !== owner) return;
  const key = await cacheKey(owner, true);
  if (!key) return;
  const sealed = await aesEncryptAsync(utf8ToBytes(JSON.stringify(data)), key, {
    additionalData: additionalData(owner),
  });
  const bytes = await sealed.combined();
  if (restored !== scope || !isSessionCurrent(scope)) return;
  await FS.makeDirectoryAsync(directory(), { intermediates: true });
  const target = fileFor(owner),
    partial = `${target}.partial`;
  try {
    await new File(partial).write(bytes);
    await FS.deleteAsync(target, { idempotent: true });
    await FS.moveAsync({ from: partial, to: target });
  } finally {
    await FS.deleteAsync(partial, { idempotent: true }).catch(() => undefined);
  }
}

function save(): void {
  clearTimeout(timer);
  timer = undefined;
  const owner = sessionIdentity.userId,
    scope = sessionIdentity.generation;
  if (!owner || restored !== scope || !isSessionCurrent(scope)) return;
  const data = snapshot(owner);
  writes = writes.then(() => write(owner, scope, data)).catch(() => undefined);
}

function schedule(): void {
  if (restored !== sessionIdentity.generation || timer) return;
  timer = setTimeout(save, SAVE_DELAY_MS);
}

function parse(owner: string, value: unknown): Snapshot | null {
  const data = value as Partial<Snapshot> | null;
  if (!data || data.v !== 1 || data.owner !== owner || !Array.isArray(data.conversations))
    return null;
  const conversations = data.conversations.filter(
    (item) =>
      item &&
      typeof item.id === 'string' &&
      conversationKey.test(item.id) &&
      item.participant &&
      typeof item.participant.name === 'string',
  );
  const messages: Record<string, Message[]> = {};
  for (const [key, rows] of Object.entries(data.messages ?? {})) {
    if (!conversationKey.test(key) || !Array.isArray(rows)) continue;
    messages[key] = rows.filter(
      (row) =>
        row &&
        typeof row.id === 'string' &&
        objectId.test(row.id) &&
        row.conversationId === key &&
        typeof row.createdAt === 'string' &&
        !ephemeral(row),
    );
  }
  return { ...data, conversations, messages } as Snapshot;
}

/** Only the signed-in account's cache is kept on the device. */
async function removeOtherAccounts(owner: string): Promise<void> {
  const dir = directory();
  if (!(await FS.getInfoAsync(dir)).exists) return;
  for (const name of await FS.readDirectoryAsync(dir)) {
    const other = name.replace(/\.bin(\.partial)?$/, '');
    if (other === owner) continue;
    await FS.deleteAsync(`${dir}${name}`, { idempotent: true });
    if (objectId.test(other)) await SecureStore.deleteItemAsync(keyName(other)).catch(() => undefined);
    keys.delete(other);
  }
}

async function restore(owner: string, scope: number): Promise<void> {
  try {
    await removeOtherAccounts(owner);
    const path = fileFor(owner);
    if (!(await FS.getInfoAsync(path)).exists) return;
    const key = await cacheKey(owner, false);
    if (!key) {
      await FS.deleteAsync(path, { idempotent: true });
      return;
    }
    let data: Snapshot | null = null;
    try {
      const plain = (await aesDecryptAsync(
        AESSealedData.fromCombined(await new File(path).bytes()),
        key,
        { additionalData: additionalData(owner) },
      )) as Uint8Array;
      data = parse(owner, JSON.parse(bytesToUtf8(plain)));
    } catch {
      // Damaged or from another key: start fresh rather than show anything unverified.
      await FS.deleteAsync(path, { idempotent: true });
    }
    if (!data || !isSessionCurrent(scope) || sessionIdentity.userId !== owner) return;
    // Never replace data the server already returned this session.
    if (queryClient.getQueryData(queryKeys.conversations) === undefined)
      queryClient.setQueryData<Conversation[]>(
        queryKeys.conversations,
        data.conversations
          .filter((item) => visible(item.id))
          .map((item) => ({ ...item, restored: true })),
        // Stale from the start, so the screens refetch immediately.
        { updatedAt: data.savedAt },
      );
    for (const [key, rows] of Object.entries(data.messages))
      if (visible(key) && queryClient.getQueryData(queryKeys.messages(key)) === undefined)
        queryClient.setQueryData<Message[]>(queryKeys.messages(key), rows, {
          updatedAt: data.savedAt,
        });
  } catch {
    /* A missing cache only costs the instant first paint. */
  }
}

function restoreIfSignedIn(): void {
  const owner = sessionIdentity.userId,
    scope = sessionIdentity.generation;
  if (!owner || !isSessionCurrent(scope) || restored === scope || restoring === scope) return;
  restoring = scope;
  void restore(owner, scope).finally(() => {
    if (restoring === scope) restoring = -1;
    if (isSessionCurrent(scope) && sessionIdentity.userId === owner) restored = scope;
  });
}

/** Deletes every cached chat and its key. Called on explicit logout. */
export async function wipeChatCache(): Promise<void> {
  if (Platform.OS === 'web') return;
  restored = -1;
  clearTimeout(timer);
  timer = undefined;
  await writes;
  const dir = directory();
  if ((await FS.getInfoAsync(dir)).exists)
    for (const name of await FS.readDirectoryAsync(dir)) {
      const owner = name.replace(/\.bin(\.partial)?$/, '');
      if (objectId.test(owner)) await SecureStore.deleteItemAsync(keyName(owner)).catch(() => undefined);
    }
  await FS.deleteAsync(dir, { idempotent: true });
  keys.clear();
}

export function startChatCache(): () => void {
  if (Platform.OS === 'web') return () => undefined;
  restoreIfSignedIn();
  const auth = useAuthStore.subscribe(restoreIfSignedIn);
  const cache = queryClient.getQueryCache().subscribe((event) => {
    const [root, kind] = event.query.queryKey as unknown[];
    if (event.type === 'updated' && root === 'chat' && (kind === 'conversations' || kind === 'messages'))
      schedule();
  });
  // Write promptly when leaving the app, which may not come back to save later.
  const app = AppState.addEventListener('change', (state) => {
    if (state !== 'active' && timer) save();
  });
  const teardown = registerSessionTeardown(() => {
    clearTimeout(timer);
    timer = undefined;
    restored = -1;
  });
  return () => {
    auth();
    cache();
    app.remove();
    teardown();
    clearTimeout(timer);
  };
}
