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
    '@/features/auth/sessionRuntime': {sessionIdentity:{generation:1,userId:'me'}},
    '@/features/feed/presentation': {usePostPresentation:{getState:()=>({saved:{}}),setState(){}},mediaPreviews:new Map(),previewKey:m=>m?.id||m?.uri||''},
    '@/features/feed/services/feedService.real': {},
  });
  await refreshAfterSubscription();
  for (const key of ['feed', 'posts', 'my-posts', 'user-posts', 'profiles', 'bookmarks']) {
    assert.ok(calls.some(([operation, prefix]) => operation === 'reset' && prefix === key));
  }
  assert.deepEqual(calls[calls.length - 1], ['invalidate', 'entitlements']);
});

function savedHarness(saved, getPost) {
  let state={saved};
  const runtime={sessionIdentity:{generation:1,userId:'me'}};
  const store={getState:()=>state,setState:update=>{state={...state,...(typeof update==='function'?update(state):update)};}};
  const previews=new Map();
  const client={cancelQueries:async()=>{},resetQueries:async()=>{}};
  const service=load('src/features/subscriptions/entitlements.ts',{
    '@/features/auth/store/authStore':{},'@/services/api/backend':{},'@/services/queryClient':{queryClient:client},
    '@/features/auth/sessionRuntime':runtime,
    '@/features/feed/presentation':{usePostPresentation:store,mediaPreviews:previews,previewKey:m=>m?.id||m?.uri||''},
    '@/features/feed/services/feedService.real':{getPost},
  });
  return {service,store,runtime,previews,client};
}

test('saved premium originals are cleared before revalidation, including offline expiry; own and normal posts remain', async () => {
  const premium={id:'premium',user:{id:'author'},contentVisibility:'premium',locked:false,
    media:[{id:'photo',uri:'https://original.test/photo.jpg',thumbnailUri:'https://original.test/thumb.jpg',blurhash:'00TI:j'}]};
  const normal={...premium,id:'normal',contentVisibility:'normal'};
  const own={...premium,id:'own',user:{id:'me'}};
  let resolve;
  const h=savedHarness({premium,normal,own},()=>new Promise(r=>{resolve=r;}));
  h.previews.set(premium.media[0].id,{thumbnail:'clear-frame'});
  const task=h.service.refreshPostImages(h.client);
  const safe=h.store.getState().saved.premium;
  assert.equal(safe.locked,true);assert.equal(safe.media[0].uri,'');assert.equal(safe.media[0].thumbnailUri,undefined);
  assert.equal(h.previews.size,0);assert.equal(h.store.getState().saved.normal,normal);assert.equal(h.store.getState().saved.own,own);
  resolve({...premium,locked:true,media:[{...premium.media[0],uri:'https://preview.test/blurred.jpg',thumbnailUri:undefined,locked:true}]});
  await task;
  assert.equal(h.store.getState().saved.premium.media[0].uri,'https://preview.test/blurred.jpg');
  const offline=savedHarness({premium},async()=>{throw new Error('offline');});
  await offline.service.refreshPostImages(offline.client);
  assert.equal(offline.store.getState().saved.premium.locked,true);
  assert.equal(offline.store.getState().saved.premium.media[0].uri,'');
});

test('saved premium refreshes are bounded and cannot restore posts after removal or account switch', async () => {
  const post=id=>({id,user:{id:'author'},contentVisibility:'premium',locked:false,media:[{id,uri:'original:'+id}]});
  const pending=new Map();let active=0,peak=0;
  const h=savedHarness(Object.fromEntries(['a','b','c'].map(id=>[id,post(id)])),id=>{
    active++;peak=Math.max(active,peak);
    return new Promise(resolve=>pending.set(id,()=>{active--;resolve({...post(id),locked:true,media:[]});}));
  });
  const task=h.service.refreshPostImages(h.client);
  assert.equal(pending.size,2);
  const saved={...h.store.getState().saved};delete saved.a;h.store.setState({saved});
  pending.get('a')();pending.get('b')();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.store.getState().saved.a,undefined);
  h.runtime.sessionIdentity.generation++;h.store.setState({saved:{}});
  pending.get('c')();await task;
  assert.equal(Object.keys(h.store.getState().saved).length,0);assert.equal(peak,2);
});
