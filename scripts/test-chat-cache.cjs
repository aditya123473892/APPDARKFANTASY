const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { aesAdapter } = require('./test-support/crypto.cjs');

function load(file, modules = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (name) => modules[name] ?? require(name),
      Buffer,
      Uint8Array,
      JSON,
      console,
      Date,
      setTimeout,
      clearTimeout,
    },
  );
  return exports;
}
const until = async (check) => {
  for (let i = 0; i < 200 && !check(); i++) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.ok(check(), 'condition not reached');
};

const owner = '0123456789abcdef01234567';
const peer = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const other = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const direct = `user:${peer}`;
const quiet = `user:${other}`;
const file = (id) => `file:///files/chat-cache/${id}.bin`;
const message = (id, conversationId, text, extra = {}) => ({
  id: id.padStart(24, '0'),
  conversationId,
  senderId: peer,
  text,
  createdAt: `2026-11-0${id}T10:00:00.000Z`,
  status: 'sent',
  ...extra,
});

/** One device: disk and SecureStore survive app restarts; memory does not. */
function device() {
  const disk = new Map(),
    secure = new Map();
  // A path ending in "/" is a directory and covers everything inside it.
  const covers = (path, key) => key === path || (path.endsWith('/') && key.startsWith(path));
  const start = ({ user = owner, generation = 1, seed = {}, blocked = [] } = {}) => {
    const data = new Map(Object.entries(seed));
    const updatedAt = new Map();
    const listeners = {};
    const queryClient = {
      getQueryData: (key) => data.get(JSON.stringify(key)),
      setQueryData: (key, value, options) => {
        data.set(JSON.stringify(key), value);
        if (options?.updatedAt) updatedAt.set(JSON.stringify(key), options.updatedAt);
      },
      getQueryCache: () => ({ subscribe: (fn) => ((listeners.cache = fn), () => {}) }),
    };
    const cache = load('src/features/chat/services/chatCache.ts', {
      'react-native': {
        Platform: { OS: 'android' },
        AppState: { addEventListener: (_, fn) => ((listeners.app = fn), { remove() {} }) },
      },
      'expo-file-system/legacy': {
        documentDirectory: 'file:///files/',
        getInfoAsync: async (path) => ({
          exists: [...disk.keys()].some((key) => covers(path, key)),
        }),
        makeDirectoryAsync: async () => {},
        readDirectoryAsync: async (dir) =>
          [...disk.keys()].filter((key) => key.startsWith(dir)).map((key) => key.slice(dir.length)),
        deleteAsync: async (path) => {
          for (const key of [...disk.keys()]) if (covers(path, key)) disk.delete(key);
        },
        moveAsync: async ({ from, to }) => {
          disk.set(to, disk.get(from));
          disk.delete(from);
        },
      },
      'expo-file-system': {
        File: class {
          constructor(uri) {
            this.uri = uri;
          }
          async write(bytes) {
            disk.set(this.uri, Buffer.from(bytes));
          }
          async bytes() {
            return new Uint8Array(disk.get(this.uri));
          }
        },
      },
      'expo-secure-store': {
        WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
        getItemAsync: async (key) => secure.get(key) ?? null,
        setItemAsync: async (key, value) => secure.set(key, value),
        deleteItemAsync: async (key) => secure.delete(key),
      },
      'expo-crypto': aesAdapter(),
      '@/features/auth/sessionRuntime': {
        sessionIdentity: { userId: user, generation },
        isSessionCurrent: (scope) => scope === generation,
        registerSessionTeardown: () => () => {},
      },
      '@/features/auth/store/authStore': { useAuthStore: { subscribe: () => () => {} } },
      '@/features/safety/blockState': { isPeerBlocked: (id) => blocked.includes(id) },
      '@/services/queryClient': { queryClient },
      '@/services/queryKeys': {
        queryKeys: {
          conversations: ['chat', 'conversations'],
          messages: (id) => ['chat', 'messages', id],
        },
      },
      './chatState': { HISTORY_PAGE: 50 },
      './inbox': {
        messagePreview: (row) => ({ text: row.text, senderId: row.senderId, createdAt: row.createdAt }),
      },
    });
    cache.startChatCache();
    const save = () => {
      listeners.cache({ type: 'updated', query: { queryKey: ['chat', 'conversations'] } });
      listeners.app('background');
    };
    const get = (key) => data.get(JSON.stringify(key));
    const set = (key, value) => data.set(JSON.stringify(key), value);
    return { cache, save, get, set, updatedAt };
  };
  return { disk, secure, start };
}

function seedChats(app) {
  app.set(
    ['chat', 'conversations'],
    [
      {
        id: direct,
        participant: { id: peer, name: 'Peer', avatarUri: '', age: 0 },
        lastMessage: { text: 'hello there', senderId: peer, createdAt: '2026-11-01T10:00:00.000Z' },
        unreadCount: 1,
        presence: { online: true },
        historyLoaded: true,
        createdAt: '',
        updatedAt: '2026-11-03T10:00:00.000Z',
      },
      {
        id: quiet,
        participant: { id: other, name: 'Other', avatarUri: '', age: 0 },
        lastMessage: { text: 'secret preview', senderId: other, createdAt: '', ephemeral: true },
        unreadCount: 0,
        presence: null,
        createdAt: '',
        updatedAt: '2026-11-02T10:00:00.000Z',
      },
    ],
  );
  app.set(
    ['chat', 'messages', direct],
    [
      message('1', direct, 'hello there'),
      message('2', direct, 'secret vanishing', { expiresAt: '2026-11-09T10:00:00.000Z' }),
      message('3', direct, 'secret view once', { viewOnce: true }),
    ],
  );
  app.set(['chat', 'messages', quiet], [message('4', quiet, 'secret timed', { viewDurationSeconds: 10 })]);
}

test('chats restore on the next launch, encrypted at rest, without disappearing or view-once content', async () => {
  const phone = device();
  const first = phone.start();
  await new Promise((resolve) => setTimeout(resolve, 10));
  seedChats(first);
  first.save();
  await until(() => phone.disk.has(file(owner)));
  const raw = phone.disk.get(file(owner)).toString('latin1');
  assert.ok(!raw.includes('hello there') && !raw.includes('Peer'), 'the file is ciphertext');
  assert.ok(phone.secure.has(`darkfantasy.chat-cache.${owner}`));

  const next = phone.start({ generation: 2 });
  await until(() => next.get(['chat', 'conversations']));
  const conversations = next.get(['chat', 'conversations']);
  assert.deepEqual(
    Array.from(conversations, (row) => row.id),
    [direct, quiet],
  );
  assert.equal(conversations[0].restored, true);
  assert.equal(conversations[0].presence, null, 'stale presence is never shown');
  assert.equal(conversations[0].historyLoaded, undefined);
  assert.equal(conversations[1].lastMessage, null);
  assert.equal(conversations[1].previewState, 'loading');
  assert.deepEqual(
    Array.from(next.get(['chat', 'messages', direct]), (row) => row.text),
    ['hello there'],
  );
  assert.equal(next.get(['chat', 'messages', quiet]), undefined);
  const restoredJson = JSON.stringify([conversations, next.get(['chat', 'messages', direct])]);
  assert.ok(!restoredJson.includes('secret'), 'ephemeral content never reaches the device');
  assert.ok(
    next.updatedAt.get(JSON.stringify(['chat', 'conversations'])) < Date.now() + 1,
    'restored data is marked with its save time so screens refetch',
  );
});

test('restoring never replaces server data and skips peers blocked since the save', async () => {
  const phone = device();
  const first = phone.start();
  await new Promise((resolve) => setTimeout(resolve, 10));
  seedChats(first);
  first.save();
  await until(() => phone.disk.has(file(owner)));

  const fresh = [{ id: direct, participant: { name: 'Server' } }];
  const next = phone.start({
    generation: 2,
    seed: { [JSON.stringify(['chat', 'conversations'])]: fresh },
    blocked: [peer],
  });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(next.get(['chat', 'conversations']), fresh);
  assert.equal(next.get(['chat', 'messages', direct]), undefined, 'blocked peer stays hidden');
});

test('logout wipes the cache and its key; another account and a damaged file leave nothing behind', async () => {
  const phone = device();
  const first = phone.start();
  await new Promise((resolve) => setTimeout(resolve, 10));
  seedChats(first);
  first.save();
  await until(() => phone.disk.has(file(owner)));

  // A different account signing in removes the previous account's cache.
  const switched = phone.start({ user: other, generation: 2 });
  await until(() => !phone.disk.has(file(owner)));
  assert.equal(phone.secure.has(`darkfantasy.chat-cache.${owner}`), false);
  assert.equal(switched.get(['chat', 'conversations']), undefined);

  seedChats(switched);
  switched.save();
  await until(() => phone.disk.has(file(other)));
  await switched.cache.wipeChatCache();
  assert.equal(phone.disk.size, 0);
  assert.equal(phone.secure.size, 0);

  // Tampered ciphertext fails authentication and is discarded.
  const again = phone.start({ user: other, generation: 3 });
  await new Promise((resolve) => setTimeout(resolve, 10));
  seedChats(again);
  again.save();
  await until(() => phone.disk.has(file(other)));
  const bytes = phone.disk.get(file(other));
  bytes[bytes.length - 1] ^= 1;
  const damaged = phone.start({ user: other, generation: 4 });
  await until(() => !phone.disk.has(file(other)));
  assert.equal(damaged.get(['chat', 'conversations']), undefined);
});
