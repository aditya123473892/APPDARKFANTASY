const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function renderer(file, extraExport = '') {
  let cursor = 0;
  const state = [];
  const element = (type, props) => ({ type, props });
  const mocks = {
    react: {
      memo: (fn) => fn,
      useEffect: () => {},
      useRef: (value) => ({ current: value }),
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
        return [state[index], (next) => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
      },
    },
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
    'react-native': { View: 'View', FlatList: 'FlatList', ScrollView: 'ScrollView', Animated: { View: 'AnimatedView', Value: class { interpolate() { return 0; } } }, StyleSheet: { create: (styles) => styles, absoluteFill: {} } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-router': { useRouter: () => ({ push() {} }) },
    'expo-video': {},
    'zustand': { create: () => ({}) },
    '@/features/auth/sessionRuntime': { registerSessionTeardown() {} },
    './Pressable': { Pressable: 'Pressable' },
    './Skeleton': { Skeleton: 'Skeleton' },
    'expo-image': { Image: 'Image' },
    '@/theme/useTheme': { useTheme: () => ({ theme: { colors: {} } }) },
    '@/theme': { spacing: {}, radius: {}, typography: { size: {} }, media: { eventRatio: 16 / 9 } },
    '@/components/ui': { Button: 'Button', FitImage: 'FitImage', Text: 'Text' },
    './PostImage': { PostImage: 'PostImage' },
    './PostMedia': { PostMedia: 'PostMedia' },
    './RemoteMedia': { RemoteMedia: 'RemoteMedia' },
  };
  function load(filename, suffix = '') {
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8') + suffix, {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const requireMock = (name) => name === '@/utils/imageLayout' ? load('src/utils/imageLayout.ts') : name === '@/features/feed/presentation' ? load('src/features/feed/presentation.ts') : mocks[name] ?? {};
    vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { requestAnimationFrame: fn => fn() })(requireMock, module, module.exports);
    return module.exports;
  }
  const exports = load(file, extraExport);
  return { exports, render: (component, props) => { cursor = 0; return component(props); } };
}
const flatten = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

test('photos use their decoded shape and never add a second blurred/filler image', () => {
  const r = renderer('src/components/ui/FitImage.tsx');
  const props = { uri: 'photo-a', style: { width: 320, height: 200, aspectRatio: 1 }, cachePolicy: 'none' };
  let tree = r.render(r.exports.FitImage, props);
  const image = tree.props.children;
  assert.equal(image.type, 'Image');
  assert.equal(image.props.contentFit, 'contain');
  assert.equal(image.props.cachePolicy, 'none');
  assert.equal(image.props.blurRadius, undefined);
  image.props.onLoad({ source: { width: 900, height: 1600 } });
  tree = r.render(r.exports.FitImage, props);
  assert.equal(flatten(tree.props.style).aspectRatio, 9 / 16);
  assert.equal(flatten(tree.props.style).height, undefined);
  // A recycled image must not inherit the previous photo's proportions.
  tree = r.render(r.exports.FitImage, { ...props, uri: 'panorama', imageWidth: 2400, imageHeight: 600 });
  assert.equal(flatten(tree.props.style).aspectRatio, 4);
});

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}

test('event cover retries with a fresh URL and distinguishes missing covers from failed images', async () => {
  const r = renderer('src/features/events/EventCover.tsx');
  let refreshes = 0;
  const props = { uri: 'expired-cover', hasCover: true, label: 'Event cover', onRetry: async () => { refreshes++; } };
  let tree = r.render(r.exports.EventCover, props);
  const original = nodes(tree).find(node => node.type === 'FitImage');
  original.props.onError();
  tree = r.render(r.exports.EventCover, props);
  assert.ok(nodes(tree).some(node => node.type === 'Text' && node.props.children === 'Cover photo unavailable'));
  await nodes(tree).find(node => node.type === 'Button').props.onPress();
  // The callback starts an asynchronous refetch before remounting the same URI.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(refreshes, 1);
  tree = r.render(r.exports.EventCover, props);
  assert.ok(nodes(tree).some(node => node.type === 'FitImage'));
  tree = r.render(r.exports.EventCover, { ...props, uri: 'fresh-signed-cover' });
  assert.equal(nodes(tree).find(node => node.type === 'FitImage').props.uri, 'fresh-signed-cover');
  tree = r.render(r.exports.EventCover, { ...props, uri: '' });
  assert.ok(nodes(tree).some(node => node.type === 'Button'));
  tree = r.render(r.exports.EventCover, { ...props, uri: '', hasCover: false });
  assert.ok(nodes(tree).some(node => node.type === 'Text' && node.props.children === 'No cover photo'));
  assert.equal(nodes(tree).some(node => node.type === 'Button'), false);
});

test('post media keeps its crop stable after decode and renders exactly one cover image', () => {
  const r = renderer('src/components/ui/PostMedia.tsx');
  const props = { media: { uri: 'photo', width: 0, height: 0 } };
  let tree = r.render(r.exports.PostMedia, props);
  assert.equal(tree.props.style.aspectRatio, 0.8);
  let images = nodes(tree).filter((node) => node.type === 'Image');
  assert.equal(images.length, 1);
  assert.equal(images[0].props.contentFit, 'cover');
  images[0].props.onLoad({ source: { width: 3000, height: 600 } });
  tree = r.render(r.exports.PostMedia, props);
  assert.equal(tree.props.style.aspectRatio, 0.8);
  assert.equal(nodes(tree).filter((node) => node.type === 'ScrollView').length, 0);
});

test('inactive and locked videos have no mounted player; only an active video mounts one', () => {
  const r = renderer('src/components/ui/PostMedia.tsx');
  const props = { media: { uri: 'clip', width: 1920, height: 1080, mimetype: 'video/mp4' } };
  const players = (tree) => nodes(tree).filter((node) => node.type?.name === 'ActiveVideo');
  assert.equal(players(r.render(r.exports.PostMedia, props)).length, 0);
  assert.equal(players(r.render(r.exports.PostMedia, { ...props, active: true })).length, 1);
  const locked = r.render(r.exports.PostMedia, { ...props, active: true, locked: true });
  assert.equal(players(locked).length, 0);
  assert.equal(nodes(locked).filter((node) => node.type === 'Image').length, 0);
  assert.equal(players(r.render(r.exports.PostMedia, props)).length, 0);
});

test('carousel preserves media order, uses measured page width and activates only its current page', () => {
  const r = renderer('src/components/ui/PostCarousel.tsx');
  const items = [
    { id: 'first', uri: 'photo-one', width: 1080, height: 1350 },
    { id: 'second', uri: 'photo-two', width: 1080, height: 1080 },
    { id: 'third', uri: 'video', mimetype: 'video/mp4', width: 1920, height: 1080 },
  ];
  const props = { items, active: true };
  let tree = r.render(r.exports.PostCarousel, props);
  tree.props.onLayout({ nativeEvent: { layout: { width: 360 } } });
  tree = r.render(r.exports.PostCarousel, props);
  let list = nodes(tree).find(node => node.type === 'FlatList');
  assert.equal(list.props.horizontal, true);
  assert.equal(list.props.pagingEnabled, true);
  assert.deepEqual(Array.from(list.props.data, item => item.id), ['first', 'second', 'third']);
  assert.equal(list.props.getItemLayout(null, 2).offset, 720);
  const mediaAt = (list, index) => nodes(list.props.renderItem({ item: items[index], index })).find(node => node.type === 'PostMedia');
  assert.equal(mediaAt(list, 0).props.ratio, 0.8);
  assert.equal(mediaAt(list, 1).props.ratio, 0.8);
  assert.equal(mediaAt(list, 0).props.active, true);
  assert.equal(mediaAt(list, 2).props.active, false);
  list.props.onScroll({ nativeEvent: { contentOffset: { x: 720 } } });
  tree = r.render(r.exports.PostCarousel, props);
  list = nodes(tree).find(node => node.type === 'FlatList');
  assert.equal(mediaAt(list, 0).props.active, false);
  assert.equal(mediaAt(list, 2).props.active, true);
  tree = r.render(r.exports.PostCarousel, { ...props, active: false });
  list = nodes(tree).find(node => node.type === 'FlatList');
  assert.equal(mediaAt(list, 2).props.active, false);
  tree = r.render(r.exports.PostCarousel, { items: [items[0]] });
  assert.equal(tree.type, 'PostMedia');
  assert.equal(nodes(tree).some(node => node.type === 'FlatList'), false);
});
