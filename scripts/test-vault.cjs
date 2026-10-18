const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, modules = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (name) => modules[name] ?? require(name),
      Buffer,
      Uint8Array,
      console,
      Date,
      Math,
      setTimeout,
      clearTimeout,
    },
  );
  return exports;
}
const crypto = load('src/features/vault/crypto.ts', {
  'react-native-quick-crypto': require('node:crypto'),
  '@craftzdog/react-native-buffer': { Buffer },
});
test('AES-GCM round trip, unique nonces, owner binding and corruption rejection', () => {
  const bytes = Buffer.from('private photo pixels'),
    key = Buffer.alloc(32, 7);
  const one = crypto.encrypt(bytes, key, 'owner:photo');
  const two = crypto.encrypt(bytes, key, 'owner:photo');
  assert.notDeepEqual(one, two);
  assert.deepEqual(Buffer.from(crypto.decrypt(one, key, 'owner:photo')), bytes);
  assert.throws(() => crypto.decrypt(one, key, 'other:photo'));
  assert.throws(() => crypto.decrypt(one, Buffer.alloc(32, 8), 'owner:photo'));
  const changed = Buffer.from(one);
  changed[changed.length - 1] ^= 1;
  assert.throws(() => crypto.decrypt(changed, key, 'owner:photo'));
  assert.throws(() => crypto.decrypt(Buffer.alloc(2), key, 'owner:photo'));
});
test('PBKDF2 uses salted credentials and rejects wrong passcodes', async () => {
  const hash = await crypto.passcodeHash('928174', 'random salt');
  assert.equal(crypto.equalHash(hash, await crypto.passcodeHash('928174', 'random salt')), true);
  assert.equal(crypto.equalHash(hash, await crypto.passcodeHash('000000', 'random salt')), false);
});
module.exports = { load };
test('existing Android photo selection still works with broad gallery permissions blocked', async () => {
  let picked = 0;
  const picker = load('src/features/create-post/pickMedia.ts', {
    'react-native': { Platform: { OS: 'android' }, Alert: {}, Linking: {} },
    'expo-image-picker': {
      requestMediaLibraryPermissionsAsync: async () => { throw Error('Broad access must not be requested'); },
      launchImageLibraryAsync: async () => { picked++; return { canceled: false, assets: [{ uri: 'file:///cache/ImagePicker/picked.jpg', mimeType: 'image/jpeg' }] }; },
    },
  });
  assert.equal((await picker.pickMedia()).length, 1);
  assert.ok(await picker.pickImage()); assert.equal(picked, 2);
});
test('Android device-credential activity can return successfully, and normal background still relocks', async () => {
  const listeners = new Set(); let state;
  const app = { currentState: 'active', addEventListener: (name, fn) => { listeners.add(fn); return { remove: () => listeners.delete(fn) }; } };
  const lock = load('src/features/vault/lock.ts', {
    'react-native': { AppState: app },
    zustand: { create: init => { state = init(); return { getState: () => state, setState: update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) }; } }; } },
    'expo-local-authentication': { SecurityLevel: { NONE: 0 }, getEnrolledLevelAsync: async () => 1, authenticateAsync: async options => {
      assert.equal(options.disableDeviceFallback, false);
      app.currentState = 'background'; for (const fn of listeners) fn('background');
      setTimeout(() => { app.currentState = 'active'; for (const fn of listeners) fn('active'); }, 10);
      return { success: true };
    } },
    'expo-secure-store': {}, './files': { clearTemps: async () => {} }, './crypto': crypto,
    './repository': { setting: async () => '0', setSetting: async () => {} },
  });
  await lock.unlock('owner'); assert.equal(state.unlocked, true);
  app.currentState = 'background'; for (const fn of listeners) fn('background');
  assert.equal(state.unlocked, false);
});
test('network sync never holds local write mutex and an in-flight patch preserves a newer offline edit', async () => {
  const { serial } = load('src/features/vault/vaultService.ts', {
    'expo-file-system/legacy': {}, 'expo-secure-store': {}, 'expo-image-picker': {}, 'expo-image-manipulator': {},
    '@/features/auth/sessionRuntime': {}, './repository': {}, './files': {}, './crypto': {}, './lock': {}, './components/VaultPasscodePrompt': {},
  });
  let row = { id: 'photo', deletedAt: null, updatedAt: 1, hidden: 0, syncState: 'pending' };
  let release, started;
  const networkStarted = new Promise(resolve => { started = resolve; });
  const network = new Promise(resolve => { release = resolve; });
  const db = { getAllAsync: async () => [{ id: 'photo:patch', photoId: 'photo', operation: 'patch', attempts: 0 }], runAsync: async () => {} };
  const sync = load('src/features/vault/sync.ts', {
    'react-native': { AppState: { addEventListener() {} } }, 'expo-network': {}, 'expo-file-system/legacy': {},
    zustand: { create: () => ({}) }, axios: { isAxiosError: () => false },
    '@/services/api/apiClient': { apiClient: { patch: async () => { started(); await network; return { data: { data: { id: 'photo', hidden: 0, updatedAt: 1, deletedAt: null } } }; } } },
    '@/services/api/backend': { unwrap: body => body.data }, '@/features/auth/sessionRuntime': { registerSessionTeardown() {} },
    './repository': { database: async () => db, get: async () => row, save: async (o, next) => { row = next; } },
    './files': {}, './lock': { refreshVault() {} }, './vaultService': { serial }, './crypto': crypto, './conflicts': load('src/features/vault/conflicts.ts'),
  });
  const work = sync.processQueue('owner', () => {}); await networkStarted;
  await Promise.race([
    serial(async () => { row = { ...row, hidden: 1, updatedAt: 2 }; }),
    new Promise((resolve, reject) => setTimeout(() => reject(Error('Local write blocked on network')), 500)),
  ]);
  release(); await work;
  assert.equal(row.hidden, 1); assert.equal(row.updatedAt, 2); assert.equal(row.syncState, 'pending');
});
test('Android 14 exports only after confirmation, without photo-read permission, and cleans temp files', async () => {
  let confirmed = false, viewed = 0; const gallery = [], deleted = [];
  const exporting = load('src/features/vault/export.ts', {
    'react-native': { Platform: { OS: 'android', Version: 34 }, Alert: { alert: (title, message, buttons) => buttons[confirmed ? 1 : 0].onPress() } },
    'expo-media-library': { requestPermissionsAsync: async () => { throw Error('Must not request broad access'); }, Asset: { create: async uri => gallery.push(uri) } },
    'expo-media-library/legacy': { saveToLibraryAsync: async () => { throw Error('Unexpected legacy export'); } },
    'expo-sharing': {},
    'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: () => ({ renderAsync: async () => ({ saveAsync: async () => ({ uri: 'file:///cache/ImageManipulator/clean.jpg' }) }) }) } },
    'expo-file-system/legacy': { cacheDirectory: 'file:///cache/', deleteAsync: async uri => deleted.push(uri) },
    './lock': { assertUnlocked: () => 0, assertEpoch() {} },
    './vaultService': { viewPhoto: async () => { viewed++; return 'file:///cache/vault-temp/view.jpg'; } },
    './files': { read: async () => Buffer.from('jpeg'), temporaryFile: async () => 'file:///cache/vault-temp/export.jpg', removeTemp: async uri => deleted.push(uri) },
  });
  await exporting.exportPhotos('owner', ['photo']); assert.equal(viewed, 0); assert.equal(gallery.length, 0);
  confirmed = true; await exporting.exportPhotos('owner', ['photo']);
  assert.deepEqual(gallery, ['file:///cache/vault-temp/export.jpg']);
  assert.equal(deleted.length, 3);
});
test('vault filesystem stores only ciphertext and the key only in SecureStore defaults; wipe clears both', async () => {
  const disk = new Map(),
    keys = new Map(),
    options = [];
  const owner = '0123456789abcdef01234567',
    id = '12345678-1234-4234-8234-123456789abc';
  const files = load('src/features/vault/files.ts', {
    'expo-file-system/legacy': {
      documentDirectory: 'file:///private/files/',
      cacheDirectory: 'file:///private/cache/',
      EncodingType: { Base64: 'base64' },
      getFreeDiskStorageAsync: async () => 100_000_000,
      readDirectoryAsync: async () => [],
      makeDirectoryAsync: async () => {},
      writeAsStringAsync: async (p, bytes) => disk.set(p, bytes),
      readAsStringAsync: async (p) => disk.get(p),
      moveAsync: async ({ from, to }) => {
        disk.set(to, disk.get(from));
        disk.delete(from);
      },
      deleteAsync: async (p) => {
        for (const key of disk.keys()) if (key.startsWith(p)) disk.delete(key);
      },
    },
    'expo-secure-store': {
      getItemAsync: async (k) => keys.get(k),
      setItemAsync: async (k, v, o) => {
        keys.set(k, v);
        options.push(o);
      },
      deleteItemAsync: async (k) => keys.delete(k),
    },
    '@craftzdog/react-native-buffer': { Buffer },
    './crypto': crypto,
    './repository': {
      directory: (o) => `file:///private/files/vault/${o}/`,
      close: async () => {},
    },
  });
  const bytes = Buffer.from('JPEG bytes with private pixels');
  const path = await files.store(owner, id, bytes);
  assert.equal(disk.size, 1);
  assert.ok(path.startsWith('file:///private/files/vault/'));
  assert.equal(Buffer.from(disk.get(path), 'base64').includes(bytes), false);
  assert.deepEqual(Buffer.from(await files.plaintext(owner, id, path)), bytes);
  assert.equal(keys.size, 1);
  assert.deepEqual(options, [undefined]);
  await files.wipe(owner);
  assert.equal(keys.size, 0);
  assert.equal(disk.size, 0);
});
test('logout stays blocked without explicit unsynced discard; confirmed discard wipes', async () => {
  let wipe = 0,
    chooseDiscard = false;
  const logout = load('src/features/vault/logout.ts', {
    'react-native': {
      Alert: { alert: (title, message, buttons) => buttons[chooseDiscard ? 1 : 0].onPress() },
    },
    './vaultService': {
      hasUnsyncedPhotos: async () => true,
      wipeVault: async () => {
        wipe++;
      },
      serial: (fn) => fn(),
    },
    './sync': { cancelVaultTransfers() {} },
    './lock': { lock() {} },
  });
  await assert.rejects(logout.beforeLogout());
  assert.equal(wipe, 0);
  chooseDiscard = true;
  await logout.beforeLogout();
  assert.equal(wipe, 1);
});
test('persistent delete jobs keep the same ID across retry and never resurrect a photo', async () => {
  let row = { id: 'photo', deletedAt: 1, updatedAt: 1, syncState: 'pending', localPath: null };
  let jobs = [{ id: 'photo:delete', photoId: 'photo', operation: 'delete', attempts: 0 }];
  let fail = true;
  const requests = [];
  const db = {
    getAllAsync: async () => jobs,
    runAsync: async (sql, ...args) => {
      if (sql.startsWith('DELETE')) jobs = [];
      if (sql.startsWith('UPDATE queue')) {
        jobs[0].attempts++;
        jobs[0].nextAttemptAt = args[0];
      }
    },
  };
  const sync = load('src/features/vault/sync.ts', {
    'react-native': { AppState: { addEventListener() {} } },
    'expo-network': {},
    'expo-file-system/legacy': {},
    zustand: { create: (init) => Object.assign(() => init(), { setState() {} }) },
    axios: { isAxiosError: () => false },
    '@/services/api/apiClient': {
      apiClient: {
        delete: async (path) => {
          requests.push(path);
          if (fail) throw Error('offline');
          return { data: { data: { deleted: true } } };
        },
      },
    },
    '@/services/api/backend': { unwrap: (body) => body.data },
    '@/features/auth/sessionRuntime': { registerSessionTeardown() {} },
    './repository': {
      database: async () => db,
      get: async () => row,
      save: async (o, next) => {
        row = next;
      },
    },
    './files': {},
    './lock': { refreshVault() {} },
    './vaultService': { serial: (fn) => fn() },
    './crypto': crypto,
    './conflicts': load('src/features/vault/conflicts.ts'),
  });
  await sync.processQueue('owner', () => {});
  assert.equal(row.syncState, 'failed');
  assert.equal(jobs[0].attempts, 1);
  assert.ok(jobs[0].nextAttemptAt > Date.now());
  fail = false;
  await sync.processQueue('owner', () => {});
  assert.equal(row.syncState, 'synced');
  assert.equal(row.deletedAt, 1);
  assert.equal(jobs.length, 0);
  assert.deepEqual(requests, ['/vault/photo', '/vault/photo']);
});
test('retry backoff is bounded and jittered; tombstones override edits', () => {
  const { retryDelay, remoteWins } = load('src/features/vault/conflicts.ts');
  assert.equal(retryDelay(0, 0), 1000);
  assert.equal(retryDelay(3, 0.5), 8500);
  assert.ok(retryDelay(999, 1) <= 3_601_000);
  const local = { updatedAt: 20, deletedAt: null, syncState: 'pending' };
  assert.equal(remoteWins(local, { updatedAt: 10, deletedAt: 1 }), true);
  assert.equal(remoteWins({ ...local, deletedAt: 1 }, { updatedAt: 100, deletedAt: null }), false);
  assert.equal(remoteWins(local, { updatedAt: 19, deletedAt: null }), false);
  assert.equal(remoteWins(local, { updatedAt: 21, deletedAt: null }), true);
});
test('app-passcode failure count and lockout survive module restart', async () => {
  const settings = new Map(),
    secrets = new Map();
  let state;
  const modules = {
    'react-native': {
      AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
    },
    zustand: {
      create: (init) => {
        const api = {
          getState: () => state,
          setState: (update) => {
            state = { ...state, ...(typeof update === 'function' ? update(state) : update) };
          },
        };
        state = init();
        return api;
      },
    },
    'expo-local-authentication': {
      SecurityLevel: { NONE: 0 },
      getEnrolledLevelAsync: async () => 0,
    },
    'expo-secure-store': {
      getItemAsync: async (k) => secrets.get(k),
      setItemAsync: async (k, v) => secrets.set(k, v),
    },
    './files': { clearTemps: async () => {} },
    './crypto': crypto,
    './repository': {
      setting: async (o, k) => settings.get(k),
      setSetting: async (o, k, v) => settings.set(k, v),
    },
  };
  let lock = load('src/features/vault/lock.ts', modules);
  await lock.configurePasscode('owner', '928174');
  for (let i = 0; i < 5; i++) await assert.rejects(lock.unlock('owner', '000000'));
  lock = load('src/features/vault/lock.ts', modules);
  await assert.rejects(lock.unlock('owner', '928174'), /Too many attempts/);
  settings.set('lockout', '0');
  await lock.unlock('owner', '928174');
  assert.equal(state.unlocked, true);
  lock.lock();
  assert.equal(state.unlocked, false);
});
