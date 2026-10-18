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
  // Deliberately do not mock a native crypto module: checksum tests run the real JS library.
  'expo-modules-core': { uuid: { v4: require('node:crypto').randomUUID } },
});
module.exports = { load };

test('hashing works without ExpoCrypto and UUIDs use the existing Expo core', async () => {
  const bytes = Buffer.from('private photo pixels');
  assert.equal(
    await crypto.hash(bytes),
    require('node:crypto').createHash('sha256').update(bytes).digest('hex'),
  );
  assert.notEqual(await crypto.hash(bytes), await crypto.hash(Buffer.from('corrupted photo')));
  assert.match(crypto.uuid(), /^[0-9a-f-]{36}$/);
  assert.notEqual(crypto.uuid(), crypto.uuid());
  for (const size of [0, 55, 56, 64, 65, 1024 * 1024]) {
    const input = require('node:crypto').randomBytes(size);
    assert.equal(
      await crypto.hash(input),
      require('node:crypto').createHash('sha256').update(input).digest('hex'),
    );
  }
});

test('simpler storage is separate; logout counts unsynced photos left by the encrypted build', async () => {
  let legacyClosed = false;
  const current = {
    execAsync: async () => {},
    runAsync: async () => {},
    getFirstAsync: async () => ({ count: 2 }),
  };
  const repository = load('src/features/vault/repository.ts', {
    'expo-file-system/legacy': {
      documentDirectory: 'file:///private/files/',
      makeDirectoryAsync: async () => {},
      getInfoAsync: async () => ({ exists: true }),
    },
    'expo-sqlite': {
      openDatabaseAsync: async (name, options, dir) => {
        if (dir.endsWith('/simple/')) return current;
        assert.equal(options.useNewConnection, true);
        return {
          getFirstAsync: async () => ({ count: 3 }),
          closeAsync: async () => {
            legacyClosed = true;
          },
        };
      },
    },
  });
  const owner = '0123456789abcdef01234567';
  assert.equal(repository.directory(owner), `file:///private/files/vault/${owner}/simple/`);
  assert.throws(() => repository.directory('../other'));
  assert.equal(await repository.unsynced(owner), 5);
  assert.equal(legacyClosed, true);
});

test('damaged local photos are rejected before a viewing copy is written', async () => {
  let written = false;
  const service = load('src/features/vault/vaultService.ts', {
    'expo-file-system/legacy': {},
    'expo-secure-store': {},
    'expo-image-picker': {},
    'expo-image-manipulator': {},
    '@/features/auth/sessionRuntime': {},
    './repository': {
      get: async () => ({
        localPath: 'sandbox.jpg',
        size: 3,
        sha256: await crypto.hash(Buffer.from('abc')),
      }),
    },
    './files': {
      plaintext: async () => Buffer.from('bad'),
      temporaryFile: async () => {
        written = true;
      },
    },
    './crypto': crypto,
    './lock': { assertUnlocked: () => 0, assertEpoch() {} },
  });
  await assert.rejects(service.viewPhoto('owner', 'photo'), /damaged/);
  assert.equal(written, false);
});

test('sandbox JPEGs persist after temp cleanup, reject other-account paths and wipe on logout', async () => {
  const disk = new Map();
  const owner = '0123456789abcdef01234567',
    id = '12345678-1234-4234-8234-123456789abc';
  const files = load('src/features/vault/files.ts', {
    'expo-file-system/legacy': {
      cacheDirectory: 'file:///private/cache/',
      getFreeDiskStorageAsync: async () => 100_000_000,
      makeDirectoryAsync: async () => {},
      moveAsync: async ({ from, to }) => {
        disk.set(to, disk.get(from));
        disk.delete(from);
      },
      deleteAsync: async (p) => {
        for (const key of disk.keys()) if (key.startsWith(p)) disk.delete(key);
      },
    },
    'expo-file-system': {
      File: class {
        constructor(uri) {
          this.uri = uri;
        }
        write(bytes) {
          disk.set(this.uri, Buffer.from(bytes));
        }
        async bytes() {
          return new Uint8Array(disk.get(this.uri));
        }
      },
    },
    'expo-secure-store': { deleteItemAsync: async () => {} },
    './crypto': crypto,
    './repository': {
      directory: (o) => `file:///private/files/vault/${o}/simple/`,
      close: async () => {},
    },
  });
  const bytes = Buffer.from('JPEG bytes');
  const path = await files.store(owner, id, bytes);
  assert.equal(disk.size, 1);
  assert.ok(path.endsWith('.jpg'));
  assert.deepEqual(disk.get(path), bytes);
  assert.deepEqual(Buffer.from(await files.plaintext(owner, id, path)), bytes);
  await assert.rejects(files.plaintext('different-account', id, path), /Invalid vault path/);
  const temp = await files.temporaryFile(bytes);
  await files.removeTemp(path);
  await files.removeTemp(temp);
  await files.clearTemps();
  assert.equal(disk.size, 1);
  await files.wipe(owner);
  assert.equal(disk.size, 0);
});

test('device-auth lockout persists across restarts and no screen lock cannot bypass authentication', async () => {
  const settings = new Map();
  let state,
    succeed = false,
    enrolled = 1;
  const modules = {
    'react-native': {
      AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
    },
    zustand: {
      create: (init) => {
        state = init();
        return {
          getState: () => state,
          setState: (update) => {
            state = { ...state, ...(typeof update === 'function' ? update(state) : update) };
          },
        };
      },
    },
    'expo-local-authentication': {
      SecurityLevel: { NONE: 0 },
      getEnrolledLevelAsync: async () => enrolled,
      authenticateAsync: async () =>
        succeed ? { success: true } : { success: false, error: 'authentication_failed' },
    },
    './files': { clearTemps: async () => {} },
    './repository': {
      setting: async (o, k) => settings.get(k),
      setSetting: async (o, k, v) => settings.set(k, v),
    },
  };
  let lock = load('src/features/vault/lock.ts', modules);
  for (let i = 0; i < 5; i++) await assert.rejects(lock.unlock('owner'));
  lock = load('src/features/vault/lock.ts', modules);
  await assert.rejects(lock.unlock('owner'), /Too many attempts/);
  settings.set('lockout', '0');
  succeed = true;
  await lock.unlock('owner');
  assert.equal(state.unlocked, true);
  lock.lock();
  assert.equal(state.unlocked, false);
  enrolled = 0;
  await assert.rejects(lock.unlock('owner'), /screen lock/);
  assert.equal(state.unlocked, false);
});
test('existing Android photo selection still works with broad gallery permissions blocked', async () => {
  let picked = 0;
  const picker = load('src/features/create-post/pickMedia.ts', {
    'react-native': { Platform: { OS: 'android' }, Alert: {}, Linking: {} },
    'expo-image-picker': {
      requestMediaLibraryPermissionsAsync: async () => {
        throw Error('Broad access must not be requested');
      },
      launchImageLibraryAsync: async () => {
        picked++;
        return {
          canceled: false,
          assets: [{ uri: 'file:///cache/ImagePicker/picked.jpg', mimeType: 'image/jpeg' }],
        };
      },
    },
  });
  assert.equal((await picker.pickMedia()).length, 1);
  assert.ok(await picker.pickImage());
  assert.equal(picked, 2);
});
test('Android device-credential activity can return successfully, and normal background still relocks', async () => {
  const listeners = new Set();
  let state;
  const app = {
    currentState: 'active',
    addEventListener: (name, fn) => {
      listeners.add(fn);
      return { remove: () => listeners.delete(fn) };
    },
  };
  const lock = load('src/features/vault/lock.ts', {
    'react-native': { AppState: app },
    zustand: {
      create: (init) => {
        state = init();
        return {
          getState: () => state,
          setState: (update) => {
            state = { ...state, ...(typeof update === 'function' ? update(state) : update) };
          },
        };
      },
    },
    'expo-local-authentication': {
      SecurityLevel: { NONE: 0 },
      getEnrolledLevelAsync: async () => 1,
      authenticateAsync: async (options) => {
        assert.equal(options.disableDeviceFallback, false);
        app.currentState = 'background';
        for (const fn of listeners) fn('background');
        setTimeout(() => {
          app.currentState = 'active';
          for (const fn of listeners) fn('active');
        }, 10);
        return { success: true };
      },
    },
    'expo-secure-store': {},
    './files': { clearTemps: async () => {} },
    './crypto': crypto,
    './repository': { setting: async () => '0', setSetting: async () => {} },
  });
  await lock.unlock('owner');
  assert.equal(state.unlocked, true);
  app.currentState = 'background';
  for (const fn of listeners) fn('background');
  assert.equal(state.unlocked, false);
});
test('network sync never holds local write mutex and an in-flight patch preserves a newer offline edit', async () => {
  const { serial } = load('src/features/vault/vaultService.ts', {
    'expo-file-system/legacy': {},
    'expo-secure-store': {},
    'expo-image-picker': {},
    'expo-image-manipulator': {},
    '@/features/auth/sessionRuntime': {},
    './repository': {},
    './files': {},
    './crypto': {},
    './lock': {},
    './components/VaultPasscodePrompt': {},
  });
  let row = { id: 'photo', deletedAt: null, updatedAt: 1, hidden: 0, syncState: 'pending' };
  let release, started;
  const networkStarted = new Promise((resolve) => {
    started = resolve;
  });
  const network = new Promise((resolve) => {
    release = resolve;
  });
  const db = {
    getAllAsync: async () => [
      { id: 'photo:patch', photoId: 'photo', operation: 'patch', attempts: 0 },
    ],
    runAsync: async () => {},
  };
  const sync = load('src/features/vault/sync.ts', {
    'react-native': { AppState: { addEventListener() {} } },
    'expo-network': {},
    'expo-file-system/legacy': {},
    zustand: { create: () => ({}) },
    axios: { isAxiosError: () => false },
    '@/services/api/apiClient': {
      apiClient: {
        patch: async () => {
          started();
          await network;
          return { data: { data: { id: 'photo', hidden: 0, updatedAt: 1, deletedAt: null } } };
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
    './vaultService': { serial },
    './crypto': crypto,
    './conflicts': load('src/features/vault/conflicts.ts'),
  });
  const work = sync.processQueue('owner', () => {});
  await networkStarted;
  await Promise.race([
    serial(async () => {
      row = { ...row, hidden: 1, updatedAt: 2 };
    }),
    new Promise((resolve, reject) =>
      setTimeout(() => reject(Error('Local write blocked on network')), 500),
    ),
  ]);
  release();
  await work;
  assert.equal(row.hidden, 1);
  assert.equal(row.updatedAt, 2);
  assert.equal(row.syncState, 'pending');
});
test('Android 14 exports only after confirmation, without photo-read permission, and cleans temp files', async () => {
  let confirmed = false,
    viewed = 0;
  const gallery = [],
    deleted = [];
  const exporting = load('src/features/vault/export.ts', {
    'react-native': {
      Platform: { OS: 'android', Version: 34 },
      Alert: { alert: (title, message, buttons) => buttons[confirmed ? 1 : 0].onPress() },
    },
    'expo-media-library': {
      requestPermissionsAsync: async () => {
        throw Error('Must not request broad access');
      },
      Asset: { create: async (uri) => gallery.push(uri) },
    },
    'expo-media-library/legacy': {
      saveToLibraryAsync: async () => {
        throw Error('Unexpected legacy export');
      },
    },
    'expo-sharing': {},
    'expo-image-manipulator': {
      SaveFormat: { JPEG: 'jpeg' },
      ImageManipulator: {
        manipulate: () => ({
          renderAsync: async () => ({
            saveAsync: async () => ({ uri: 'file:///cache/ImageManipulator/clean.jpg' }),
          }),
        }),
      },
    },
    'expo-file-system/legacy': {
      cacheDirectory: 'file:///cache/',
      deleteAsync: async (uri) => deleted.push(uri),
    },
    './lock': { assertUnlocked: () => 0, assertEpoch() {} },
    './vaultService': {
      viewPhoto: async () => {
        viewed++;
        return 'file:///cache/vault-temp/view.jpg';
      },
    },
    './files': {
      read: async () => Buffer.from('jpeg'),
      temporaryFile: async () => 'file:///cache/vault-temp/export.jpg',
      removeTemp: async (uri) => deleted.push(uri),
    },
  });
  await exporting.exportPhotos('owner', ['photo']);
  assert.equal(viewed, 0);
  assert.equal(gallery.length, 0);
  confirmed = true;
  await exporting.exportPhotos('owner', ['photo']);
  assert.deepEqual(gallery, ['file:///cache/vault-temp/export.jpg']);
  assert.equal(deleted.length, 3);
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
