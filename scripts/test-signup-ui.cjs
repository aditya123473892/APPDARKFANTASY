const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const phone = require('libphonenumber-js');

function signup() {
  const slots = [];
  let cursor = 0;
  let values;
  const formState = { errors: {} };
  const sent = [];
  const reset = [];
  const navigation = [];
  const registration = {
    error: null,
    success: false,
    isLoading: false,
    emailVerificationRequired: false,
    register: async (input) => {
      sent.push({ ...input });
      if (sent.length === 1) {
        registration.error = 'Please try again.';
        return false;
      }
      registration.success = true;
      return true;
    },
  };
  const state = (initial) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [
      slots[index],
      (next) => {
        slots[index] = typeof next === 'function' ? next(slots[index]) : next;
      },
    ];
  };
  const element = (type, props) => ({ type, props });
  let schema;
  const validate = () => {
    const result = schema.safeParse(values);
    formState.errors = {};
    if (!result.success)
      for (const issue of result.error.issues)
        formState.errors[issue.path[0]] = { message: issue.message };
    return result;
  };
  const mocks = {
    react: {
      useState: state,
      useEffect() {},
      useRef: (initial) => state(() => ({ current: initial }))[0],
    },
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
    'react-native': {
      View: 'View',
      Keyboard: { dismiss() {} },
      BackHandler: {},
      useWindowDimensions: () => ({ width: 320, height: 640, fontScale: 1.6 }),
      StyleSheet: { create: (value) => value },
    },
    'expo-router': { useRouter: () => ({ replace: (route) => navigation.push(route) }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@hookform/resolvers/zod': { zodResolver: () => undefined },
    'react-hook-form': {
      Controller: 'Controller',
      useForm: (options) => {
        values ??= { ...options.defaultValues };
        return {
          control: {},
          formState,
          setFocus() {},
          setValue: (name, value) => {
            values[name] = value;
          },
          resetField: (name) => {
            reset.push(name);
            values[name] = '';
          },
          trigger: async (names) => {
            validate();
            return names.every((name) => !formState.errors[name]);
          },
          handleSubmit: (valid, invalid) => async () => {
            const result = validate();
            if (result.success) return valid(result.data);
            return invalid?.(formState.errors);
          },
        };
      },
    },
    'react-native-keyboard-controller': { KeyboardAwareScrollView: 'KeyboardAwareScrollView' },
    '@/components/layout': { Screen: 'Screen', useSafeBack: () => () => {} },
    '@/components/ui': {
      Input: 'Input',
      PasswordInput: 'PasswordInput',
      Button: 'Button',
      IconButton: 'IconButton',
      Text: 'Text',
    },
    '@/components/ui/Pressable': { Pressable: 'Pressable' },
    '@/theme': { spacing: { touch: 48, xl: 24 }, radius: {} },
    '@/theme/useTheme': { useTheme: () => ({ theme: { colors: {} } }) },
    '../hooks/useEmailRegister': { useEmailRegister: () => registration },
    './AuthScaffold': { AuthPrompt: 'AuthPrompt' },
    './CountryPicker': { CountryPicker: 'CountryPicker' },
    '../phone': {
      DEFAULT_COUNTRY: 'IN',
      toE164: (value, country) => {
        const parsed = phone.parsePhoneNumberFromString(value, country);
        return parsed?.isValid() ? parsed.number : null;
      },
    },
  };
  function load(file) {
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
    vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
      requestAnimationFrame: (fn) => fn(),
    })((name) => mocks[name] ?? require(name), module, module.exports);
    return module.exports;
  }
  const schemas = load('src/features/auth/schemas/authSchemas.ts');
  schema = schemas.emailSignupSchema;
  mocks['../schemas/authSchemas'] = schemas;
  const { RegisterForm } = load('src/features/auth/components/RegisterForm.tsx');
  const expand = (node) => {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(expand);
    if (node.type === 'Controller')
      return expand(
        node.props.render({
          field: {
            ref() {},
            value: values[node.props.name],
            onBlur() {},
            onChange: (value) => {
              values[node.props.name] = value;
            },
          },
        }),
      );
    return [node, ...expand(node.props?.children)];
  };
  const nodes = () => {
    cursor = 0;
    return expand(RegisterForm());
  };
  const find = (label) => {
    const node = nodes().find(
      (node) => node.props?.label === label || node.props?.accessibilityLabel === label,
    );
    assert.ok(node, `Missing signup control: ${label}`);
    return node;
  };
  return { nodes, find, sent, reset, navigation };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('phone signup page validates the profile before moving to account details', async () => {
  const ui = signup();
  ui.find('Continue').props.onPress();
  await flush();
  assert.equal(ui.sent.length, 0);
  assert.ok(ui.find('First name').props.error);
  assert.equal(
    ui.nodes().some((node) => node.props?.label === 'Email address'),
    false,
  );
});

test('two-step signup keeps profile values and passwords for a failed-request retry', async () => {
  const ui = signup();
  ui.find('First name').props.onChangeText('Alex');
  ui.find('Last name').props.onChangeText('Test');
  ui.find('Age').props.onChangeText('28');
  ui.find('Prefer not to say').props.onPress();
  ui.find('Continue').props.onPress();
  await flush();
  assert.ok(ui.find('Email address'));
  ui.find('Back to your details').props.onPress();
  assert.equal(ui.find('First name').props.value, 'Alex');
  ui.find('Continue').props.onPress();
  await flush();
  ui.find('Email address').props.onChangeText(' ALEX@example.test ');
  ui.find('Contact number').props.onChangeText('98765 43210');
  ui.find('Password').props.onChangeText('Private123');
  ui.find('Confirm password').props.onChangeText('Private123');
  ui.find('Create account').props.onPress();
  await flush();
  assert.equal(ui.sent[0].email, 'alex@example.test');
  assert.equal(ui.sent[0].phoneNumber, '+919876543210');
  assert.equal(ui.sent[0].name, 'Alex');
  assert.deepEqual(ui.reset, []);
  assert.equal(ui.find('Password').props.value, 'Private123');
  ui.find('Create account').props.onPress();
  await flush();
  assert.equal(ui.sent.length, 2);
  assert.deepEqual(ui.reset, ['password', 'confirmPassword']);
  ui.find('Go to sign in').props.onPress();
  assert.deepEqual(ui.navigation, ['/login']);
});
