const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the app wrapper AND the installed controller's layout code. Native
// keyboard height and native view position are independent of RN screenY/measureInWindow.
async function nativeLayout({
  y = 96,
  height = 704,
  keyboardHeight = 0,
  measurementFails = false,
} = {}) {
  const hooks = [];
  let cursor = 0;
  let bounds = { y, height };
  const keyboard = {
    heightWhenOpened: { value: keyboardHeight },
    height: { value: keyboardHeight },
    progress: { value: keyboardHeight ? 1 : 0 },
    isClosed: { value: !keyboardHeight },
  };
  const shared = (value) => (hooks[cursor++] ??= { value });
  const react = {
    forwardRef: (render) => (props) => render(props, null),
    useRef(initial) {
      const index = cursor++;
      return (hooks[index] ??= { current: initial });
    },
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
  };
  const mocks = {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native': { View: 'View', StyleSheet: { create: (styles) => styles } },
    'react-native-reanimated': {
      __esModule: true,
      default: { View: 'AnimatedView' },
      useSharedValue: shared,
      runOnUI: (fn) => fn,
      interpolate: (value, [from, to], [start, end]) =>
        start + ((value - from) * (end - start)) / (to - from),
    },
    '../../bindings': {
      KeyboardControllerNative: {
        viewPositionInWindow: async () => {
          if (measurementFails) throw new Error('View not mounted in native window yet');
          return { x: 0, y: bounds.y };
        },
      },
    },
    '../../hooks': { useWindowDimensions: () => ({ height: 800, width: 400 }) },
    '../../reanimated': {
      useAnimatedStyle: (fn) => fn(),
      useDerivedValue: (fn) => ({
        get value() {
          return fn();
        },
      }),
    },
    '../../utils/findNodeHandle': { findNodeHandle: () => 42 },
    '../hooks/useCombinedRef': { __esModule: true, default: (ref) => ref },
    './hooks': {
      useKeyboardAnimation: () => keyboard,
      useTranslateAnimation: () => ({ translate: { value: 0 }, padding: { value: 0 } }),
    },
  };
  function load(file) {
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    const module = { exports: {} };
    vm.runInNewContext(`(function(require,module,exports){${code}\n})`)(
      (name) => {
        assert.ok(mocks[name], `Unexpected import: ${name}`);
        return mocks[name];
      },
      module,
      module.exports,
    );
    return module.exports;
  }
  const NativeView = load(
    'node_modules/react-native-keyboard-controller/src/components/KeyboardAvoidingView/index.tsx',
  ).default;
  mocks['react-native-keyboard-controller'] = { KeyboardAvoidingView: NativeView };
  const { KeyboardAvoidingScreen } = load('src/components/layout/KeyboardAvoidingScreen.tsx');
  const render = () => {
    cursor = 0;
    const wrapper = KeyboardAvoidingScreen({ children: 'message list and composer' });
    return wrapper.type(wrapper.props);
  };
  async function measure() {
    const tree = render();
    tree.props.ref.current = {};
    // onLayout intentionally reports parent-local y=0, as it does below chat headers.
    await tree.props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: bounds.height } },
    });
  }
  await measure();
  return {
    open(nextHeight, progress = 1) {
      keyboard.heightWhenOpened.value = nextHeight;
      keyboard.height.value = nextHeight * progress;
      keyboard.progress.value = progress;
      keyboard.isClosed.value = !nextHeight;
    },
    async resize(next) {
      bounds = next;
      await measure();
    },
    padding() {
      return Object.assign({}, ...render().props.style.flat(Infinity)).paddingBottom;
    },
    composerBottom() {
      return bounds.y + bounds.height - this.padding();
    },
  };
}

test('the controller version matches the native module bundled in Expo Go', () => {
  const native = require('expo/bundledNativeModules.json')['react-native-keyboard-controller'];
  const installed = JSON.parse(
    fs.readFileSync('node_modules/react-native-keyboard-controller/package.json', 'utf8'),
  ).version;
  assert.equal(installed, native);
});

test('Android overlay keyboards move the composer using native height without RN keyboard events', async () => {
  const screen = await nativeLayout();
  screen.open(320);
  assert.equal(screen.composerBottom(), 480);
});

test('safe areas and headers use native screen coordinates instead of parent-local positions', async () => {
  const screen = await nativeLayout({ y: 144, height: 632 });
  screen.open(320);
  assert.equal(screen.composerBottom(), 480);
});

test('God chat stays above the keyboard when its tab bar disappears', async () => {
  const screen = await nativeLayout({ y: 96, height: 624 });
  screen.open(320);
  assert.equal(screen.composerBottom(), 480);
  await screen.resize({ y: 96, height: 704 });
  assert.equal(screen.composerBottom(), 480);
});

test('a taller emoji panel moves the composer higher and hiding restores its position', async () => {
  const screen = await nativeLayout();
  screen.open(320);
  screen.open(420);
  assert.equal(screen.composerBottom(), 380);
  screen.open(0);
  assert.equal(screen.padding(), 0);
});

test('keyboard opening animation moves the composer before the didShow event', async () => {
  const screen = await nativeLayout();
  screen.open(320, 0.5);
  assert.equal(screen.padding(), 160);
  screen.open(320, 1);
  assert.equal(screen.composerBottom(), 480);
});

test('opening a conversation while the keyboard is already visible reserves its space', async () => {
  const screen = await nativeLayout({ keyboardHeight: 320 });
  assert.equal(screen.composerBottom(), 480);
});

test('chat avoidance includes the safe area and header, starting at the route origin', () => {
  for (const [file, component] of [
    ['src/features/chat/screens/ChatRoomScreen.tsx', 'ChatRoomScreen'],
    ['src/features/god-chat/screens/GodChatScreen.tsx', 'GodChatScreen'],
  ]) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const screen = source.statements.find(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === component,
    );
    const mainReturn = screen.body.statements.filter(ts.isReturnStatement).at(-1);
    const root = mainReturn.expression.expression;
    assert.equal(root.openingElement.tagName.getText(source), 'KeyboardAvoidingScreen', file);
    const content = root.children.find(ts.isJsxElement);
    assert.equal(content.openingElement.tagName.getText(source), 'Screen', file);
  }
});

test('a failed native measurement cannot leave the chat composer behind the keyboard', async () => {
  // Native measurement can reject during navigation. The installed controller
  // then uses parent-local y=0. At the route root that is also the true window y.
  const screen = await nativeLayout({ y: 0, height: 800, measurementFails: true });
  screen.open(320);
  assert.equal(screen.composerBottom(), 480);
  screen.open(420);
  assert.equal(screen.composerBottom(), 380);
  screen.open(0);
  assert.equal(screen.composerBottom(), 800);
});

test('God chat survives tab-bar layout changes even when native measurement fails', async () => {
  const screen = await nativeLayout({ y: 0, height: 720, measurementFails: true });
  screen.open(320);
  assert.equal(screen.composerBottom(), 480);
  await screen.resize({ y: 0, height: 800 });
  assert.equal(screen.composerBottom(), 480);
});
