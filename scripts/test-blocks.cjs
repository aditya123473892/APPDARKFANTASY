const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { QueryClient } = require('@tanstack/react-query');

function harness() {
  const cache = new Map(),
    teardowns = [],
    calls = [],
    alerts = [],
    notices = [];
  const identity = { generation: 1 };
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const outbox = {
    items: {},
    remove(id) {
      delete this.items[id];
    },
    upsert(item) {
      this.items[item.clientId] = item;
    },
  };
  let transport = async () => ({ data: { data: {} } });
  const stubs = {
    '@/features/auth/sessionRuntime': {
      sessionIdentity: identity,
      registerSessionTeardown: (fn) => teardowns.push(fn),
      isSessionCurrent: (generation) => generation === identity.generation,
      assertSessionCurrent: (generation) => {
        if (generation !== identity.generation) throw Error('Session ended');
      },
    },
    '@/services/queryClient': { queryClient },
    '@/features/auth/userCache': { userCache: { remove: (id) => calls.push(['forget-user', id]) } },
    '@/features/chat/services/chatState': {
      forgetHistory: (id) => calls.push(['forget-history', id]),
    },
    '@/features/chat/store/outboxStore': { useOutbox: { getState: () => outbox } },
    '@/services/api/backend': {
      unwrap: (body) => body.data,
      getData: async (url, params) => transport(url, params),
    },
    '@/services/api/apiClient': {
      apiClient: {
        post: async (...args) => transport(...args),
        delete: async (...args) => transport(...args),
      },
    },
    '@/components/ui/Toast': {
      toast: { error: (value) => notices.push(value), success: (value) => notices.push(value) },
    },
    '@/services/errors': { describeError: (_error, fallback) => fallback },
    'react-native': { Alert: { alert: (...args) => alerts.push(args) } },
    '@tanstack/react-query': {
      useMutation: (options) => ({
        isPending: false,
        mutate: (variables) => {
          void mutate(variables);
        },
        mutateAsync: mutate,
      }),
    },
  };
  let options;
  stubs['@tanstack/react-query'].useMutation = (value) => {
    options = value;
    return {
      isPending: false,
      mutate: (variables) => {
        void mutate(variables);
      },
      mutateAsync: mutate,
    };
  };
  async function mutate(variables) {
    let context, error;
    try {
      context = await options.onMutate(variables);
      const data = await options.mutationFn(variables);
      options.onSuccess(data, variables, context);
    } catch (value) {
      error = value;
      options.onError(value, variables, context);
    } finally {
      options.onSettled(undefined, error, variables, context);
    }
    if (error) throw error;
  }
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    vm.runInNewContext(
      source,
      {
        module,
        exports: module.exports,
        require: (id) => {
          if (stubs[id]) return stubs[id];
          if (id.startsWith('.') || id.startsWith('@/')) {
            const base = id.startsWith('@/')
              ? path.resolve('src', id.slice(2))
              : path.resolve(path.dirname(file), id);
            return load(base + '.ts');
          }
          return require(id);
        },
        Date,
        console,
        setTimeout,
        clearTimeout,
      },
      { filename: file },
    );
    return module.exports;
  }
  const state = load('src/features/safety/blockState.ts');
  return {
    load,
    state,
    queryClient,
    outbox,
    identity,
    alerts,
    notices,
    calls,
    teardowns,
    setTransport: (fn) => {
      transport = fn;
    },
  };
}
const peer = '507f1f77bcf86cd799439012';
test('optimistic block immediately purges social lists and direct history, collapses group text, and rolls back errors', async () => {
  const h = harness(),
    q = h.queryClient;
  q.setQueryData(['profiles', 'discover'], [{ id: peer }, { id: 'other' }]);
  q.setQueryData(['feed'], {
    pages: [
      {
        posts: [
          { id: 'post', user: { id: peer } },
          { id: 'safe', user: { id: 'other' } },
        ],
      },
    ],
    pageParams: [null],
  });
  q.setQueryData(['chat', 'conversations'], [{ id: `user:${peer}` }, { id: 'group:g' }]);
  q.setQueryData(['chat', 'messages', `user:${peer}`], [{ id: 'direct', senderId: peer }]);
  q.setQueryData(
    ['chat', 'messages', 'group:g'],
    [{ id: 'group-message', conversationId: 'group:g', senderId: peer, text: 'preserved' }],
  );
  q.setQueryData(['vault', 'photos'], [{ id: 'private' }]);
  h.outbox.items.pending = {
    clientId: 'pending',
    conversationId: `user:${peer}`,
    status: 'sending',
  };
  let reject;
  h.setTransport(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const mutation = h.load('src/features/safety/useBlock.ts').useBlock();
  const result = assert.rejects(mutation.mutateAsync({ id: peer, blocked: true }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.state.isPeerBlocked(peer), true);
  assert.equal(q.getQueryData(['profiles', 'discover']).length, 1);
  assert.equal(q.getQueryData(['feed']).pages[0].posts.length, 1);
  assert.equal(q.getQueryData(['chat', 'messages', `user:${peer}`]), undefined);
  assert.equal(q.getQueryData(['chat', 'messages', 'group:g'])[0].blockedSender, true);
  assert.equal(q.getQueryData(['chat', 'messages', 'group:g'])[0].text, 'preserved');
  assert.equal(q.getQueryData(['vault', 'photos'])[0].id, 'private');
  assert.equal(h.outbox.items.pending, undefined);
  reject(Error('offline'));
  await result;
  assert.equal(h.state.isPeerBlocked(peer), false);
  assert.equal(q.getQueryData(['profiles', 'discover']).length, 2);
  assert.equal(h.outbox.items.pending.status, 'uncertain');
});
test('successful block/unblock does not retry, confirms the effect and scopes state to the session', async () => {
  const h = harness();
  let writes = 0;
  h.setTransport(async () => {
    writes++;
    return { data: { data: { blocked: true } } };
  });
  const mutation = h.load('src/features/safety/useBlock.ts').useBlock();
  mutation.confirm(peer);
  assert.match(h.alerts[0][1], /Pending requests are cancelled/);
  await mutation.mutateAsync({ id: peer, blocked: true });
  assert.equal(h.state.isPeerBlocked(peer), true);
  await mutation.mutateAsync({ id: peer, blocked: false });
  assert.equal(h.state.isPeerBlocked(peer), false);
  assert.equal(writes, 2);
  h.state.setPeerBlocked(peer, true);
  h.teardowns.forEach((fn) => fn());
  assert.equal(h.state.isPeerBlocked(peer), false);
});
test('a failed old-session mutation cannot restore social content into a new session', async () => {
  const h = harness();
  let reject;
  h.queryClient.setQueryData(['profiles', 'discover'], [{ id: peer }]);
  h.setTransport(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const mutation = h.load('src/features/safety/useBlock.ts').useBlock();
  const result = assert.rejects(mutation.mutateAsync({ id: peer, blocked: true }));
  await new Promise((resolve) => setImmediate(resolve));
  h.identity.generation++;
  h.queryClient.clear();
  h.teardowns.forEach((fn) => fn());
  reject(Error('late error'));
  await result;
  assert.equal(h.queryClient.getQueryData(['profiles', 'discover']), undefined);
  assert.equal(h.state.isPeerBlocked(peer), false);
});
test('block-list sync paginates and cannot overwrite a block made during the request', async () => {
  const h = harness();
  let resolve;
  h.setTransport(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = h.load('src/features/safety/blocks.ts').refreshBlockState();
  h.state.setPeerBlocked(peer, true);
  resolve({ blocks: [], nextCursor: null });
  await pending;
  assert.equal(h.state.isPeerBlocked(peer), true);
  const cursors = [];
  h.setTransport(async (_url, params) => {
    cursors.push(params.before);
    return params.before
      ? { blocks: [{ id: 'second' }], nextCursor: null }
      : { blocks: [{ id: peer }], nextCursor: peer };
  });
  const rows = await h.load('src/features/safety/blocks.ts').refreshBlockState();
  assert.equal(rows.length, 2);
  assert.deepEqual(cursors, [undefined, peer]);
});
