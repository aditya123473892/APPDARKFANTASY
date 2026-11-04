const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
function load(file, modules, globals = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      require: (name) => modules[name] ?? require(name),
      Uint8Array,
      Date,
      console,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      ...globals,
    },
  );
  return exports;
}
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise(setImmediate);
};

function notificationHarness() {
  const effects = [],
    callbacks = [],
    remembered = [],
    sent = [];
  let permission = { granted: true, canAskAgain: true },
    fail = false,
    prompt,
    rotation,
    timer,
    hold;
  const identity = { generation: 1 };
  const auth = {
    currentUser: { _id: 'owner' },
    status: 'authenticated',
    session: { accessToken: 'test-token' },
  };
  let push = { status: 'checking', message: '', revision: 0 };
  const hook = (fn) => fn(push);
  hook.setState = (next) => {
    push = { ...push, ...next };
  };
  const app = {
    currentState: 'active',
    addEventListener: (name, fn) => {
      callbacks.push(fn);
      return { remove() {} };
    },
  };
  const notifications = {
    setNotificationHandler: (value) => {
      prompt = value;
    },
    addNotificationResponseReceivedListener: () => ({ remove() {} }),
    addNotificationReceivedListener: () => ({ remove() {} }),
    getLastNotificationResponseAsync: async () => null,
    addPushTokenListener: (fn) => {
      rotation = fn;
      return { remove() {} };
    },
    AndroidImportance: { HIGH: 4 },
    setNotificationChannelAsync: async () => {},
    getPermissionsAsync: async () => permission,
    requestPermissionsAsync: async () => permission,
    getExpoPushTokenAsync: async () => {
      if (hold) await hold;
      return { data: 'ExponentPushToken[test-device-token]' };
    },
  };
  const lifecycle = load(
    'src/features/activity/useNotificationLifecycle.ts',
    {
      react: {
        useEffect: (fn) => effects.push(fn),
        useState: (initial) => [initial, () => {}],
        useRef: (initial) => ({ current: initial }),
      },
      'react-native': { AppState: app, Platform: { OS: 'android' } },
      'expo-constants': { executionEnvironment: 'standalone', easConfig: { projectId: 'project' } },
      'expo-router': { useRouter: () => ({ push() {} }) },
      'expo-notifications': notifications,
      '@/features/auth/store/authStore': { useAuthStore: (selector) => selector(auth) },
      '@/features/auth/sessionRuntime': { sessionIdentity: identity },
      '@/services/api/apiClient': {
        apiClient: {
          put: async (url, body) => {
            if (fail) throw new Error('offline');
            sent.push(body);
          },
        },
      },
      '@/services/queryClient': { queryClient: { invalidateQueries: async () => {} } },
      '@/features/chat/services/socketSession': { connectSocket: async () => {} },
      './pushRegistration': { rememberPushToken: (token) => remembered.push(token) },
      './pushStatus': { usePushStatus: hook },
      './notificationTarget': { notificationTarget() {} },
      '@/services/externalActivity': { whileExternal: (work) => work() },
    },
    {
      setInterval: (fn) => {
        timer = fn;
        return 1;
      },
      clearInterval() {},
    },
  );
  lifecycle.useNotificationLifecycle(true);
  const cleanups = effects.map((fn) => fn());
  return {
    sent,
    remembered,
    notifications,
    identity,
    get push() {
      return push;
    },
    setPermission: (value) => {
      permission = value;
    },
    setFailure: (value) => {
      fail = value;
    },
    hold: (value) => {
      hold = value;
    },
    rotate: () => rotation(),
    refresh: () => timer(),
    resume: () => callbacks.forEach((fn) => fn('active')),
    handler: () => prompt,
    cleanup: () => cleanups.forEach((fn) => fn?.()),
  };
}

test('notifications register, show foreground alerts and recheck permission after phone settings change', async () => {
  const h = notificationHarness();
  try {
    await settle();
    assert.equal(h.sent.length, 1);
    assert.equal(h.push.status, 'ready');
    const alert = await h.handler().handleNotification();
    assert.equal(alert.shouldPlaySound, true);
    assert.equal(alert.shouldShowBanner, true);
    h.setPermission({ granted: false, canAskAgain: false });
    h.resume();
    await settle();
    assert.equal(h.push.status, 'denied');
    h.setPermission({ granted: true, canAskAgain: false });
    h.resume();
    await settle();
    assert.equal(h.push.status, 'ready');
    assert.equal(h.sent.length, 2);
  } finally {
    h.cleanup();
  }
});

test('notification registration retries failures, handles token rotation during registration and ignores stale sessions', async () => {
  const h = notificationHarness();
  try {
    h.setFailure(true);
    await settle();
    assert.equal(h.push.status, 'error');
    assert.equal(h.remembered.length, 0);
    h.setFailure(false);
    h.refresh();
    await settle();
    assert.equal(h.push.status, 'ready');
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    h.hold(held);
    h.rotate();
    await settle();
    h.rotate();
    h.hold(null);
    release();
    await settle();
    assert.equal(h.sent.length, 3, 'rotation while registering schedules a second registration');
    h.hold(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    h.rotate();
    await settle();
    h.identity.generation++;
    release();
    await settle();
    assert.equal(
      h.sent.length,
      3,
      'an old account must never register a token against a new session',
    );
  } finally {
    h.cleanup();
  }
});

function lockHarness() {
  const values = new Map();
  let cancel = false,
    derivations = 0,
    checks = 0,
    biometricPrompts = 0;
  const service = load('src/features/app-lock/service.ts', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-secure-store': {
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
      canUseBiometricAuthentication: () => true,
      getItemAsync: async (key, options) => {
        if (options?.requireAuthentication) {
          biometricPrompts++;
          if (cancel) throw new Error('cancelled');
        }
        return values.get(key) ?? null;
      },
      setItemAsync: async (key, value, options) => {
        if (options?.requireAuthentication) {
          biometricPrompts++;
          if (cancel) throw new Error('cancelled');
        }
        values.set(key, value);
      },
      deleteItemAsync: async (key) => values.delete(key),
    },
    'expo-local-authentication': {
      hasHardwareAsync: async () => true,
      isEnrolledAsync: async () => true,
    },
    'expo-crypto': { getRandomBytes: (length) => crypto.randomBytes(length) },
    '@/services/externalActivity': { whileExternal: (work) => work() },
    './credentials': {
      createCredential: async (pin) => {
        derivations++;
        return { testPin: pin };
      },
      checkCredential: async (pin, stored) => {
        checks++;
        return pin === stored.testPin;
      },
    },
  });
  return {
    service,
    values,
    cancel: (value) => {
      cancel = value;
    },
    counts: () => ({ derivations, checks, biometricPrompts }),
  };
}
test('App Lock setup saves PIN and biometrics once, preserves biometrics on PIN change and authorizes settings with biometrics', async () => {
  const h = lockHarness(),
    owner = '507f1f77bcf86cd799439011';
  const enabled = await h.service.setAppPin(owner, '123456', undefined, true);
  assert.equal(enabled.biometric, true);
  assert.deepEqual(h.counts(), { derivations: 1, checks: 0, biometricPrompts: 1 });
  await h.service.setAppPin(owner, '654321', '123456');
  assert.equal((await h.service.readAppLock(owner)).biometricHash, enabled.biometricHash);
  const changed = await h.service.changeLockSettings(owner, null, { timeout: 30_000 });
  assert.equal(changed.timeout, 30_000);
  assert.equal(h.counts().checks, 1, 'a biometric change does not require another PIN derivation');
  await assert.rejects(
    h.service.changeLockSettings(owner, '000000', { disable: true }),
    /Incorrect/,
  );
  assert.ok(await h.service.readAppLock(owner));
  await h.service.changeLockSettings(owner, null, { disable: true });
  assert.equal(await h.service.readAppLock(owner), null);
});

test('cancelled biometric setup leaves App Lock off and lets the member enable PIN only', async () => {
  const h = lockHarness(),
    owner = '507f1f77bcf86cd799439011';
  h.cancel(true);
  await assert.rejects(h.service.setAppPin(owner, '123456', undefined, true), /cancelled/);
  assert.equal(await h.service.readAppLock(owner), null);
  h.cancel(false);
  await h.service.setAppPin(owner, '123456');
  await assert.rejects(h.service.changeLockSettings(owner, null, { disable: true }), /PIN/);
  assert.equal((await h.service.verifyAppPin(owner, '123456')).biometric, false);
});

test('App Lock settings show setup once and only ask for PIN fields when changing security', async () => {
  const slots = [],
    effects = [],
    writes = [];
  let slot = 0;
  let lock = { config: null };
  const auth = { session: { userId: '507f1f77bcf86cd799439011' } };
  const authHook = (fn) => fn(auth);
  authHook.getState = () => auth;
  const lockHook = (fn) => fn(lock);
  lockHook.setState = (update) => {
    lock = { ...lock, ...(typeof update === 'function' ? update(lock) : update) };
  };
  const state = (initial) => {
    const key = slot++;
    if (!(key in slots)) slots[key] = initial;
    return [
      slots[key],
      (next) => {
        slots[key] = typeof next === 'function' ? next(slots[key]) : next;
      },
    ];
  };
  const screen = load('src/features/app-lock/AppLockSettingsScreen.tsx', {
    react: {
      useState: state,
      useEffect: (fn) => effects.push(fn),
      useRef: (initial) => {
        const [value] = state({ current: initial });
        return value;
      },
    },
    'react-native': {
      AppState: { addEventListener: () => ({ remove() {} }) },
      Platform: { OS: 'android' },
      View: 'View',
    },
    '@/components/layout': { Header: 'Header', Screen: 'Screen' },
    '@/components/ui': { Text: 'Text', Button: 'Button', TextField: 'TextField' },
    '@/components/ui/Toast': { toast: { success() {} } },
    '@/features/settings/components/SettingsRow': { SettingsGroup: 'Group', SettingsRow: 'Row' },
    '@/features/auth/store/authStore': { useAuthStore: authHook },
    '@/features/auth/sessionRuntime': { sessionIdentity: { generation: 1 } },
    '@/theme': { spacing: {} },
    './state': { useAppLock: lockHook },
    './credentials': { APP_PIN: /^\d{4,12}$/ },
    './service': {
      biometricAvailability: async () => true,
      LOCK_TIMEOUTS: [0, 30000, 60000, 300000],
      changeLockSettings: async (owner, proof, change) => {
        writes.push({ proof, change });
        return { ...lock.config, ...change };
      },
    },
  });
  const elements = (node) =>
    !node
      ? []
      : Array.isArray(node)
        ? node.flatMap(elements)
        : typeof node === 'object'
          ? [node, ...elements(node.props?.children)]
          : [];
  const render = () => {
    slot = 0;
    return elements(screen.AppLockSettingsScreen());
  };
  let nodes = render();
  effects.splice(0).forEach((fn) => fn());
  await settle();
  assert.equal(nodes.filter((n) => n.type === 'TextField').length, 2);
  lock.config = { biometric: true, timeout: 0 };
  nodes = render();
  assert.equal(nodes.filter((n) => n.type === 'TextField').length, 0);
  nodes.find((n) => n.props?.title === 'Change backup PIN').props.onPress();
  nodes = render();
  assert.equal(nodes.filter((n) => n.type === 'TextField').length, 3);
  nodes.find((n) => n.props?.label === 'Cancel').props.onPress();
  nodes = render();
  assert.equal(nodes.filter((n) => n.type === 'TextField').length, 0);
  nodes.find((n) => n.props?.title === 'Fingerprint or Face ID').props.onValueChange(false);
  await settle();
  nodes = render();
  assert.equal(
    writes[0].proof,
    null,
    'existing biometrics authorize a change without typing the PIN',
  );
  assert.equal(lock.config.biometric, false);
  nodes.find((n) => n.props?.label === 'Turn off App Lock').props.onPress();
  nodes = render();
  assert.equal(nodes.filter((n) => n.type === 'TextField').length, 1);
  assert.equal(writes.length, 1, 'turning off the lock requires confirmation and fresh proof');
});
