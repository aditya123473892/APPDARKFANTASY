const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');
const { validateAuthBuild } = require('./auth-build-config.cjs');

test('signup sends the backend DTO, clears passwords, and does not invent a session', async () => {
  const h = harness();
  const requests = [];
  h.apiClient.defaults.adapter = async (config) => {
    requests.push({ url: config.url, body: JSON.parse(config.data) });
    return h.ok(config, { message: 'Account created, Please check your email and verify!' });
  };
  const input = {
    name: ' Test ',
    lastName: ' User ',
    age: '25',
    gender: 'Other',
    email: ' test@example.test ',
    password: 'Private123',
  };
  assert.equal(await h.service.register(input), undefined);
  assert.deepEqual(requests, [
    {
      url: '/auth/signup',
      body: {
        username: 'test@example.test',
        password: 'Private123',
        firstName: 'Test',
        lastName: 'User',
        age: 25,
        gender: 'Other',
        roles: ['user'],
      },
    },
  ]);
  assert.equal(input.password, '');
  assert.equal(h.secure.size, 0);
  assert.equal(h.runtime.getRuntimeToken(), null);
});

test('signup distinguishes duplicate emails and network failures and clears passwords', async () => {
  for (const failure of ['EMAIL_IN_USE', 'NETWORK']) {
    const h = harness();
    h.apiClient.defaults.adapter = async (config) => {
      if (failure === 'NETWORK') throw new axios.AxiosError('offline', 'ERR_NETWORK', config);
      return {
        ...h.ok(config, null),
        data: {
          error: true,
          statusCode: 400,
          message: 'Account already exists with this email!, go to login',
        },
      };
    };
    const input = {
      name: 'Test',
      lastName: 'User',
      age: '25',
      gender: 'Other',
      email: 'test@example.test',
      password: 'Private123',
    };
    await assert.rejects(h.service.register(input), (error) => error.code === failure);
    assert.equal(input.password, '');
  }
});

test('real backend mappings preserve identities, media types, like state and conversation boundaries', () => {
  const h = harness({ 'react-native': { Platform: { OS: 'android' } } });
  const me = '111111111111111111111111';
  const other = '222222222222222222222222';
  h.runtime.setSessionIdentity(me, h.token(me));
  const { mapPost } = h.load('src/features/feed/services/feedService.real.ts');
  const post = mapPost({
    _id: '333333333333333333333333',
    user: { _id: other, displayname: 'Real author' },
    caption: 'Server caption',
    createdAt: '2026-10-14T00:00:00Z',
    visibility: 'public',
    status: 'approved',
    media: [{ url: '/uploads/video.mp4', mimetype: 'video/mp4' }],
    likes: [{ user: { _id: me } }],
    comments: [],
  });
  assert.equal(post.user.id, other);
  assert.equal(post.body, 'Server caption');
  assert.equal(post.liked, true);
  assert.equal(post.media[0].mimetype, 'video/mp4');
  assert.equal(post.media[0].uri, 'https://api.example.test/uploads/video.mp4');
  assert.equal(
    mapPost({ _id: 'p', user: other, createdAt: '2026-10-14T00:00:00Z', likes: ['like-id'] })
      .likeStateKnown,
    false,
  );
  const { mapMessage, conversationKey } = h.load('src/features/chat/services/chatService.real.ts');
  const raw = {
    _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    sender: { _id: other, displayname: 'Sender' },
    receiver: me,
    sentAt: '2026-10-14T01:00:00Z',
    message: 'From backend',
    isRead: false,
  };
  assert.equal(conversationKey(raw), `user:${other}`);
  assert.equal(mapMessage(raw, `user:${other}`).senderId, other);
  assert.equal(mapMessage(raw, `user:${other}`).status, 'sent');
  assert.equal(conversationKey({ ...raw, receiver: '444444444444444444444444' }), null);
  assert.equal(
    conversationKey({ ...raw, groupId: '555555555555555555555555' }),
    'group:555555555555555555555555',
  );
});

test('paginated real user directory never falls back to fixtures and excludes current/blocked accounts', async () => {
  const h = harness({ 'react-native': { Platform: { OS: 'android' } } });
  const me = '111111111111111111111111';
  const other = '222222222222222222222222';
  h.runtime.setSessionIdentity(me, h.token(me));
  const calls = [];
  h.apiClient.defaults.adapter = async (config) => {
    calls.push(config.url);
    return h.ok(config, {
      users: [
        { ...h.user, _id: me },
        { ...h.user, _id: other, displayname: 'Backend user' },
        { ...h.user, _id: '333333333333333333333333', isBlocked: true },
      ],
      count: 3,
    });
  };
  const { listRealUsers } = h.load('src/features/profile/services/profileService.real.ts');
  const users = await listRealUsers();
  assert.deepEqual(calls, ['/users']);
  assert.equal(users.length, 1);
  assert.equal(users[0].id, other);
  assert.equal(users[0].name, 'Backend user');
  assert.equal(users[0].distanceKm, undefined);
  h.apiClient.defaults.adapter = async (config) => h.ok(config, { users: [], count: 0 });
  assert.equal((await listRealUsers()).length, 0);
});

test('real group and message writes send confirmed DTOs with idempotency keys and no client-supplied identity', async () => {
  let unreadRefreshes = 0;
  const h = harness({
    'react-native': { Platform: { OS: 'android' } },
    './socketSession': {
      refreshUnread: async () => {
        unreadRefreshes++;
      },
      getHistory: async () => [],
      joinGroup: async () => {},
    },
  });
  const me = '111111111111111111111111';
  const other = '222222222222222222222222';
  h.runtime.setSessionIdentity(me, h.token(me));
  const requests = [];
  h.apiClient.defaults.adapter = async (config) => {
    requests.push({ url: config.url, body: JSON.parse(config.data) });
    return h.ok(
      config,
      config.url === '/groups/create-group'
        ? { _id: '333333333333333333333333', name: 'Server group', admin: me, members: [me, other] }
        : {
            _id: '444444444444444444444444',
            sender: me,
            receiver: other,
            message: 'Hello',
            sentAt: '2026-10-14T01:00:00Z',
            isRead: false,
          },
    );
  };
  const { groupService } = h.load('src/features/chat/services/groupService.ts');
  const group = await groupService.create({
    name: '  Server group  ',
    description: '  ',
    members: [other, other],
    clientId: 'group-key-1',
  });
  assert.equal(group.admin, me);
  assert.deepEqual(requests[0], {
    url: '/groups/create-group',
    body: { name: 'Server group', members: [other], clientId: 'group-key-1' },
  });
  const { realChatService } = h.load('src/features/chat/services/chatService.real.ts');
  const sent = await realChatService.sendMessage({
    conversationId: `user:${other}`,
    text: 'Hello',
    clientId: 'local-only',
  });
  assert.deepEqual(requests[1], {
    url: '/chats/messages',
    body: { receiver: other, message: 'Hello' },
  });
  assert.equal(sent.id, '444444444444444444444444');
  assert.equal(sent.clientId, 'local-only');
  assert.equal(sent.status, 'sent');
  assert.equal(unreadRefreshes, 1);
  // A malformed key is never sent; the server would reject it.
  await realChatService.sendMessage({
    conversationId: `user:${other}`,
    text: 'Hello',
    clientId: 'bad key!',
  });
  assert.deepEqual(requests[2].body, { receiver: other, message: 'Hello' });
});

test('B inbox uses confirmed REST lists, preserves array unread, and fails closed on malformed lists', async () => {
  const h = harness({
    'react-native': { Platform: { OS: 'android' } },
    './socketSession': { refreshUnread: async () => {} },
  });
  const me = '111111111111111111111111',
    other = '222222222222222222222222';
  h.runtime.setSessionIdentity(me, h.token(me));
  const state = h.load('src/features/chat/services/chatState.ts');
  const unread = {
    _id: '444444444444444444444444',
    sender: other,
    receiver: me,
    message: 'Unread',
    sentAt: '2026-10-15T00:00:00Z',
    isRead: false,
  };
  state.acceptUnread([unread, unread]);
  const calls = [];
  h.apiClient.defaults.adapter = async (config) => {
    calls.push(config.url);
    return h.ok(
      config,
      config.url === '/users/chatlist'
        ? { userChatlist: [{ _id: other, displayname: 'Peer' }] }
        : [],
    );
  };
  const service = h.load('src/features/chat/services/chatService.real.ts').realChatService;
  const rows = await service.listConversations();
  assert.deepEqual(calls.sort(), ['/groups/my-groups', '/users/chatlist']);
  assert.equal(rows[0].participant.name, 'Peer');
  assert.equal(rows[0].unreadCount, 1);
  assert.equal(rows[0].presence, null);
  assert.equal(rows[0].previewState, 'loading');
  assert.equal(state.acceptUnread({ count: 999 }), false);
  assert.equal(state.unreadFor('user:' + other), 1);
  h.apiClient.defaults.adapter = async (config) => h.ok(config, {});
  await assert.rejects(service.listConversations());
});

test('B previews, last activity, loaded-message local search and visibility polling', () => {
  const h = harness();
  const inbox = h.load('src/features/chat/services/inbox.ts');
  const base = {
    id: 'm',
    senderId: 'peer',
    text: '',
    createdAt: '2026-10-15T02:00:00Z',
    status: 'read',
  };
  assert.equal(
    inbox.messagePreview({ ...base, media: [{ mimetype: 'image/jpeg' }] }).text,
    'Photo',
  );
  assert.equal(inbox.messagePreview({ ...base, media: [{ mimetype: 'video/mp4' }] }).text, 'Video');
  assert.equal(
    inbox.messagePreview({ ...base, text: 'Caption', media: [{ mimetype: 'image/jpeg' }] }).text,
    'Caption',
  );
  const rows = [
    { id: 'a', participant: { name: 'Alice' }, updatedAt: '2026-10-15T01:00:00Z' },
    { id: 'b', participant: { name: 'Bob' }, updatedAt: '2026-10-15T02:00:00Z' },
  ];
  h.queryData.set(JSON.stringify(['chat', 'messages', 'b']), [{ text: 'Loaded needle' }]);
  assert.deepEqual(
    Array.from(inbox.localSearch(rows, '')).map((r) => r.id),
    ['b', 'a'],
  );
  assert.deepEqual(
    Array.from(inbox.localSearch(rows, 'needle')).map((r) => r.id),
    ['b'],
  );
  assert.equal(inbox.LOCAL_SEARCH_LABEL, 'Local search');
  for (const [focused, state, expected] of [
    [true, 'active', true],
    [false, 'active', false],
    [true, 'background', false],
    [true, 'inactive', false],
  ])
    assert.equal(inbox.pollingEnabled(focused, state), expected);
  const screen = fs.readFileSync('src/features/chat/screens/ChatsScreen.tsx', 'utf8');
  assert.match(screen, /accessibilityLabel={LOCAL_SEARCH_LABEL}/);
  assert.match(screen, /useConversations\(visible\)/);
});

test('B many-chat load measures request payloads, caps prefetch and pauses between requests', async (t) => {
  const h = chatHarness();
  const inbox = h.load('src/features/chat/services/inbox.ts');
  const service = h.load('src/features/chat/services/chatService.real.ts').realChatService;
  const people = Array.from({ length: 40 }, (_, i) => ({
    _id: (i + 100).toString(16).padStart(24, '0'),
    displayname: 'Peer ' + i,
  }));
  const groups = Array.from({ length: 10 }, (_, i) => ({
    _id: (i + 500).toString(16).padStart(24, '0'),
    name: 'Group ' + i,
    admin: h.me,
    createdAt: '2026-10-01T00:00:00Z',
  }));
  let http = 0,
    bytes = 0,
    histories = 0,
    active = 0,
    peak = 0;
  h.apiClient.defaults.adapter = async (config) => {
    http++;
    const data = config.url === '/users/chatlist' ? { userChatlist: people } : groups;
    const response = h.ok(config, data);
    bytes += Buffer.byteLength(JSON.stringify(response.data));
    return response;
  };
  const rows = await service.listConversations();
  const load = async (key) => {
    active++;
    peak = Math.max(peak, active);
    histories++;
    const messages = Array.from({ length: 100 }, (_, i) =>
      backendMessage(h.me, h.other, {
        _id: (i + 1000).toString(16).padStart(24, '0'),
        ...(key.startsWith('group:')
          ? {
              receiver: undefined,
              groupId: key.slice(6),
              sender: { _id: h.other, displayname: 'Group sender' },
            }
          : { sender: key.slice(5) }),
        message: 'Synthetic message ' + i,
      }),
    );
    bytes += Buffer.byteLength(JSON.stringify(messages));
    h.history.set(key.split(':')[1], messages);
    const result = await service.listMessages(key);
    active--;
    return result;
  };
  await inbox.prefetchInbox(rows, load, () => true);
  assert.equal(peak, inbox.INBOX_PREFETCH_CONCURRENCY);
  assert.equal(histories, 50);
  assert.equal(http, 2);
  await until(() => h.sockets[0].packets.filter((p) => p.name === 'getUnreadCount').length === 2);
  const packets = h.sockets[0].packets;
  t.diagnostic(
    JSON.stringify({
      fixture: '40 direct + 10 group; 100 messages/history',
      httpRequests: http,
      historyRequests: histories,
      socketRequests: packets.length,
      socketRequestJsonBytes: Buffer.byteLength(JSON.stringify(packets)),
      jsonListAndHistoryResponseBytes: bytes,
      peakPrefetch: peak,
    }),
  );
  let visible = true,
    calls = 0;
  await inbox.prefetchInbox(
    rows,
    async () => {
      calls++;
      visible = false;
      return [];
    },
    () => visible,
    true,
  );
  assert.equal(calls, 1);
  h.runtime.teardownSession();
});

test('socket history requests serialize uncorrelated server events and logout cancels pending requests', async () => {
  const { EventEmitter } = require('node:events');
  class FakeSocket extends EventEmitter {
    connected = false;
    calls = [];
    hasListeners(name) {
      return this.listenerCount(name) > 0;
    }
    connect() {
      this.connected = true;
      setTimeout(() => super.emit('connect'), 0);
    }
    disconnect() {
      this.connected = false;
      super.emit('disconnect');
    }
    emit(name, data) {
      if (name === 'getUnreadCount') {
        setTimeout(() => super.emit('unreadMessageCount', []), 0);
        return true;
      }
      if (name === 'getChatHistory') {
        this.calls.push(data.user2);
        return true;
      }
      return super.emit(name, data);
    }
    reply(data) {
      super.emit('chatHistory', data);
    }
  }
  const socket = new FakeSocket();
  const h = harness({
    'react-native': { Platform: { OS: 'android' } },
    'socket.io-client': { io: () => socket },
    '@/services/queryClient': {
      queryClient: {
        invalidateQueries: async () => {},
        setQueryData: () => {},
        getQueryData: () => undefined,
        clear: () => {},
        cancelQueries: async () => {},
      },
    },
  });
  const me = '111111111111111111111111';
  h.runtime.setSessionIdentity(me, h.token(me));
  const { socketRequest } = h.load('src/features/chat/services/socketSession.ts');
  const first = socketRequest('getChatHistory', 'chatHistory', { user2: 'first' });
  const second = socketRequest('getChatHistory', 'chatHistory', { user2: 'second' });
  await until(() => socket.calls.length === 1);
  assert.deepEqual(socket.calls, ['first']);
  socket.reply(['first response']);
  assert.deepEqual(Array.from(await first), ['first response']);
  await until(() => socket.calls.length === 2);
  assert.deepEqual(socket.calls, ['first', 'second']);
  const canceled = assert.rejects(second);
  h.runtime.teardownSession();
  await canceled;
  assert.equal(socket.connected, false);
});

test('each role has confirmed capabilities; unknown roles fail closed', () => {
  const h = harness();
  const { hasCapability, hasRole } = h.load('src/features/auth/permissions.ts');
  for (const role of ['root', 'admin', 'user', 'manager']) {
    assert.equal(hasCapability([role], 'canSendMessages'), true);
    assert.equal(hasCapability([role], 'canShareMedia'), true);
    assert.equal(hasCapability([role], 'canModerate'), ['root', 'admin'].includes(role));
    assert.equal(hasCapability([role], 'canRequestConnection'), role === 'user');
    assert.equal(hasCapability([role], 'canCreateGroups'), true);
  }
  assert.equal(hasRole(['root'], ['admin']), true);
  assert.equal(hasCapability([], 'canSendMessages'), false);
  assert.equal(hasCapability(['admin', 'unknown'], 'canModerate'), false);
  const { parseUser } = h.load('src/features/auth/userModel.ts');
  assert.throws(() => parseUser({ ...h.user, roles: [] }));
  assert.throws(() => parseUser({ ...h.user, roles: ['ADMIN'] }));
});

test('profile refresh updates roles, fails closed, recovers, and logout clears identity/cache', async () => {
  const h = harness();
  const store = h.useAuthStore;
  const session = {
    accessToken: h.token(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    userId: h.user._id,
  };
  await store.getState().setAuthenticated({ session, user: h.user });
  const { userCache, USER_CACHE_LIMIT, senderId, isUserBlocked } = h.load(
    'src/features/auth/userCache.ts',
  );
  for (let i = 0; i < 250; i++)
    userCache.put({ _id: String(i), displayname: 'Member', passwordResetToken: 'private' });
  assert.equal(userCache.size(), USER_CACHE_LIMIT);
  assert.equal(userCache.get('249').passwordResetToken, undefined);
  assert.equal(senderId({ _id: h.user._id }), store.getState().currentUser._id);
  assert.equal(isUserBlocked('249'), undefined);
  const before = store.getState().sessionRevision;
  h.apiClient.defaults.adapter = async (config) => h.ok(config, { ...h.user, roles: ['admin'] });
  await store.getState().refreshProfile();
  assert.deepEqual(Array.from(store.getState().roles), ['admin']);
  assert.equal(store.getState().sessionRevision, before + 1);
  h.apiClient.defaults.adapter = async (config) => h.ok(config, { ...h.user, roles: ['unknown'] });
  await store.getState().refreshProfile();
  assert.equal(store.getState().currentUser, null);
  assert.equal(store.getState().roles.length, 0);
  assert.ok(store.getState().profileError);
  h.apiClient.defaults.adapter = async (config) => h.ok(config, h.user);
  await store.getState().refreshProfile();
  assert.equal(store.getState().status, 'authenticated');
  let tornDown = 0;
  h.runtime.sessionIdentity.subscribe(() => tornDown++);
  await store.getState().logout();
  assert.equal(userCache.size(), 0);
  assert.equal(h.runtime.sessionIdentity.userId, null);
  assert.equal(h.runtime.sessionIdentity.getToken(), null);
  assert.equal(tornDown, 1);
});

test('403 never retries action and refreshes /auth/me once for HTTP and envelope', async () => {
  for (const envelope of [true, false]) {
    const h = harness();
    await h.useAuthStore.getState().setAuthenticated({
      user: h.user,
      session: {
        accessToken: h.token(),
        userId: h.user._id,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    });
    const calls = [];
    h.apiClient.defaults.adapter = async (config) => {
      calls.push(config.url);
      if (config.url === '/auth/me') return h.ok(config, { ...h.user, roles: ['manager'] });
      const response = h.ok(config, null);
      response.data.statusCode = 403;
      if (envelope) return response;
      response.status = 403;
      throw new axios.AxiosError('Forbidden', 'ERR_BAD_RESPONSE', config, undefined, response);
    };
    await assert.rejects(h.apiClient.post('/admin/action'), /not permitted/);
    assert.deepEqual(calls, ['/admin/action', '/auth/me']);
    assert.equal(h.useAuthStore.getState().status, 'authenticated');
    assert.ok(h.useAuthStore.getState().permissionError.includes('not permitted'));
  }
});

test('blocked /auth/me and unverified profile land in account states', async () => {
  const h = harness();
  const session = {
    accessToken: h.token(),
    userId: h.user._id,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  };
  await h.useAuthStore
    .getState()
    .setAuthenticated({ session, user: { ...h.user, isEmailVerified: false } });
  assert.equal(h.useAuthStore.getState().status, 'unverified');
  await h.useAuthStore.getState().setAuthenticated({ session, user: h.user });
  h.apiClient.defaults.adapter = async (config) => ({
    ...h.ok(config, null),
    data: {
      statusCode: 401,
      error: 'Forbidden',
      message: 'Account blocked!, contact administrator Dark Fantasy',
    },
  });
  await h.useAuthStore.getState().refreshProfile();
  assert.equal(h.useAuthStore.getState().status, 'blocked');
  assert.equal(h.runtime.getRuntimeToken(), null);
});

async function until(condition) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail('Expected asynchronous condition did not complete');
}

function chatHarness() {
  const { EventEmitter } = require('node:events');
  const sockets = [];
  const history = new Map();
  let held = false;
  const pendingHistory = [];
  class ChatSocket extends EventEmitter {
    connected = false;
    packets = [];
    hasListeners(name) {
      return this.listenerCount(name) > 0;
    }
    connect() {
      this.connected = true;
      setTimeout(() => this.server('connect'), 0);
    }
    disconnect() {
      this.connected = false;
      this.server('disconnect');
    }
    server(name, data) {
      return super.emit(name, data);
    }
    emit(name, payload, ack) {
      this.packets.push({ name, payload });
      if (name === 'joinGroup') setTimeout(() => ack({ groupId: payload }), 0);
      if (name === 'getUnreadCount' || name === 'markAsRead')
        setTimeout(() => this.server('unreadMessageCount', []), 0);
      if (name === 'getChatHistory' || name === 'getGroupChatHistory') {
        const reply = () =>
          this.server(
            name === 'getChatHistory' ? 'chatHistory' : 'groupChatHistory',
            history.get(payload.user2 ?? payload.groupId) ?? [],
          );
        if (held) pendingHistory.push(reply);
        else setTimeout(reply, 0);
      }
      return true;
    }
  }
  const h = harness({
    'react-native': { Platform: { OS: 'android' } },
    'socket.io-client': {
      io: (_url, options) => {
        const socket = new ChatSocket();
        socket.options = options;
        sockets.push(socket);
        return socket;
      },
    },
  });
  const me = '111111111111111111111111';
  const other = '222222222222222222222222';
  h.runtime.setSessionIdentity(me, h.token(me));
  return {
    ...h,
    me,
    other,
    sockets,
    history,
    transport: h.load('src/features/chat/services/socketSession.ts'),
    state: h.load('src/features/chat/services/chatState.ts'),
    hold: () => {
      held = true;
    },
    release: () => {
      held = false;
      pendingHistory.splice(0).forEach((reply) => reply());
    },
  };
}
function backendMessage(me, other, extras = {}) {
  return {
    _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    sender: other,
    receiver: me,
    sentAt: '2026-10-14T01:00:00Z',
    message: 'Hello',
    isRead: false,
    media: [],
    ...extras,
  };
}

test('Stage A allowlist drops private fields and rejects malformed or cross-chat payloads', () => {
  const h = chatHarness();
  const { parseMessage, mapMessage } = h.load('src/features/chat/services/chatPayload.ts');
  const raw = backendMessage(h.me, h.other, {
    token: 'private',
    sender: { _id: h.other, displayname: 'Peer', email: 'private' },
    media: [
      {
        _id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
        mimetype: 'image/jpeg',
        status: 'active',
        url: 'https://private.example/link',
        storageKey: 'private',
        filename: 'private',
      },
    ],
  });
  const safe = parseMessage(raw);
  assert.equal(safe.token, undefined);
  assert.equal(safe.sender.email, undefined);
  assert.equal(safe.media[0].url, undefined);
  assert.equal(safe.media[0].storageKey, undefined);
  for (const extras of [
    { sender: null },
    { sentAt: 'bad' },
    { isRead: 'yes' },
    { media: [{}] },
    { media: [{ _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', mimetype: 'image/jpeg', expiresAt: 'bad' }] },
  ])
    assert.equal(parseMessage({ ...raw, ...extras }), null);
  assert.throws(() => mapMessage(raw, `user:${h.me}`));
  h.runtime.teardownSession();
});

test('Stage A merges REST/socket IDs, preserves read, and protects edits/deletes against stale histories', async () => {
  const h = chatHarness();
  await h.transport.ensureChatReady();
  const socket = h.sockets[0];
  const key = `user:${h.other}`;
  const queryKey = ['chat', 'messages', key];
  const raw = backendMessage(h.me, h.other, { sender: h.me, receiver: h.other });
  socket.server('receiveMessage', raw);
  const { mapMessage } = h.load('src/features/chat/services/chatPayload.ts');
  h.state.mergeMessage({ ...mapMessage(raw, key), clientId: 'temporary' });
  assert.equal(h.queryData.get(JSON.stringify(queryKey)).length, 1);
  socket.server('messagesRead', { userId: h.other });
  socket.server('receiveMessage', raw);
  let rows = h.queryData.get(JSON.stringify(queryKey));
  assert.equal(rows[0].status, 'read');
  assert.equal(rows[0].clientId, 'temporary');
  h.history.set(h.other, [raw]);
  h.hold();
  const load = h.transport.getHistory(key);
  await until(() => socket.packets.some((packet) => packet.name === 'getChatHistory'));
  socket.server('messageUpdated', { ...raw, message: 'Changed' });
  h.release();
  assert.equal((await load)[0].text, 'Changed');
  const started = h.state.historyVersion();
  socket.server('messageDeleted', { ...raw, messageId: raw._id });
  rows = h.state.reconcileHistory(key, [mapMessage(raw, key)], started);
  assert.equal(rows.length, 0);
  h.runtime.teardownSession();
});

test('Stage A unread arrays drive badges, dedupe IDs, and fail closed on count-shaped data', async () => {
  const h = chatHarness();
  await h.transport.ensureChatReady();
  const key = `user:${h.other}`;
  h.queryData.set(JSON.stringify(['chat', 'conversations']), [{ id: key, unreadCount: 0 }]);
  const raw = backendMessage(h.me, h.other);
  h.sockets[0].server('unreadData', [raw, raw]);
  assert.equal(h.state.unreadFor(key), 1);
  assert.equal(h.queryData.get(JSON.stringify(['chat', 'conversations']))[0].unreadCount, 1);
  h.sockets[0].server('unreadMessageCount', { count: 8 });
  assert.equal(h.state.unreadFor(key), 1);
  h.sockets[0].server('unreadMessageCount', []);
  assert.equal(h.state.unreadFor(key), 0);
  h.runtime.teardownSession();
});

test('Stage A reconnect rejoins groups and resyncs history/unread before emitting read', async () => {
  const h = chatHarness();
  const group = '333333333333333333333333';
  await h.transport.joinGroup(group);
  await h.transport.getHistory(`user:${h.other}`);
  await h.transport.getHistory(`group:${group}`);
  const socket = h.sockets[0];
  const before = socket.packets.length;
  h.hold();
  socket.disconnect();
  socket.connect();
  await until(() =>
    socket.packets.slice(before).some((packet) => packet.name === 'getChatHistory'),
  );
  assert.equal(h.state.useChatConnection.getState().ready, false);
  let visible = true;
  const read = h.transport.socketRequest(
    'markAsRead',
    'unreadMessageCount',
    { user2: h.other },
    () => visible,
  );
  assert.equal(
    socket.packets.slice(before).some((packet) => packet.name === 'markAsRead'),
    false,
  );
  visible = false;
  const rejected = assert.rejects(read);
  h.release();
  await rejected;
  await until(() => h.state.useChatConnection.getState().ready);
  assert.equal(
    socket.packets.slice(before).some((packet) => packet.name === 'markAsRead'),
    false,
  );
  const operations = socket.packets.slice(before).map((packet) => packet.name);
  assert.equal(operations[0], 'joinGroup');
  assert.ok(operations.indexOf('getUnreadCount') > operations.indexOf('getGroupChatHistory'));
  let auth;
  socket.options.auth((value) => {
    auth = value;
  });
  assert.equal(auth.token, h.runtime.sessionIdentity.getToken());
  await h.transport.socketRequest(
    'markAsRead',
    'unreadMessageCount',
    { user2: h.other },
    () => true,
  );
  assert.equal(socket.packets.at(-1).name, 'markAsRead');
  h.runtime.teardownSession();
});

test('Stage A rejects old socket callbacks and HTTP responses after same-account relogin', async () => {
  const h = chatHarness();
  await h.transport.ensureChatReady();
  const oldHandler = h.sockets[0].listeners('receiveMessage')[0];
  const scope = h.runtime.sessionIdentity.generation;
  let complete;
  h.apiClient.defaults.adapter = (config) =>
    new Promise((resolve) => {
      complete = () => resolve(h.ok(config, { url: 'https://private.example/media' }));
    });
  const oldRequest = h.apiClient.post(
    '/chats/messages/aaaaaaaaaaaaaaaaaaaaaaaa/media/bbbbbbbbbbbbbbbbbbbbbbbb/access-url',
  );
  const rejected = assert.rejects(oldRequest);
  await until(() => Boolean(complete));
  h.runtime.teardownSession();
  h.runtime.setSessionIdentity(h.me, h.token(h.me));
  assert.equal(h.runtime.isSessionCurrent(scope), false);
  oldHandler(backendMessage(h.me, h.other));
  assert.equal(h.queryData.has(JSON.stringify(['chat', 'messages', `user:${h.other}`])), false);
  complete();
  await rejected;
  assert.equal(h.logs.length, 0);
  h.runtime.teardownSession();
});

test('Stage A composer and attachment capabilities are independent', () => {
  const h = harness({
    react: { useState: () => ['Hello', () => {}], useRef: (value) => ({ current: value }) },
    'react-native': {
      View: 'View',
      Pressable: 'Pressable',
      TextInput: 'TextInput',
      StyleSheet: { create: (value) => value, hairlineWidth: 1 },
    },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-haptics': { impactAsync: async () => {}, ImpactFeedbackStyle: { Light: 'light' } },
    '@/components/ui': { Text: 'Text' },
    '@/theme': {
      radius: { xl: 1, full: 1 },
      spacing: { sm: 1, md: 1, lg: 1 },
      typography: { size: { md: 1 }, lineHeight: { md: 1 }, maxFontScale: 1 },
    },
    '@/theme/useTheme': { useTheme: () => ({ theme: { colors: {} } }) },
  });
  const { ChatInput } = h.load('src/features/chat/components/ChatInput.tsx');
  function find(node, label) {
    if (!node || typeof node !== 'object') return undefined;
    if (node.props?.accessibilityLabel === label) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const found = find(child, label);
      if (found) return found;
    }
  }
  let sends = 0;
  const props = {
    onSend: () => {
      sends++;
    },
    onAttach: () => {},
    bottomInset: 0,
  };
  const mediaOnly = ChatInput({ ...props, canShareMedia: true, canSendMessages: false });
  assert.equal(find(mediaOnly, 'Send message').props.disabled, true);
  find(mediaOnly, 'Send message').props.onPress();
  assert.equal(sends, 0);
  assert.equal(find(mediaOnly, 'Message').props.editable, false);
  assert.equal(find(mediaOnly, 'Attach photos or videos').props.disabled, false);
  const textOnly = ChatInput({ ...props, canShareMedia: false, canSendMessages: true });
  assert.equal(find(textOnly, 'Attach photos or videos'), undefined);
  assert.equal(find(textOnly, 'Send message').props.disabled, false);
  find(textOnly, 'Send message').props.onPress();
  assert.equal(sends, 1);
});

test('Stage A read hook gates focus, foreground and synchronization; groups read without receipts', async () => {
  const preferences = { readReceipts: true };
  const usePreferences = (selector) => selector(preferences);
  usePreferences.getState = () => preferences;
  const connection = { ready: true, epoch: 1 };
  const useChatConnection = (selector) => selector(connection);
  useChatConnection.getState = () => connection;
  const app = { currentState: 'active' };
  const effects = [];
  let blur;
  const reads = [];
  const h = harness({
    react: {
      useState: () => [true, () => {}],
      useRef: (value) => ({ current: value }),
      useCallback: (fn) => fn,
      useEffect: (fn) => {
        effects.push(fn);
      },
      useMemo: (fn) => fn(),
    },
    'react-native': { Platform: { OS: 'android' }, AppState: app },
    'expo-router': {
      useFocusEffect: (fn) => {
        blur = fn();
      },
    },
    '@/hooks/useAppState': { useAppState: () => app.currentState },
    '@/features/auth/hooks/useCurrentUser': { useCan: () => true },
    '@/components/ui/Toast': { toast: { error: () => {} } },
    '@/features/settings/store/preferencesStore': { usePreferences },
    '../services/chatState': { useChatConnection },
    '../services': {
      chatService: {
        markRead: async (key, allowed) => {
          reads.push({ key, allowed });
        },
      },
    },
  });
  h.runtime.setSessionIdentity('111111111111111111111111', h.token('111111111111111111111111'));
  h.useAuthStore.setState({ status: 'authenticated', roles: ['user'] });
  const { useMarkConversationRead } = h.load('src/features/chat/hooks/useChat.ts');
  const key = 'user:222222222222222222222222';
  useMarkConversationRead(key, 'aaaaaaaaaaaaaaaaaaaaaaaa');
  effects.splice(0).forEach((fn) => fn());
  assert.equal(reads.length, 1);
  assert.equal(reads[0].allowed(), true);
  app.currentState = 'background';
  assert.equal(reads[0].allowed(), false);
  app.currentState = 'active';
  connection.ready = false;
  assert.equal(reads[0].allowed(), false);
  connection.ready = true;
  blur();
  assert.equal(reads[0].allowed(), false);
  preferences.readReceipts = false;
  useMarkConversationRead('user:222222222222222222222222', 'bbbbbbbbbbbbbbbbbbbbbbbb');
  effects.splice(0).forEach((fn) => fn());
  assert.equal(reads.length, 1); // direct receipts follow the reciprocal preference
  useMarkConversationRead('group:333333333333333333333333', 'aaaaaaaaaaaaaaaaaaaaaaaa');
  effects.splice(0).forEach((fn) => fn());
  assert.equal(reads.length, 2);
  assert.equal(reads[1].key, 'group:333333333333333333333333');
  h.runtime.teardownSession();
  assert.equal(reads[0].allowed(), false);
  assert.equal(reads[1].allowed(), false);
});

function harness(overrides = {}) {
  const cache = new Map();
  const secure = new Map();
  const writes = [];
  const counters = { queries: 0, outbox: 0, sockets: 0 };
  const logs = [];
  const queryData = new Map();
  const stubs = {
    react: {
      useState: (initial) => [initial, () => {}],
      useRef: (initial) => ({ current: initial }),
      useCallback: (fn) => fn,
      useEffect: () => {},
    },
    '@/config/env': {
      env: { apiUrl: 'https://api.example.test/api', pinningEnabled: false, pins: [] },
    },
    'expo-secure-store': {
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
      getItemAsync: async (key) => secure.get(key) ?? null,
      setItemAsync: async (key, value, options) => {
        writes.push({ key, value, options });
        secure.set(key, value);
      },
      deleteItemAsync: async (key) => {
        secure.delete(key);
      },
    },
    '@/services/queryClient': {
      queryClient: {
        setQueryData: (key, value) => {
          const id = JSON.stringify(key);
          const next = typeof value === 'function' ? value(queryData.get(id)) : value;
          if (next !== undefined) queryData.set(id, next);
          return next;
        },
        getQueryData: (key) => queryData.get(JSON.stringify(key)),
        cancelQueries: async () => {},
        invalidateQueries: async () => {},
        removeQueries: ({ queryKey }) => queryData.delete(JSON.stringify(queryKey)),
        clear: () => {
          queryData.clear();
          counters.queries++;
        },
      },
    },
    '@/features/chat/store/outboxStore': {
      useOutbox: {
        getState: () => ({
          clear: () => {
            counters.outbox++;
          },
        }),
      },
    },
  };
  Object.assign(stubs, overrides);
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    const req = (id) => {
      if (stubs[id]) return stubs[id];
      if (id.startsWith('.') || id.startsWith('@/')) {
        const base = id.startsWith('@/')
          ? path.resolve('src', id.slice(2))
          : path.resolve(path.dirname(filename), id);
        const file = [base + '.ts', base + '.tsx', path.join(base, 'index.ts')].find(fs.existsSync);
        return load(file);
      }
      return require(id);
    };
    vm.runInNewContext(
      source,
      {
        require: req,
        module,
        exports: module.exports,
        __DEV__: false,
        URL,
        AbortController,
        setTimeout,
        clearTimeout,
        console: { debug: (...args) => logs.push(args), error: (...args) => logs.push(args) },
      },
      { filename },
    );
    return module.exports;
  }
  const { apiClient } = load('src/services/api/apiClient.ts');
  const { useAuthStore, getAuthRevision } = load('src/features/auth/store/authStore.ts');
  const runtime = load('src/features/auth/sessionRuntime.ts');
  const service = load('src/features/auth/services/authService.real.ts').realAuthService;
  const token = (sub = 'desktop-user-id', seconds = 3600) =>
    [
      Buffer.from('{"alg":"HS256"}').toString('base64url'),
      Buffer.from(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + seconds })).toString(
        'base64url',
      ),
      'unverified-test-signature',
    ].join('.');
  const user = {
    _id: 'desktop-user-id',
    username: 'Desktop@example.test',
    displayname: 'Desktop',
    intrests: ['music'],
    firstName: 'Desktop',
    lastName: 'Test',
    roles: ['user'],
    isEmailVerified: true,
    isBlocked: false,
  };
  const ok = (config, data) => ({
    config,
    data: { data, error: false, statusCode: 201 },
    status: 200,
    statusText: 'OK',
    headers: {},
  });
  return {
    load,
    apiClient,
    useAuthStore,
    getAuthRevision,
    runtime,
    service,
    token,
    user,
    ok,
    secure,
    writes,
    counters,
    logs,
    queryData,
  };
}

test('release rejects HTTP/missing URLs, allows HTTPS, dev HTTP, requires backup pins', () => {
  assert.throws(() => validateAuthBuild({ EXPO_PUBLIC_API_URL: 'http://localhost:9000/api' }));
  assert.throws(() => validateAuthBuild({}));
  assert.doesNotThrow(() =>
    validateAuthBuild({ EXPO_PUBLIC_API_URL: 'https://api.example.test/api' }),
  );
  assert.doesNotThrow(() =>
    validateAuthBuild({ EXPO_PUBLIC_API_URL: 'http://localhost:9000/api' }, { development: true }),
  );
  assert.throws(() =>
    validateAuthBuild({
      EXPO_PUBLIC_API_URL: 'https://api.example.test/api',
      EXPO_PUBLIC_SSL_PINNING_ENABLED: 'true',
    }),
  );
  const config = require('../app.config.js');
  const before = { ...process.env };
  try {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/api';
    process.env.APP_VARIANT = 'production';
    const result = config({ config: { plugins: [] } });
    assert.equal(result.android.allowBackup, false);
    assert.equal(result.ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads, false);
    const properties = result.plugins.find((p) => p[0] === 'expo-build-properties')[1];
    assert.equal(properties.android.usesCleartextTraffic, false);
    assert.equal(properties.android.enableMinifyInReleaseBuilds, true);
  } finally {
    process.env = before;
  }
});

test('exact login contract, profile identity, password cleanup, secure persistence, restart and full logout', async () => {
  const h = harness();
  const requests = [];
  h.apiClient.defaults.adapter = async (config) => {
    requests.push(config.url);
    if (config.url === '/auth/login') {
      assert.deepEqual(JSON.parse(config.data), {
        username: 'Desktop@example.test',
        password: 'unchanged password ',
      });
      assert.equal(config.headers.Authorization, undefined);
      return h.ok(config, { accessToken: h.token(), user: h.user });
    }
    assert.equal(config.url, '/auth/me');
    assert.equal(config.headers.Authorization, `Bearer ${h.token()}`);
    return h.ok(config, h.user);
  };
  const input = {
    email: ' Desktop@example.test ',
    password: 'unchanged password ',
    strategy: 'email_password',
  };
  h.useAuthStore.getState().beginLogin();
  const result = await h.service.login(input);
  assert.equal(input.password, '');
  assert.equal(result.user._id, h.user._id);
  assert.deepEqual(requests, ['/auth/login', '/auth/me']);
  await h.useAuthStore.getState().setAuthenticated(result);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].value, result.session.accessToken);
  assert.equal(h.writes[0].options.keychainAccessible, 'device-only');
  h.runtime.setRuntimeToken(null);
  await h.useAuthStore.getState().hydrate();
  assert.equal(h.useAuthStore.getState().user.id, h.user._id);
  h.runtime.registerSessionTeardown(() => {
    h.counters.sockets++;
  });
  await h.useAuthStore.getState().logout();
  assert.equal(h.secure.size, 0);
  assert.equal(h.runtime.getRuntimeToken(), null);
  assert.equal(h.runtime.getSocketHandshakeAuth(), null);
  assert.equal(h.useAuthStore.getState().user, null);
  assert.equal(h.useAuthStore.getState().session, null);
  assert.equal(h.useAuthStore.getState().status, 'unauthenticated');
  assert.ok(h.counters.queries && h.counters.outbox && h.counters.sockets);
  assert.deepEqual(h.logs, []);
});

test('reject third-party URLs before transport; GET retries once and login never retries', async () => {
  const h = harness();
  h.runtime.setRuntimeToken(h.token());
  let calls = 0;
  h.apiClient.defaults.adapter = async (config) => {
    calls++;
    throw new axios.AxiosError('offline', 'ERR_NETWORK', config);
  };
  await assert.rejects(h.apiClient.get('https://third-party.test/steal'));
  assert.equal(calls, 0);
  await assert.rejects(h.apiClient.get('/auth/me'));
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(
    h.service.login({ email: 'a@b.test', password: 'private', strategy: 'email_password' }),
  );
  assert.equal(calls, 1);
});

test('401 expires session; 403 preserves session; expired token cannot restore', async () => {
  for (const status of [401, 403]) {
    for (const envelope of [true, false]) {
      const h = harness();
      await h.useAuthStore.getState().setAuthenticated({
        session: {
          accessToken: h.token(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          userId: h.user._id,
        },
        user: h.user,
      });
      h.apiClient.defaults.adapter = async (config) => {
        const response = h.ok(config, null);
        if (envelope) {
          response.data.statusCode = status;
          return response;
        }
        response.status = status;
        throw new axios.AxiosError('rejected', 'ERR_BAD_RESPONSE', config, undefined, response);
      };
      await assert.rejects(h.apiClient.get('/auth/me'));
      assert.equal(h.secure.size, status === 401 ? 0 : 1);
      assert.equal(h.useAuthStore.getState().status, status === 401 ? 'expired' : 'authenticated');
    }
  }
  const h = harness();
  h.secure.set('darkfantasy.token.v2', h.token('desktop-user-id', -1));
  await h.useAuthStore.getState().hydrate();
  assert.equal(h.secure.size, 0);
  assert.equal(h.runtime.getRuntimeToken(), null);
});

test('generic errors conceal nonexistent account vs backend wrong-password 500', async () => {
  for (const status of [400, 500]) {
    const h = harness();
    h.apiClient.defaults.adapter = async (config) => {
      const response = h.ok(config, null);
      response.status = status;
      throw new axios.AxiosError(
        'sensitive backend message',
        'ERR_BAD_RESPONSE',
        config,
        undefined,
        response,
      );
    };
    await assert.rejects(
      h.service.login({ email: 'a@b.test', password: 'private', strategy: 'email_password' }),
      (error) => error.code === 'INVALID_CREDENTIALS' && !error.message.includes('sensitive'),
    );
    assert.deepEqual(h.logs, []);
  }
});

test('deep links discard external destinations, encoded routes, params and returnTo', () => {
  const { redirectSystemPath: redirect } = harness().load('app/+native-intent.tsx');
  for (const path of [
    'https://evil.test',
    '//evil.test',
    '/%2f%2fevil.test',
    'darkfantasy://evil.test',
  ])
    assert.equal(redirect({ path, initial: true }), '/login');
  assert.equal(
    redirect({ path: 'darkfantasy://discover?returnTo=https://evil.test', initial: true }),
    '/discover',
  );
  assert.equal(redirect({ path: '/login?token=secret', initial: true }), '/login');
});

test('synchronous duplicate-submit guard and logout during pending login prevent resurrection', async () => {
  const h = harness();
  let resolveLogin;
  let calls = 0;
  h.service.login = () => {
    calls++;
    return new Promise((resolve) => {
      resolveLogin = resolve;
    });
  };
  const { login } = h.load('src/features/auth/hooks/useLogin.ts').useLogin();
  const first = login('a@b.test', 'private');
  assert.equal(await login('a@b.test', 'private'), false);
  assert.equal(calls, 1);
  await h.useAuthStore.getState().logout();
  resolveLogin({
    session: { accessToken: h.token(), userId: h.user._id },
    user: h.user,
  });
  assert.equal(await first, false);
  assert.equal(h.useAuthStore.getState().status, 'unauthenticated');
  assert.equal(h.secure.size, 0);
});

test('logout during GET backoff cancels retry instead of sending an old token', async () => {
  const h = harness();
  h.runtime.setRuntimeToken(h.token());
  let calls = 0;
  let notify;
  const started = new Promise((resolve) => {
    notify = resolve;
  });
  h.apiClient.defaults.adapter = async (config) => {
    calls++;
    notify();
    throw new axios.AxiosError('offline', 'ERR_NETWORK', config);
  };
  const pending = assert.rejects(h.apiClient.get('/auth/me'), (error) => axios.isCancel(error));
  await started;
  await new Promise((resolve) => setTimeout(resolve, 30));
  await h.useAuthStore.getState().logout();
  await pending;
  assert.equal(calls, 1);
});

test('server-echoed clientId reconciles messages; invalid keys are dropped', () => {
  const h = chatHarness();
  const { parseMessage, mapMessage } = h.load('src/features/chat/services/chatPayload.ts');
  const raw = backendMessage(h.me, h.other, { clientId: 'abc123-xyz' });
  assert.equal(parseMessage(raw).clientId, 'abc123-xyz');
  assert.equal(mapMessage(raw, `user:${h.other}`).clientId, 'abc123-xyz');
  assert.equal(parseMessage({ ...raw, clientId: 'x' }).clientId, undefined);
  assert.equal(parseMessage({ ...raw, clientId: '<script>alert(1)</script>' }).clientId, undefined);
  h.runtime.teardownSession();
});

test('full histories reconcile snapshots and never send pagination fields', async () => {
  const h = chatHarness();
  const key = `user:${h.other}`;
  const { mapMessage } = h.load('src/features/chat/services/chatPayload.ts');
  const message = (index) =>
    mapMessage(
      backendMessage(h.me, h.other, {
        _id: index.toString(16).padStart(24, '0'),
        sentAt: new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString(),
        message: `m${index}`,
      }),
      key,
    );
  const page = (from, to) => Array.from({ length: to - from }, (_, i) => message(from + i));
  const queryKey = JSON.stringify(['chat', 'messages', key]);

  h.state.reconcileHistory(key, page(50, 100), h.state.historyVersion(), 50);
  assert.equal(h.state.hasOlderHistory(key), true);
  h.state.prependHistory(key, page(10, 50), 50);
  assert.equal(h.state.hasOlderHistory(key), false);
  assert.equal(h.queryData.get(queryKey).length, 90);
  // A refresh of the newest page (one new message) must not drop older pages.
  h.state.reconcileHistory(key, page(51, 101), h.state.historyVersion(), 50);
  const rows = h.queryData.get(queryKey);
  assert.equal(rows.length, 91);
  assert.equal(rows[0].text, 'm10');
  assert.equal(rows.at(-1).text, 'm100');
  // A short page is the whole conversation: rows missing from it were deleted.
  h.state.reconcileHistory(key, page(98, 101), h.state.historyVersion(), 50);
  assert.equal(h.queryData.get(queryKey).length, 3);

  await h.transport.getHistory(key);
  const request = h.sockets[0].packets.find((packet) => packet.name === 'getChatHistory');
  assert.equal(JSON.stringify(request.payload), JSON.stringify({ user2: h.other }));
  h.runtime.teardownSession();
});

test('group messages merge without inventing unsupported unread receipts', async () => {
  const h = chatHarness();
  await h.transport.ensureChatReady();
  const group = '333333333333333333333333';
  const key = `group:${group}`;
  h.queryData.set(JSON.stringify(['chat', 'conversations']), [{ id: key, unreadCount: 0 }]);
  const incoming = backendMessage(h.me, h.other, { receiver: undefined, groupId: group });
  const socket = h.sockets[0];
  socket.server('receiveGroupMessage', incoming);
  socket.server('receiveGroupMessage', incoming); // duplicate delivery
  socket.server('messageUpdated', { ...incoming, message: 'edited' }); // not a new message
  socket.server('receiveGroupMessage', {
    ...incoming,
    _id: 'cccccccccccccccccccccccc',
    sender: h.me,
  }); // own message
  assert.equal(h.state.unreadFor(key), 0);
  assert.equal(h.queryData.get(JSON.stringify(['chat', 'conversations']))[0].unreadCount, 0);
  socket.server('groupRead', { groupId: group }); // read on another device
  assert.equal(h.state.unreadFor(key), 0);
  h.runtime.teardownSession();
});

test('typing indicators come from other participants and clear on delivery', async () => {
  const h = chatHarness();
  await h.transport.ensureChatReady();
  const typing = h.load('src/features/chat/store/typingStore.ts');
  const socket = h.sockets[0];
  const direct = `user:${h.other}`;
  socket.server('typing', { sender: h.other, isTyping: true });
  socket.server('typing', { sender: h.me, isTyping: true });
  socket.server('typing', { sender: 'not-an-id', isTyping: true });
  assert.deepEqual(Object.keys(typing.useTypingStore.getState().typing[direct]), [h.other]);
  socket.server('receiveMessage', backendMessage(h.me, h.other));
  assert.deepEqual(Object.keys(typing.useTypingStore.getState().typing[direct]), []);
  socket.server('typing', { sender: h.other, groupId: '333333333333333333333333' });
  assert.ok(typing.useTypingStore.getState().typing['group:333333333333333333333333'][h.other]);
  h.runtime.teardownSession();
  assert.equal(Object.keys(typing.useTypingStore.getState().typing).length, 0);
});

test('removal from a group drops it from the inbox and its cached history', async () => {
  const h = chatHarness();
  await h.transport.ensureChatReady();
  const group = '333333333333333333333333';
  const key = `group:${group}`;
  h.queryData.set(JSON.stringify(['chat', 'conversations']), [
    { id: key, unreadCount: 0 },
    { id: `user:${h.other}`, unreadCount: 0 },
  ]);
  h.queryData.set(JSON.stringify(['chat', 'messages', key]), [{ id: 'x' }]);
  h.sockets[0].server('groupRemoved', { groupId: group });
  assert.deepEqual(
    h.queryData.get(JSON.stringify(['chat', 'conversations'])).map((row) => row.id),
    [`user:${h.other}`],
  );
  assert.equal(h.queryData.has(JSON.stringify(['chat', 'messages', key])), false);
  h.runtime.teardownSession();
});

test('posts use the server like state and cached posts update in every list', () => {
  const h = harness({
    'react-native': { Platform: { OS: 'android' } },
    '@/components/ui/Toast': { toast: { error: () => {}, success: () => {} } },
  });
  const me = '111111111111111111111111';
  h.runtime.setSessionIdentity(me, h.token(me));
  const { mapPost } = h.load('src/features/feed/services/feedService.real.ts');
  const base = { _id: 'p1', user: '222222222222222222222222', createdAt: '2026-10-14T00:00:00Z' };
  const liked = mapPost({ ...base, likes: ['like-id'], likeCount: 1, likedByMe: true });
  assert.equal(liked.liked, true);
  assert.equal(liked.likeStateKnown, true);
  assert.equal(liked.likes, 1);
  assert.equal(mapPost({ ...base, likes: [{ user: me }] }).liked, true);

  const { updateCachedPost } = h.load('src/features/feed/hooks/useFeed.ts');
  const store = new Map([
    ['feed', { pages: [{ posts: [liked, { ...liked, id: 'p2' }], count: 2 }], pageParams: [0] }],
    ['my-posts', [liked]],
    ['user-posts', [{ ...liked, id: 'p3' }]],
  ]);
  const client = {
    setQueriesData: ({ queryKey }, update) =>
      store.set(queryKey[0], update(store.get(queryKey[0]))),
  };
  updateCachedPost(client, 'p1', (post) => ({ ...post, likes: 5 }));
  assert.equal(store.get('feed').pages[0].posts[0].likes, 5);
  assert.equal(store.get('my-posts')[0].likes, 5);
  updateCachedPost(client, 'p1', () => null);
  assert.deepEqual(
    store.get('feed').pages[0].posts.map((post) => post.id),
    ['p2'],
  );
  assert.deepEqual(store.get('my-posts'), []);
  assert.deepEqual(
    store.get('user-posts').map((post) => post.id),
    ['p3'],
  );
});
