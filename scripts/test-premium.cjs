const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, mocks) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${source}\n})`, {}, { filename: file })(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports,
  );
  return module.exports;
}

function renderImage(locked, uri = 'https://cdn.test/previews/blur.jpg') {
  const pressed = [], navigation = [];
  const h = React.createElement;
  const { PostImage } = load('src/components/ui/PostImage.tsx', {
    '@/theme': { spacing: load('src/theme/spacing.ts', {}).spacing },
    '@/components/ui/Pressable': {
      Pressable: ({ children, onPress, accessibilityLabel }) => {
        pressed.push(onPress); return h('button', { 'aria-label': accessibilityLabel }, children);
      },
    },
    'react-native': {
      View: ({ children }) => h('div', null, children),
      Pressable: ({ children, onPress, accessibilityLabel }) => {
        pressed.push(onPress); return h('button', { 'aria-label': accessibilityLabel }, children);
      },
      StyleSheet: { absoluteFill: {}, create: styles => styles },
    },
    'expo-image': { Image: props => h('img', { alt: props.accessibilityLabel,
      'data-url': props.source?.uri, 'data-cache-key': props.source?.cacheKey,
      'data-placeholder': props.placeholder?.blurhash, 'data-recycling-key': props.recyclingKey }) },
    '@expo/vector-icons': { Ionicons: ({ name }) => h('span', { 'data-icon': name }) },
    'expo-router': { useRouter: () => ({ push: route => navigation.push(route) }) },
    '@/theme/useTheme': { useTheme: () => ({ theme: { colors: { surfaceElevated: 'black' } } }) },
    './Text': { Text: ({ children }) => h('span', null, children) },
  });
  const markup = renderToStaticMarkup(h(PostImage, {
    image: { id: 'image-1', uri, blurhash: '00TI:j', width: 1080, height: 720 }, locked, width: 320, height: 240,
  }));
  return { markup, pressed, navigation };
}

test('locked PostImage uses the API preview unchanged, shows lock/CTA and opens subscription screen', () => {
  const { markup, pressed, navigation } = renderImage(true);
  assert.match(markup, /https:\/\/cdn.test\/previews\/blur.jpg/);
  assert.match(markup, /Subscribe to view/);
  assert.match(markup, /lock-closed/);
  assert.match(markup, /data-placeholder="00TI:j"/);
  assert.match(markup, /data-cache-key="image-1:locked"/);
  assert.doesNotMatch(markup, /original|fullscreen|save|share|zoom/i);
  assert.equal(pressed.length, 1); pressed[0]();
  assert.deepEqual(navigation, ['/subscribe']);
});

test('unlocked PostImage has no lock action and caches by identity rather than changing URL signatures', () => {
  const first = renderImage(false, 'https://s3.test/original.jpg?signature=first');
  const second = renderImage(false, 'https://s3.test/original.jpg?signature=second');
  assert.doesNotMatch(first.markup, /Subscribe to view|lock-closed/);
  assert.equal(first.pressed.length, 0);
  for (const result of [first, second]) {
    assert.match(result.markup, /data-cache-key="image-1:unlocked"/);
    assert.match(result.markup, /data-recycling-key="image-1:unlocked"/);
  }
});

test('entitlement transitions clear stale post images across feed, post, profile and bookmark caches', async () => {
  const calls = [];
  const client = { cancelQueries: async ({ queryKey }) => calls.push(['cancel', queryKey[0]]),
    resetQueries: async ({ queryKey }) => calls.push(['reset', queryKey[0]]),
    invalidateQueries: async ({ queryKey }) => calls.push(['invalidate', queryKey[0]]) };
  const { refreshAfterSubscription } = load('src/features/subscriptions/entitlements.ts', {
    '@/features/auth/store/authStore': {}, '@/services/api/backend': {}, '@/services/queryClient': { queryClient: client },
  });
  await refreshAfterSubscription();
  for (const key of ['feed', 'posts', 'my-posts', 'user-posts', 'profiles', 'bookmarks']) {
    assert.ok(calls.some(([operation, prefix]) => operation === 'reset' && prefix === key));
  }
  assert.deepEqual(calls[calls.length - 1], ['invalidate', 'entitlements']);
});
