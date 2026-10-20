const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');
const { validateAuthBuild } = require('./auth-build-config.cjs');

test('temporary profile validation failure locks the vault without discarding local photos', async () => {
  const h = harness(); let wiped = 0, paused = 0;
  h.load('src/features/auth/localVaultLifecycle.ts').registerLocalVaultLifecycle({
    logout: async () => { wiped++; }, pause: () => { paused++; }, signIn: async () => {},
  });
  h.secure.set('darkfantasy.token.v2', h.token());
  h.apiClient.defaults.adapter = async config => { throw new axios.AxiosError('offline', 'ERR_NETWORK', config); };
  await h.useAuthStore.getState().hydrate();
  assert.equal(wiped, 0); assert.ok(paused > 0);
  assert.equal(h.useAuthStore.getState().status, 'unverified'); assert.equal(h.runtime.sessionIdentity.userId, null);
});

test('only the explicit development EAS profile allows HTTP when doctor sets production NODE_ENV', () => {
  const before = { ...process.env };
  try {
    process.env.APP_VARIANT = 'development'; process.env.NODE_ENV = 'production';
    process.env.EXPO_PUBLIC_API_URL = 'http://10.0.2.2:9000/api'; process.env.EAS_BUILD_PROFILE = 'development';
    const config = require('../app.config.js');
    assert.doesNotThrow(() => config({ config: { plugins: [] } }));
    for (const profile of ['production', 'preview', 'apk', '']) {
      process.env.EAS_BUILD_PROFILE = profile;
      assert.throws(() => config({ config: { plugins: [] } }), /HTTPS/);
    }
  } finally { process.env = before; }
});

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

test('discovery loads one page, advances past hidden rows, and searches on the server', async () => {
  const h = harness({ 'react-native': { Platform: { OS: 'android' } } });
  const me = '111111111111111111111111';
  const other = '222222222222222222222222';
  h.runtime.setSessionIdentity(me, h.token(me));
  const requests = [];
  h.apiClient.defaults.adapter = async config => {
    requests.push(config.params);
    return h.ok(config, requests.length === 1 ? {
      users: Array.from({ length: 20 }, () => ({ ...h.user, _id: me })), count: 21,
    } : { users: [{ ...h.user, _id: other, displayname: 'A.*' }], count: 21 });
  };
  const { realProfileService } = h.load('src/features/profile/services/profileService.real.ts');
  const first = await realProfileService.discoverPage(0, 'A.*');
  assert.equal(requests.length, 1, 'does not eagerly fetch the entire directory');
  assert.equal(first.profiles.length, 0);
  assert.equal(first.nextSkip, 20, 'hidden/self rows still advance the server offset');
  const second = await realProfileService.discoverPage(first.nextSkip, 'A.*');
  assert.equal(second.profiles[0].id, other);
  assert.equal(second.nextSkip, undefined);
  assert.equal(requests[1].skip, 20);
  assert.equal(requests[1].displayname, 'A\\.\\*', 'search text cannot inject regex operators');
  h.apiClient.defaults.adapter = async config => h.ok(config, { users: [], count: 21 });
  assert.equal((await realProfileService.discoverPage(20, '')).nextSkip, undefined);
  h.runtime.teardownSession();
});

test('password recovery uses the backend and distinguishes network failures without exposing account existence', async () => {
  const h = harness();
  const calls = [];
  h.apiClient.defaults.adapter = async config => {
    calls.push({ url: config.url, body: JSON.parse(config.data) });
    return h.ok(config, { passwordRequest: true });
  };
  await h.service.requestPasswordReset(' member@example.test ');
  assert.deepEqual(calls, [{ url: '/auth/forgot-password', body: { username: 'member@example.test' } }]);
  h.apiClient.defaults.adapter = async config => { throw new axios.AxiosError('offline', 'ERR_NETWORK', config); };
  await assert.rejects(h.service.requestPasswordReset('member@example.test'), error => error.code === 'NETWORK');
  h.runtime.teardownSession();
});

test('password recovery clears loading and shows an error when the request fails', async () => {
  const states = [];
  let index = 0;
  const h = harness({
    react: {
      useState: initial => {
        const slot = index++;
        states[slot] = initial;
        return [initial, value => { states[slot] = value; }];
      },
      useRef: initial => ({ current: initial }),
    },
    'react-native': { View: 'View', StyleSheet: { create: value => value } },
    'react-hook-form': { Controller: 'Controller', useForm: () => ({ control: {},
      formState: { errors: {} }, handleSubmit: fn => () => fn({ email: 'member@example.test' }) }) },
    '@hookform/resolvers/zod': { zodResolver: () => ({}) },
    '@/components/layout': { Header: 'Header', Screen: 'Screen' },
    '@/components/ui': { Button: 'Button', Input: 'Input', Text: 'Text' },
    '../services': { authService: { requestPasswordReset: async () => { throw new Error('offline'); } } },
  });
  const { ForgotPasswordScreen } = h.load('src/features/auth/screens/ForgotPasswordScreen.tsx');
  const find = node => {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'Button') return node;
    for (const child of [node.props?.children].flat()) { const match = find(child); if (match) return match; }
    return null;
  };
  // onPress deliberately does not leak a rejected promise into the UI event loop.
  find(ForgotPasswordScreen()).props.onPress();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(states[0], false, 'does not claim the email was sent');
  assert.equal(states[1], false, 'loading always clears');
  assert.match(states[2], /Unable to send reset/);
});

test('remote image recovers for a replacement URL after a failed request', () => {
  let state = null;
  const h = harness({
    react: { useState: () => [state, value => { state = value; }] },
    'react-native': { View: 'View' },
    'expo-image': { Image: 'Image' },
    'expo-video': { useVideoPlayer: () => ({}), VideoView: 'VideoView' },
    './Text': { Text: 'Text' },
    '@/theme/useTheme': { useTheme: () => ({ theme: { colors: {} } }) },
  });
  const { RemoteMedia } = h.load('src/components/ui/RemoteMedia.tsx');
  const props = { uri: 'https://example.test/photo?old', width: 100, height: 100 };
  const image = RemoteMedia(props);
  image.props.onError();
  assert.equal(RemoteMedia(props).type, 'View');
  assert.equal(RemoteMedia({ ...props, uri: 'https://example.test/photo?new' }).type, 'Image');
});

test('crash events discard secrets, identities, messages, request data and source variables', () => {
  const h = harness();
  const { sanitizeCrashEvent } = h.load('src/services/monitoring/privacy.ts');
  const clean = sanitizeCrashEvent({ event_id: 'event', release: 'app@1',
    user: { email: 'private@example.test' }, request: { headers: { Authorization: 'secret-token' } },
    message: 'private chat', extra: { password: 'secret-password' }, breadcrumbs: [{ message: 'private route' }],
    exception: { values: [{ type: 'TypeError', value: 'secret-message', stacktrace: { frames: [{
      filename: '/Users/private-name/src/app.ts?token=secret', lineno: 42, colno: 5,
      vars: { password: 'secret-var' }, context_line: 'secret source',
    }] } }] },
  });
  const json = JSON.stringify(clean);
  for (const secret of ['private@example', 'secret-', 'private chat', 'private route', 'private-name'])
    assert.equal(json.includes(secret), false);
  assert.equal(clean.exception.values[0].stacktrace.frames[0].lineno, 42);
  assert.equal(clean.release, 'app@1');
});

test('notifications use authenticated page/read contracts without trusting metadata URLs', async () => {
  const h = harness();
  const id = '507f1f77bcf86cd799439011';
  const calls = [];
  h.apiClient.defaults.adapter = async config => {
    calls.push({ url: config.url, params: config.params, body: config.data && JSON.parse(config.data) });
    return h.ok(config, config.method === 'get' ? {
      notifications: [{ _id: id, message: 'Notice', createdAt: '2026-10-20T00:00:00Z', read: false,
        sender: null, metadata: { url: 'https://untrusted.test' } }], unreadCount: 30, nextCursor: id,
    } : { read: true });
  };
  const { realActivityService } = h.load('src/features/activity/services/activityService.real.ts');
  const page = await realActivityService.list(id);
  assert.equal(page.items[0].kind, 'system');
  assert.equal(page.items[0].eventId, undefined);
  assert.equal(page.unreadCount, 30);
  assert.equal(calls[0].params.before, id);
  await realActivityService.markRead([id]);
  assert.equal(calls[1].url, '/notifications/read');
  assert.deepEqual(calls[1].body, { ids: [id] });
  h.runtime.teardownSession();
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
    body: { receiver: other, message: 'Hello', clientId: 'local-only' },
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
  for (const role of ['root', 'admin', 'user', 'manager', 'moderator']) {
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
  assert.equal(parseUser({ ...h.user, roles: ['moderator'] }).roles[0], 'moderator');
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
  const { userCache, USER_CACHE_LIMIT, senderId } = h.load(
    'src/features/auth/userCache.ts',
  );
  for (let i = 0; i < 250; i++)
    userCache.put({ _id: String(i), displayname: 'Member', passwordResetToken: 'private' });
  assert.equal(userCache.size(), USER_CACHE_LIMIT);
  assert.equal(userCache.get('249').passwordResetToken, undefined);
  assert.equal(senderId({ _id: h.user._id }), store.getState().currentUser._id);
  assert.equal(h.load('src/features/safety/blockState.ts').isPeerBlocked('249'), false);
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

function chatHarness(overrides = {}) {
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
      if (name === 'updateMessage' || name === 'deleteMessage') {
        const message = [...history.values()].flat().find((row) => row._id === payload.messageId);
        setTimeout(() => {
          if (name === 'updateMessage') {
            const updated = { ...message, message: payload.newMessage };
            this.server('messageUpdated', updated);
            ack(updated);
          } else this.server('messageDeleted', { ...message, messageId: payload.messageId });
        }, 0);
      }
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
    ...overrides,
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

test('anonymous visibility invalidation resets active social queries and rejects late pre-restriction responses', async () => {
  let resets = 0;
  const data = new Map();
  const h = chatHarness({ '@/services/queryClient': { queryClient: {
    setQueryData: (key, value) => { const id = JSON.stringify(key); data.set(id, typeof value === 'function' ? value(data.get(id)) : value); },
    getQueryData: key => data.get(JSON.stringify(key)), cancelQueries: async () => {}, invalidateQueries: async () => {},
    resetQueries: async () => { resets++; data.clear(); }, removeQueries: () => {}, clear: () => data.clear(),
  } } });
  await h.transport.ensureChatReady();
  const blocks = h.load('src/features/safety/blockState.ts').useBlockState;
  const before = blocks.getState().version;
  let finish;
  h.apiClient.defaults.adapter = config => new Promise(resolve => finish = () => resolve(h.ok(config, { users: [] })));
  const late = h.apiClient.get('/users'), rejected = assert.rejects(late);
  await until(() => Boolean(finish));
  h.sockets[0].server('visibilityChanged');
  await until(() => resets === 1);
  assert.equal(blocks.getState().version, before + 1);
  finish(); await rejected;
  h.runtime.teardownSession();
});

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

test('read hook gates focus, foreground and synchronization; first unread is captured before direct read', async () => {
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
          const state = h.load('src/features/chat/store/conversationStore.ts');
          reads.push({ key, allowed, firstUnread: state.roomState(key).firstUnread });
        },
      },
    },
  });
  h.runtime.setSessionIdentity('111111111111111111111111', h.token('111111111111111111111111'));
  h.useAuthStore.setState({ status: 'authenticated', roles: ['user'] });
  const { useMarkConversationRead } = h.load('src/features/chat/hooks/useChat.ts');
  const key = 'user:222222222222222222222222';
  h.queryData.set(JSON.stringify(['chat', 'messages', key]), [
    { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', senderId: '222222222222222222222222', status: 'sent' },
  ]);
  useMarkConversationRead(key, 'aaaaaaaaaaaaaaaaaaaaaaaa');
  effects.splice(0).forEach((fn) => fn());
  assert.equal(reads.length, 1);
  assert.equal(reads[0].allowed(), true);
  assert.equal(reads[0].firstUnread, 'aaaaaaaaaaaaaaaaaaaaaaaa');
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
  assert.equal(reads.length, 1, 'group reads are unsupported and must not be scheduled');
  h.runtime.teardownSession();
  assert.equal(reads[0].allowed(), false);
});

function harness(overrides = {}) {
  const cache = new Map();
  const secure = new Map();
  const writes = [];
  const counters = { queries: 0, outbox: 0, sockets: 0 };
  const logs = [];
  const queryData = new Map();
  const stubs = {
    '@/features/safety/blocks': { refreshBlockState: async () => [] },
    '@/features/safety/blockCache': { invalidateSafety: async () => {}, safetyQuery: () => true },
    '@/features/vault/vaultService': {
      publishPhoto: async (asset, transport) => transport({ ...asset, uri: asset.uri.includes('picked') ? 'file:///cache/sanitized.jpg' : 'file:///cache/small.jpg' }),
    },
    'expo-file-system': {
      File: class extends Blob {
        constructor(uri) {
          super([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' });
          this.uri = uri;
        }
      },
    },
    '@/services/api/photoUpload': {
      uploadPhoto: async () => 'c191eb48-9c83-4996-99c1-01c2af8d9426',
      uploadChatPhoto: async () => 'c191eb48-9c83-4996-99c1-01c2af8d9426',
      cleanupPickedAssets: async () => {},
    },
    react: {
      useState: (initial) => [initial, () => {}],
      useRef: (initial) => ({ current: initial }),
      useCallback: (fn) => fn,
      useEffect: () => {},
    },
    '@/config/env': {
      env: { apiUrl: 'https://api.example.test/api', pinningEnabled: false, pins: [] },
    },
    '@/config/featureFlags': { featureFlags: { ENABLE_EPHEMERAL_CHAT: false } },
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
      disconnectSending: () => {},
      useOutbox: {
        getState: () => ({
          items: {},
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
        FormData,
        fetch: overrides.__fetch ?? globalThis.fetch,
        Date: overrides.__date ?? Date,
        setTimeout: overrides.__setTimeout ?? setTimeout,
        clearTimeout: overrides.__clearTimeout ?? clearTimeout,
        setInterval: overrides.__setInterval ?? setInterval,
        clearInterval: overrides.__clearInterval ?? clearInterval,
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

test('generic errors conceal nonexistent account vs incorrect password', async () => {
  for (const status of [400, 401]) {
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

test('login distinguishes backend and proxy outages from incorrect credentials', async () => {
  for (const status of [500, 502, 503, 504]) {
    for (const envelope of [false, true]) {
      const h = harness();
      h.apiClient.defaults.adapter = async (config) => {
        const response = h.ok(config, null);
        response.data = { error: 'Service unavailable', statusCode: status, message: 'Local backend is unavailable on port 9000' };
        if (envelope) return response;
        response.status = status;
        throw new axios.AxiosError('Server unavailable', 'ERR_BAD_RESPONSE', config, undefined, response);
      };
      await assert.rejects(h.service.login({ email: 'admin@darkfantasy.local', password: 'private', strategy: 'email_password' }),
        (error) => error.code === 'SERVER');
    }
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

test('echoed idempotency keys are validated and only the viewer’s own key correlates', () => {
  const h = chatHarness();
  const { parseMessage, mapMessage } = h.load('src/features/chat/services/chatPayload.ts');
  const raw = backendMessage(h.me, h.other, { clientId: 'abc123-xyz' });
  assert.equal(parseMessage(raw).clientId, 'abc123-xyz');
  assert.equal(mapMessage(raw, `user:${h.other}`).clientId, undefined, "a peer's key is ignored");
  const own = { ...raw, sender: h.me, receiver: h.other };
  assert.equal(mapMessage(own, `user:${h.other}`).clientId, 'abc123-xyz');
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

  h.state.reconcileHistory(key, page(0, 100), h.state.historyVersion());
  assert.equal(h.queryData.get(queryKey).length, 100);
  h.state.reconcileHistory(key, page(98, 101), h.state.historyVersion());
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

test('typing indicators come from other participants, honour isTyping, and clear on delivery', async () => {
  const h = chatHarness();
  await h.transport.ensureChatReady();
  const typing = h.load('src/features/chat/store/typingStore.ts');
  const socket = h.sockets[0];
  const direct = `user:${h.other}`;
  const who = (key) => Object.keys(typing.useTypingStore.getState().typing[key] ?? {});
  socket.server('typing', { sender: h.other, isTyping: true });
  socket.server('typing', { sender: h.me, isTyping: true });
  socket.server('typing', { sender: 'not-an-id', isTyping: true });
  assert.deepEqual(who(direct), [h.other]);
  socket.server('receiveMessage', backendMessage(h.me, h.other));
  assert.deepEqual(who(direct), []);
  socket.server('typing', { sender: h.other, isTyping: true });
  socket.server('typing', { sender: h.other, isTyping: false }); // explicit stop
  assert.deepEqual(who(direct), []);
  // Group typing: `{ sender, groupId, isTyping }`, keyed by the group.
  const group = 'group:333333333333333333333333';
  socket.server('typing', { sender: h.other, groupId: '333333333333333333333333', isTyping: true });
  assert.deepEqual(who(group), [h.other]);
  assert.deepEqual(who(direct), [], 'group typing never shows in the direct chat');
  socket.server('typing', { sender: h.other, groupId: 'bad', isTyping: true });
  socket.server('receiveGroupMessage', {
    ...backendMessage(h.me, h.other, { receiver: undefined, groupId: '333333333333333333333333' }),
  });
  assert.deepEqual(who(group), []);
  socket.server('typing', { sender: h.other, groupId: '333333333333333333333333' });
  assert.deepEqual(who(group), [h.other], 'a missing isTyping means typing');
  socket.server('typing', {
    sender: h.other,
    groupId: '333333333333333333333333',
    isTyping: false,
  });
  assert.deepEqual(who(group), []);
  h.runtime.teardownSession();
  assert.equal(Object.keys(typing.useTypingStore.getState().typing).length, 0);
});

/** Makes the fake server reject `event` for `id` the way ChatGateway.emitError does. */
function rejectOn(socket, event, id, statusCode = 403) {
  const original = socket.emit.bind(socket);
  socket.emit = (name, payload, ack) => {
    const target = typeof payload === 'string' ? payload : (payload?.groupId ?? payload?.user2);
    if (name !== event || target !== id) return original(name, payload, ack);
    socket.packets.push({ name, payload });
    setTimeout(() => socket.server('error', { statusCode, message: 'Group membership required' }));
    return true;
  };
}

test('groupUpdated refreshes the inbox; groupRemoved drops the group and its resync', async () => {
  const invalidated = [];
  const queryData = new Map();
  const h = chatHarness({
    '@/services/queryClient': {
      queryClient: {
        setQueryData: (key, value) => {
          const id = JSON.stringify(key);
          const next = typeof value === 'function' ? value(queryData.get(id)) : value;
          if (next !== undefined) queryData.set(id, next);
          return next;
        },
        getQueryData: (key) => queryData.get(JSON.stringify(key)),
        invalidateQueries: async ({ queryKey }) => invalidated.push(JSON.stringify(queryKey)),
        removeQueries: ({ queryKey }) => queryData.delete(JSON.stringify(queryKey)),
        cancelQueries: async () => {},
        clear: () => queryData.clear(),
      },
    },
  });
  const group = '333333333333333333333333';
  const key = `group:${group}`;
  await h.transport.getHistory(key);
  const socket = h.sockets[0];
  const conversations = JSON.stringify(['chat', 'conversations']);
  queryData.set(conversations, [{ id: key }, { id: `user:${h.other}` }]);

  socket.server('groupUpdated', { _id: 'not-an-id', name: 'x' });
  assert.equal(invalidated.length, 0, 'malformed summaries are ignored');
  socket.server('groupUpdated', { _id: group, name: 'Renamed', memberCount: 3 });
  assert.ok(invalidated.includes(conversations));
  assert.ok(invalidated.includes(JSON.stringify(['chat', 'conversation', key])));

  socket.server('groupRemoved', { groupId: group, deleted: true });
  assert.deepEqual(
    queryData.get(conversations).map((row) => row.id),
    [`user:${h.other}`],
  );
  assert.equal(queryData.has(JSON.stringify(['chat', 'messages', key])), false);
  assert.ok(!h.state.knownHistories().includes(key));

  // The next reconnect neither rejoins nor refetches the removed group.
  const before = socket.packets.length;
  socket.disconnect();
  socket.connect();
  await until(() => h.state.useChatConnection.getState().ready);
  const names = socket.packets.slice(before).map((packet) => packet.name);
  assert.ok(!names.includes('joinGroup'));
  assert.ok(!names.includes('getGroupChatHistory'));
  h.runtime.teardownSession();
});

test('reconnect drops a group the viewer lost while offline instead of stalling, without a permission error', async () => {
  const h = chatHarness();
  const group = '333333333333333333333333';
  await h.transport.getHistory(`group:${group}`);
  await h.transport.getHistory(`user:${h.other}`);
  const socket = h.sockets[0];
  rejectOn(socket, 'joinGroup', group);
  rejectOn(socket, 'getGroupChatHistory', group);
  socket.disconnect();
  socket.connect();
  await until(() => h.state.useChatConnection.getState().ready);
  assert.ok(!h.state.knownHistories().includes(`group:${group}`));
  assert.ok(h.state.knownHistories().includes(`user:${h.other}`));
  assert.ok(
    !h.useAuthStore.getState().permissionError,
    'membership loss is not a permission error',
  );
  // A server failure still fails the resync instead of silently dropping data.
  rejectOn(socket, 'getChatHistory', h.other, 500);
  socket.disconnect();
  socket.connect();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(h.state.useChatConnection.getState().ready, false);
  assert.ok(h.state.knownHistories().includes(`user:${h.other}`));
  h.runtime.teardownSession();
});

test('a socket echo carrying the idempotency key settles the outbox before the HTTP reply', async () => {
  const h = sendHarness();
  const key = `user:${h.other}`;
  await h.transport.ensureChatReady();
  h.sends.startSend(key, 'Hello', {
    sendMessage: () => new Promise(() => {}), // HTTP reply never arrives
    listMessages: async () => [],
  });
  const item = Object.values(h.outbox.getState().items)[0];
  assert.match(item.clientId, /^[A-Za-z0-9_-]{8,64}$/);
  const echo = backendMessage(h.me, h.other, {
    _id: 'dddddddddddddddddddddddd',
    sender: h.me,
    receiver: h.other,
    clientId: item.clientId,
  });
  h.sockets[0].server('receiveMessage', echo);
  h.sockets[0].server('receiveMessage', echo); // duplicate delivery
  assert.equal(Object.keys(h.outbox.getState().items).length, 0);
  const rows = h.queryData.get(JSON.stringify(['chat', 'messages', key]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].clientId, item.clientId);
  // A peer's key is never adopted, and a malformed key never rejects the message.
  const { mapMessage } = h.load('src/features/chat/services/chatPayload.ts');
  assert.equal(
    mapMessage(backendMessage(h.me, h.other, { clientId: item.clientId }), key).clientId,
    undefined,
  );
  assert.equal(
    mapMessage(
      backendMessage(h.me, h.other, { sender: h.me, receiver: h.other, clientId: 'bad key!' }),
      key,
    ).clientId,
    undefined,
  );
  h.runtime.teardownSession();
});

test('unsupported group reads send no packet; typing emits the gateway payloads', async () => {
  const h = chatHarness();
  const { realChatService } = h.load('src/features/chat/services/chatService.real.ts');
  const group = '333333333333333333333333';
  await h.transport.ensureChatReady();
  const socket = h.sockets[0];
  const before = socket.packets.length;
  await realChatService.markRead(`group:${group}`, () => true);
  await realChatService.markRead(`group:${group}`, () => false);
  assert.equal(socket.packets.length, before);
  assert.equal(socket.connected, true);
  await assert.rejects(realChatService.markRead('group:invalid'));

  const last = () => JSON.stringify(socket.packets.at(-1));
  realChatService.setTyping(`group:${group}`, true);
  assert.equal(
    last(),
    JSON.stringify({ name: 'typing', payload: { groupId: group, isTyping: true } }),
  );
  realChatService.setTyping(`user:${h.other}`, false);
  assert.equal(
    last(),
    JSON.stringify({ name: 'typing', payload: { receiver: h.other, isTyping: false } }),
  );
  const count = socket.packets.length;
  realChatService.setTyping(`user:${h.me}`, true); // never to yourself
  realChatService.setTyping('user:not-an-id', true);
  socket.connected = false;
  realChatService.setTyping(`user:${h.other}`, true); // offline: dropped, never queued
  assert.equal(socket.packets.length, count);
  h.runtime.teardownSession();
});

test('comment services match the backend listing, submission and deletion envelopes', async () => {
  const h = harness({ 'react-native': { Platform: { OS: 'android' } } });
  const calls = [];
  const raw = {
    _id: 'comment-id',
    content: 'hello',
    createdAt: '2026-10-18T00:00:00Z',
    user: { _id: 'author-id', displayname: 'Comment author' },
  };
  h.apiClient.defaults.adapter = async (config) => {
    calls.push({
      url: config.url,
      params: config.params,
      body: config.data && JSON.parse(config.data),
    });
    return h.ok(
      config,
      config.method === 'get'
        ? { comments: [raw], hasMore: true, count: 21 }
        : config.method === 'post'
          ? raw
          : { commentCount: 20 },
    );
  };
  const service = h.load('src/features/feed/services/feedService.real.ts');
  const page = await service.listComments('post-id', 'cursor-id');
  assert.equal(page.comments[0].author.name, 'Comment author');
  assert.equal(page.hasMore, true);
  assert.equal(page.count, 21);
  assert.equal((await service.addComment('post-id', ' hello ', 'retry-key-123')).id, raw._id);
  assert.equal(await service.deleteComment('post-id', raw._id), 20);
  assert.equal(calls[0].url, '/posts/post-id/comments');
  assert.equal(calls[0].params.before, 'cursor-id');
  assert.equal(
    JSON.stringify(calls[1].body),
    JSON.stringify({ post: 'post-id', content: 'hello', clientId: 'retry-key-123' }),
  );
  assert.equal(calls[2].url, '/posts/post-id/comment/comment-id');
});

test('comment submission survives an unloaded cache and a refetch replacing the optimistic row', async () => {
  let cache;
  let cancelled = false;
  const client = {
    cancelQueries: async () => {
      cancelled = true;
    },
    setQueryData: (_key, update) => {
      assert.ok(cancelled);
      cache = update(cache);
    },
    setQueriesData: () => {},
    invalidateQueries: async () => {},
  };
  const h = harness({
    'react-native': { Platform: { OS: 'android' } },
    '@tanstack/react-query': { useQueryClient: () => client, useMutation: (options) => options },
    '@/components/ui/Toast': { toast: { error: () => {}, success: () => {} } },
  });
  const mutation = h.load('src/features/feed/hooks/useFeed.ts').useAddComment('post-id');
  const pending = await mutation.onMutate({ content: 'hello', clientId: 'retry-key-123' });
  assert.equal(cache.pages[0].comments[0].id, pending);
  const confirmed = { id: 'server-id', content: 'hello', author: { id: 'author-id' } };
  // A background refresh can remove the local row before submission succeeds.
  cache.pages[0].comments = [];
  mutation.onSuccess(confirmed, {}, pending);
  assert.equal(cache.pages[0].comments[0].id, 'server-id');
  mutation.onSuccess(confirmed, {}, pending);
  assert.equal(cache.pages[0].comments.length, 1, 'confirmed comments are not duplicated');
  const failed = await mutation.onMutate({ content: 'failed', clientId: 'second-key-123' });
  mutation.onError(new Error('offline'), {}, failed);
  assert.equal(cache.pages[0].comments.length, 1);
  assert.equal(cache.pages[0].comments[0].id, 'server-id');
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

test('C edit/delete own messages use confirmed events and merge incoming changes', async () => {
  const h = chatHarness();
  const key = `user:${h.other}`;
  const own = backendMessage(h.me, h.other, { sender: h.me, receiver: h.other });
  h.history.set(h.other, [own]);
  const service = h.load('src/features/chat/services/chatService.real.ts').realChatService;
  await service.listMessages(key);
  await service.editMessage(key, own._id, 'Changed');
  const cache = () => h.queryData.get(JSON.stringify(['chat', 'messages', key]));
  assert.equal(cache()[0].text, 'Changed');
  const edit = h.sockets[0].packets.find((p) => p.name === 'updateMessage');
  assert.equal(
    JSON.stringify(edit.payload),
    JSON.stringify({ messageId: own._id, newMessage: 'Changed' }),
  );
  h.sockets[0].server('messageUpdated', { ...own, message: 'Remote edit' });
  assert.equal(cache()[0].text, 'Remote edit');
  await service.deleteMessage(key, own._id);
  assert.equal(cache().length, 0);
  const other = backendMessage(h.me, h.other, { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb' });
  h.sockets[0].server('receiveMessage', other);
  await assert.rejects(
    service.editMessage(key, other._id, 'Forbidden'),
    (e) => e.code === 'FORBIDDEN',
  );
  await assert.rejects(service.deleteMessage(key, other._id), (e) => e.code === 'FORBIDDEN');
  h.sockets[0].server('messageDeleted', { ...other, messageId: other._id });
  assert.equal(cache().length, 0);
  const actions = h.load('src/features/chat/utils/messageActions.ts').messageActions;
  assert.deepEqual(Array.from(actions({ senderId: h.me, text: 'Text', media: [] }, h.me)), [
    'copy',
    'edit',
    'delete',
  ]);
  assert.deepEqual(Array.from(actions({ senderId: h.other, text: 'Text' }, h.me)), ['copy']);
  assert.deepEqual(Array.from(actions({ senderId: h.me, text: 'Caption', media: [{}] }, h.me)), [
    'copy',
    'delete',
  ]);
  assert.deepEqual(Array.from(actions({ senderId: h.me, text: 'Pending', local: true }, h.me)), [
    'copy',
  ]);
  h.runtime.teardownSession();
});

test('C local windows, first unread snapshot and drafts clear on logout and account switch', async () => {
  const h = chatHarness();
  const room = h.load('src/features/chat/store/conversationStore.ts'),
    key = `user:${h.other}`;
  const rows = Array.from({ length: 130 }, (_, i) => ({
    id: String(i),
    senderId: h.other,
    status: i < 20 ? 'read' : 'sent',
  }));
  assert.equal(room.localWindow(rows, room.LOCAL_WINDOW)[0].id, '80');
  room.updateRoom(key, { draft: 'Memory only', window: 100 });
  assert.equal(room.localWindow(rows, room.roomState(key).window)[0].id, '30');
  assert.equal(room.captureFirstUnread(key, rows, h.me), '20');
  rows.forEach((row) => (row.status = 'read'));
  assert.equal(room.captureFirstUnread(key, rows, h.me), '20');
  await h.useAuthStore.getState().logout();
  assert.equal(Object.keys(room.useConversationState.getState().rooms).length, 0);
  h.runtime.setSessionIdentity(h.me, h.token(h.me));
  room.updateRoom(key, { draft: 'Old account' });
  h.runtime.setSessionIdentity(h.other, h.token(h.other));
  assert.equal(Object.keys(room.useConversationState.getState().rooms).length, 0);
  h.runtime.teardownSession();
});

test('C typing is throttled, covers direct and group chats, sends a stop event, and expires locally', () => {
  let now = 10000;
  const pulses = [],
    timers = new Map();
  let timerId = 0;
  class Clock extends Date {
    static now() {
      return now;
    }
  }
  const h = harness({
    __date: Clock,
    react: {
      useRef: (value) => ({ current: value }),
      useCallback: (fn) => fn,
      useEffect: (fn) => fn(),
    },
    __setTimeout: (fn, ms) => {
      timers.set(++timerId, { fn, ms });
      return timerId;
    },
    __clearTimeout: (id) => timers.delete(id),
    'react-native': { Platform: { OS: 'android' } },
    'expo-router': { useFocusEffect: () => {} },
    '@/features/auth/hooks/useCurrentUser': { useCan: () => true },
    '@/features/settings/store/preferencesStore': { usePreferences: () => true },
    '../services': { chatService: { setTyping: (...args) => pulses.push(args) } },
  });
  const { useTypingEmitter } = h.load('src/features/chat/hooks/useChat.ts');
  h.runtime.setSessionIdentity('111111111111111111111111', h.token('111111111111111111111111'));
  const direct = 'user:222222222222222222222222';
  const typing = useTypingEmitter(direct);
  typing.onChangeText('a');
  now += 200;
  typing.onChangeText('ab');
  assert.deepEqual(pulses, [[direct, true]]);
  now += 3001;
  typing.onChangeText('abc');
  assert.equal(pulses.length, 2);
  typing.stopTyping();
  assert.deepEqual(pulses.at(-1), [direct, false], 'send or clear emits isTyping: false');
  typing.stopTyping();
  assert.equal(pulses.length, 3, 'stop is sent once, not when nothing was announced');
  typing.onChangeText('Retype immediately');
  assert.deepEqual(pulses.at(-1), [direct, true], 'typing after a stop announces again');
  typing.onChangeText('');
  assert.deepEqual(pulses.at(-1), [direct, false], 'clearing the composer stops');
  // Idle: the stop timer ends the indicator without another keystroke.
  typing.onChangeText('idle');
  const idle = [...timers.values()].at(-1);
  idle.fn();
  assert.deepEqual(pulses.at(-1), [direct, false]);
  const group = 'group:333333333333333333333333';
  useTypingEmitter(group).onChangeText('x');
  assert.deepEqual(pulses.at(-1), [group, true], 'groups relay typing too');
  const before = pulses.length;
  useTypingEmitter('invalid').onChangeText('x');
  assert.equal(pulses.length, before);
  const state = h.load('src/features/chat/store/typingStore.ts');
  state.setTyping('user:peer', 'peer', true);
  const expiry = [...timers.values()].find((timer) => timer.ms === state.TYPING_TTL_MS);
  assert.ok(expiry);
  expiry.fn();
  assert.deepEqual(Object.keys(state.useTypingStore.getState().typing['user:peer']), []);
  h.runtime.teardownSession();
  assert.equal(timers.size, 0);
});

function sendHarness() {
  const h = chatHarness({ '@/features/chat/store/outboxStore': undefined });
  h.useAuthStore.setState({ status: 'authenticated', roles: ['user'] });
  return {
    ...h,
    outbox: h.load('src/features/chat/store/outboxStore.ts').useOutbox,
    sends: h.load('src/features/chat/services/sendState.ts'),
  };
}

test('C send state machine covers sending/sent/read/rejected/uncertain with no automatic resend', async () => {
  const h = sendHarness(),
    key = `user:${h.other}`;
  const { ServiceError } = h.load('src/services/errors.ts');
  let sends = 0,
    complete;
  const service = {
    sendMessage: () => {
      sends++;
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
    listMessages: async () => [],
  };
  h.sends.startSend(key, 'Hello', service);
  const item = Object.values(h.outbox.getState().items)[0];
  assert.equal(item.status, 'sending');
  complete({
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    conversationId: key,
    senderId: h.me,
    text: 'Hello',
    createdAt: item.createdAt,
    status: 'sent',
  });
  await until(() => Object.keys(h.outbox.getState().items).length === 0);
  const cache = () => h.queryData.get(JSON.stringify(['chat', 'messages', key]));
  assert.equal(cache()[0].status, 'sent');
  h.state.acceptRead(h.other);
  assert.equal(cache()[0].status, 'read');
  for (const [code, status] of [
    ['VALIDATION', 'failed-definitive'],
    ['FORBIDDEN', 'failed-definitive'],
    ['NETWORK', 'uncertain'],
    ['UNKNOWN', 'uncertain'],
  ]) {
    const fail = {
      ...service,
      sendMessage: async () => {
        sends++;
        throw new ServiceError(code);
      },
    };
    h.sends.startSend(key, code, fail);
    await until(() =>
      Object.values(h.outbox.getState().items).some((i) => i.text === code && i.status === status),
    );
  }
  const before = sends;
  await h.transport.ensureChatReady();
  h.sockets[0].disconnect();
  h.sockets[0].connect();
  await until(() => h.state.useChatConnection.getState().ready);
  await h.transport.ensureChatReady();
  assert.equal(sends, before, 'reconnect never retries any outbox message');
  const uncertain = Object.values(h.outbox.getState().items).find((i) => i.status === 'uncertain');
  assert.equal(h.sends.retryAvailable(uncertain), false);
  await h.sends.sendAgain(uncertain.clientId, service);
  assert.equal(sends, before, 'manual send is gated until explicit successful resync');
  await h.sends.resyncSend(uncertain.clientId, service);
  assert.equal(h.outbox.getState().items[uncertain.clientId].resync, 'absent');
  assert.equal(h.sends.retryAvailable(h.outbox.getState().items[uncertain.clientId]), true);
  assert.equal(sends, before, 'resync itself never sends');
  h.runtime.teardownSession();
  assert.equal(Object.keys(h.outbox.getState().items).length, 0);
});

test('C uncertain resend rechecks absence; matching history or resync failure withholds resend', async () => {
  const h = sendHarness(),
    key = `user:${h.other}`;
  let sent = 0,
    resynced = 0,
    rows = [];
  const item = {
    clientId: 'local-retry-key',
    conversationId: key,
    text: 'Lost',
    createdAt: '2026-10-15T00:00:00Z',
    status: 'uncertain',
    baselineIds: [],
  };
  h.outbox.getState().upsert(item);
  const service = {
    sendMessage: async () => {
      sent++;
      return { ...item, id: 'aaaaaaaaaaaaaaaaaaaaaaaa', senderId: h.me, status: 'sent' };
    },
    listMessages: async () => {
      resynced++;
      return rows;
    },
  };
  await h.sends.resyncSend(item.clientId, service);
  rows = [{ id: 'bbbbbbbbbbbbbbbbbbbbbbbb', senderId: h.me, text: 'Lost' }];
  await h.sends.sendAgain(item.clientId, service);
  assert.equal(sent, 0);
  assert.equal(resynced, 2);
  assert.equal(h.outbox.getState().items[item.clientId].resync, 'present');
  rows = [];
  await h.sends.resyncSend(item.clientId, service);
  await assert.rejects(
    h.sends.resyncSend(item.clientId, {
      ...service,
      listMessages: async () => {
        throw Error('offline');
      },
    }),
  );
  assert.equal(h.sends.retryAvailable(h.outbox.getState().items[item.clientId]), false);
  await h.sends.resyncSend(item.clientId, service);
  await h.sends.sendAgain(item.clientId, service);
  assert.equal(sent, 1);
  assert.equal(h.outbox.getState().items[item.clientId], undefined);
  h.runtime.teardownSession();
});

test('C pending send becomes uncertain on disconnect and late completion cannot survive logout', async () => {
  const h = sendHarness(),
    key = `user:${h.other}`;
  await h.transport.ensureChatReady();
  let finish;
  h.sends.startSend(key, 'Pending', {
    sendMessage: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const item = Object.values(h.outbox.getState().items)[0];
  h.sockets[0].disconnect();
  assert.equal(h.outbox.getState().items[item.clientId].status, 'uncertain');
  h.runtime.teardownSession();
  h.runtime.setSessionIdentity(h.other, h.token(h.other));
  finish({
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    conversationId: key,
    senderId: h.me,
    text: 'Pending',
    status: 'sent',
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(Object.keys(h.outbox.getState().items).length, 0);
  assert.equal(h.queryData.has(JSON.stringify(['chat', 'messages', key])), false);
  h.runtime.teardownSession();
});

test('blocked group messages collapse on Android and revealing text never mounts their media', () => {
  let revealed = false;
  const peer = '507f1f77bcf86cd799439012';
  const h = harness({
    react: { memo: fn => fn, useState: () => [revealed, value => { revealed = value; }], useEffect: () => {} },
    '@/features/safety/blockState': { useBlockState: selector => selector({ ids: [peer] }) },
    'react-native': { Platform: { OS: 'android' }, View: 'View', Pressable: 'Pressable', Alert: { alert: () => {} }, StyleSheet: { create: value => value } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/ui': { Text: 'Text' },
    './ChatAttachment': { ChatAttachment: 'Attachment' },
    './ViewOnceAttachment': { ViewOnceAttachment: 'ViewOnceAttachment' },
    './ExpiryCountdown': { ExpiryCountdown: 'ExpiryCountdown' },
    '@/theme/useTheme': { useTheme: () => ({ theme: { colors: {} } }) },
  });
  const { MessageBubble } = h.load('src/features/chat/components/MessageBubble.tsx');
  const props = { message: { id: 'message', senderId: peer, text: 'group text', media: [{ _id: 'media' }], createdAt: '2026-10-15T00:00:00Z', status: 'sent' }, mine: false, first: true, last: true, group: true, onActions: () => {} };
  const tree = MessageBubble(props);
  assert.equal(tree.props.accessibilityLabel, 'Blocked user, tap to show');
  assert.equal(JSON.stringify(tree).includes('group text'), false);
  tree.props.onPress();
  const visible = JSON.stringify(MessageBubble(props));
  assert.match(visible, /group text/);
  assert.match(visible, /Media unavailable/);
  assert.equal(visible.includes('"type":"Attachment"'), false);
});

test('C uncertain UI offers Send again only after absent resync and never offers dismissal', () => {
  const alerts = [];
  const h = harness({
    react: { memo: (fn) => fn, useState: initial => [initial, () => {}], useEffect: () => {} },
    '@/features/safety/blockState': { useBlockState: selector => selector({ ids: [] }) },
    'react-native': {
      Platform: { OS: 'android' },
      View: 'View',
      Pressable: 'Pressable',
      Alert: { alert: (...args) => alerts.push(args) },
      StyleSheet: { create: (value) => value, hairlineWidth: 1 },
    },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/ui': { Text: 'Text' },
    './ChatAttachment': { ChatAttachment: 'Attachment' },
    './ViewOnceAttachment': { ViewOnceAttachment: 'ViewOnceAttachment' },
    './ExpiryCountdown': { ExpiryCountdown: 'ExpiryCountdown' },
    '@/theme/useTheme': { useTheme: () => ({ theme: { colors: {} } }) },
  });
  const { MessageBubble } = h.load('src/features/chat/components/MessageBubble.tsx');
  const find = (node) =>
    node?.props?.accessibilityLabel === 'Review failed message'
      ? node
      : [node?.props?.children]
          .flat(Infinity)
          .filter(Boolean)
          .map((child) => (typeof child === 'object' ? find(child) : undefined))
          .find(Boolean);
  const base = {
    id: 'local-a',
    clientId: 'a',
    conversationId: 'user:peer',
    senderId: 'me',
    text: 'Unknown',
    createdAt: '2026-10-15T00:00:00Z',
    status: 'uncertain',
    local: true,
  };
  for (const resync of [undefined, 'present', 'absent']) {
    const tree = MessageBubble({
      message: { ...base, resync },
      mine: true,
      first: true,
      last: true,
      onRetry: () => {},
      onResync: () => {},
      onActions: () => {},
      group: false,
    });
    find(tree).props.onPress();
    const names = alerts.at(-1)[2].map((action) => action.text);
    assert.equal(names.includes('Send again'), resync === 'absent');
    assert.equal(
      names.some((name) => ['Dismiss', 'Delete', 'Discard'].includes(name)),
      false,
    );
  }
});

test('inbox query polling follows actual focus and foreground hook state', () => {
  let focused = true,
    state = 'active';
  const h = harness({
    react: {
      useState: () => [focused, () => {}],
      useRef: (value) => ({ current: value }),
      useCallback: (fn) => fn,
      useEffect: () => {},
    },
    'react-native': { Platform: { OS: 'android' } },
    'expo-router': { useFocusEffect: () => {} },
    '@tanstack/react-query': { useQuery: (options) => options },
    '@/hooks/useAppState': { useAppState: () => state },
    '@/features/auth/hooks/useCurrentUser': { useCan: () => true },
    '@/features/settings/store/preferencesStore': { usePreferences: () => true },
    '../services': { chatService: { listConversations: async () => [] } },
  });
  const hooks = h.load('src/features/chat/hooks/useChat.ts');
  const poll = () => hooks.useConversations(hooks.useChatVisibility()).refetchInterval;
  assert.equal(poll(), 30000);
  focused = false;
  assert.equal(poll(), false);
  focused = true;
  state = 'background';
  assert.equal(poll(), false);
  state = 'inactive';
  assert.equal(poll(), false);
  state = 'active';
  assert.equal(poll(), 30000);
  assert.equal(
    hooks.useConversations(false).refetchInterval,
    false,
    'tab badge observer never polls',
  );
  h.runtime.teardownSession();
});

test('C real HTTP sends distinguish definitive rejection, server failure, and no response without retries', async () => {
  for (const [kind, expected] of [
    ['envelope400', 'failed-definitive'],
    ['http400', 'failed-definitive'],
    ['envelope500', 'uncertain'],
    ['http500', 'uncertain'],
    ['timeout', 'uncertain'],
  ]) {
    const h = sendHarness(),
      key = `user:${h.other}`;
    let posts = 0;
    h.apiClient.defaults.adapter = async (config) => {
      posts++;
      if (kind === 'timeout') throw new axios.AxiosError('timeout', 'ECONNABORTED', config);
      const code = kind.endsWith('400') ? 400 : 500;
      const response = h.ok(config, null);
      response.data = { statusCode: code, error: true, message: 'Rejected' };
      if (kind.startsWith('http')) {
        response.status = code;
        throw new axios.AxiosError('Rejected', 'ERR_BAD_RESPONSE', config, undefined, response);
      }
      return response;
    };
    const service = h.load('src/features/chat/services/chatService.real.ts').realChatService;
    h.sends.startSend(key, 'Outcome ' + kind, service);
    await until(() =>
      Object.values(h.outbox.getState().items).some((item) => item.status === expected),
    );
    assert.equal(posts, 1);
    assert.equal(h.logs.length, 0);
    h.runtime.teardownSession();
  }
});

test('disappearing and view-once fields are parsed strictly and view-once is never previewed', () => {
  const h = chatHarness();
  const { parseMessage, mapMessage, previewText } = h.load(
    'src/features/chat/services/chatPayload.ts',
  );
  const key = `user:${h.other}`;
  const raw = backendMessage(h.me, h.other, {
    message: '',
    expiresAt: '2026-10-28T01:00:00Z',
    viewOnce: true,
    viewedAt: '2026-10-14T01:01:00Z',
    media: [{ _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', mimetype: 'video/mp4', status: 'active' }],
  });
  const mapped = mapMessage(raw, key);
  assert.equal(mapped.expiresAt, '2026-10-28T01:00:00Z');
  assert.equal(mapped.viewOnce, true);
  assert.equal(mapped.viewedAt, '2026-10-14T01:01:00Z');
  assert.equal(previewText(mapped), 'View-once video');
  assert.equal(previewText({ ...mapped, viewOnce: undefined }), 'Attachment');
  assert.equal(parseMessage({ ...raw, expiresAt: 'soon' }), null);
  assert.equal(parseMessage({ ...raw, viewOnce: 'true' }), null);
  assert.equal(parseMessage({ ...raw, viewedAt: 5 }), null);
  const plain = mapMessage(backendMessage(h.me, h.other), key);
  assert.equal('expiresAt' in plain || 'viewOnce' in plain || 'viewedAt' in plain, false);
  h.runtime.teardownSession();
});

test('expired disappearing messages leave the cache and the inbox preview', () => {
  const h = chatHarness();
  const key = `user:${h.other}`;
  const { mapMessage } = h.load('src/features/chat/services/chatPayload.ts');
  const row = (id, message, sentAt, expiresAt) =>
    mapMessage(backendMessage(h.me, h.other, { _id: id, message, sentAt, expiresAt }), key);
  const kept = row('a00000000000000000000001', 'kept', '2026-10-14T01:00:00Z');
  const later = row(
    'a00000000000000000000002',
    'later',
    '2026-10-14T01:30:00Z',
    '2026-10-14T03:00:00Z',
  );
  const gone = row(
    'a00000000000000000000003',
    'gone',
    '2026-10-14T01:40:00Z',
    '2026-10-14T01:59:00Z',
  );
  h.queryData.set(JSON.stringify(['chat', 'messages', key]), [kept, later, gone]);
  h.queryData.set(JSON.stringify(['chat', 'conversations']), [
    {
      id: key,
      lastMessage: { text: 'gone', senderId: h.other, createdAt: gone.createdAt },
      unreadCount: 0,
    },
  ]);
  const next = h.state.purgeExpiredMessages(key, Date.parse('2026-10-14T02:00:00Z'));
  assert.equal(next, Date.parse('2026-10-14T03:00:00Z'));
  assert.deepEqual(
    h.queryData
      .get(JSON.stringify(['chat', 'messages', key]))
      .map((m) => m.text)
      .join(),
    'kept,later',
  );
  assert.equal(
    h.queryData.get(JSON.stringify(['chat', 'conversations']))[0].lastMessage.text,
    'later',
  );
  // Nothing left to expire: no timer is needed.
  assert.equal(h.state.purgeExpiredMessages(key, Date.parse('2026-10-14T04:00:00Z')), null);
  assert.deepEqual(
    h.queryData
      .get(JSON.stringify(['chat', 'messages', key]))
      .map((m) => m.text)
      .join(),
    'kept',
  );
  h.runtime.teardownSession();
});

test('bundled backend mode refuses ephemeral sends before transport', async () => {
  const h = harness({
    'react-native': { Platform: { OS: 'android' } },
    './socketSession': { refreshUnread: async () => {}, getHistory: async () => [] },
  });
  const me = '111111111111111111111111';
  const other = '222222222222222222222222';
  h.runtime.setSessionIdentity(me, h.token(me));
  let requests = 0;
  h.apiClient.defaults.adapter = async () => {
    requests++;
    throw new Error('unexpected request');
  };
  const { realChatService } = h.load('src/features/chat/services/chatService.real.ts');
  for (const options of [{ ttlSeconds: 30 }, { viewOnce: true }]) {
    await assert.rejects(
      realChatService.sendMessage({
        conversationId: `user:${other}`,
        text: 'Hi',
        clientId: 'guard-key-1',
        ...options,
      }),
      (error) => error.code === 'VALIDATION',
    );
  }
  assert.equal(requests, 0);
  h.runtime.teardownSession();
});

test('sends carry the disappearing timer and view-once flag only when chosen', async () => {
  const h = harness({
    'react-native': { Platform: { OS: 'android' } },
    '@/config/featureFlags': { featureFlags: { ENABLE_EPHEMERAL_CHAT: true } },
    './socketSession': { refreshUnread: async () => {}, getHistory: async () => [] },
  });
  const me = '111111111111111111111111';
  const other = '222222222222222222222222';
  h.runtime.setSessionIdentity(me, h.token(me));
  const bodies = [];
  h.apiClient.defaults.adapter = async (config) => {
    bodies.push(config.data);
    return h.ok(config, {
      _id: '444444444444444444444444',
      sender: me,
      receiver: other,
      message: 'Hi',
      sentAt: '2026-10-14T01:00:00Z',
      expiresAt: '2026-10-14T01:05:00Z',
      isRead: false,
    });
  };
  const { realChatService } = h.load('src/features/chat/services/chatService.real.ts');
  const sent = await realChatService.sendMessage({
    conversationId: `user:${other}`,
    text: 'Hi',
    clientId: 'timer-key-1',
    ttlSeconds: 300,
  });
  assert.deepEqual(JSON.parse(bodies[0]), {
    receiver: other,
    message: 'Hi',
    clientId: 'timer-key-1',
    ttlSeconds: 300,
  });
  assert.equal(sent.expiresAt, '2026-10-14T01:05:00Z');
  await realChatService.sendMessage({
    conversationId: `user:${other}`,
    text: '',
    clientId: 'view-once-1',
    viewOnce: true,
    ttlSeconds: 30,
    assets: [{ uri: 'file:///photo.jpg', name: 'photo.jpg', type: 'image/jpeg' }],
  });
  const form = JSON.parse(bodies[1]);
  assert.equal(form.viewOnce, true);
  assert.equal(form.ttlSeconds, 30);
  assert.equal(form.receiver, other);
  assert.equal(form.clientId, 'view-once-1', 'photo-reference sends carry the key too');
  assert.deepEqual(form.photoIds, ['c191eb48-9c83-4996-99c1-01c2af8d9426']);
  await realChatService.sendMessage({
    conversationId: `user:${other}`,
    text: 'Plain',
    clientId: 'plain-key-1',
  });
  assert.deepEqual(Object.keys(JSON.parse(bodies[2])).sort(), ['clientId', 'message', 'receiver']);
});

test('vault-prepared photos upload directly without API credentials, confirm once and clean scratch files', async () => {
  const requests = [],
    uploads = [],
    deleted = [],
    resize = [],
    saves = [];
  let width = 1600;
  const context = {
    resize: (options) => {
      resize.push(options);
      width = options.width;
    },
    renderAsync: async () => ({
      width,
      height: 1000,
      saveAsync: async (options) => {
        saves.push(options);
        return { uri: 'file:///cache/sanitized.jpg' };
      },
    }),
  };
  const h = harness({
    'react-native': { Platform: { OS: 'android' } },
    'expo-image-manipulator': {
      ImageManipulator: { manipulate: () => context },
      SaveFormat: { JPEG: 'jpeg' },
    },
    'expo-file-system/legacy': {
      cacheDirectory: 'file:///cache/',
      getInfoAsync: async () => ({ exists: true, size: 4000 }),
      deleteAsync: async (uri) => {
        deleted.push(uri);
      },
      FileSystemUploadType: { MULTIPART: 1 },
      createUploadTask: (url, uri, options, progress) => ({
        uploadAsync: async () => {
          uploads.push({ url, uri, options });
          progress({ totalBytesSent: 2000, totalBytesExpectedToSend: 4000 });
          return { status: 204 };
        },
        cancelAsync: async () => {},
      }),
    },
    __fetch: async () => {
      throw new Error('Native image transfer must use the native uploader');
    },
  });
  h.runtime.setSessionIdentity('111111111111111111111111', h.token('111111111111111111111111'));
  h.apiClient.defaults.adapter = async (config) => {
    requests.push({
      url: config.url,
      body: JSON.parse(config.data),
      auth: config.headers.Authorization,
    });
    return h.ok(
      config,
      config.url === '/photos/upload-url'
        ? {
            uploadId: 'c191eb48-9c83-4996-99c1-01c2af8d9426',
            status: 'pending',
            url: 'https://private-bucket.s3.amazonaws.com/',
            fields: { key: 'temp/owner/server.jpg', 'Content-Type': 'image/jpeg' },
          }
        : { uploadId: 'c191eb48-9c83-4996-99c1-01c2af8d9426', status: 'approved' },
    );
  };
  const { uploadPhoto } = h.load('src/services/api/photoUpload.ts');
  const asset = { uri: 'file:///cache/picked.jpg', type: 'image/jpeg', name: 'client-name.jpg' };
  const progress = [];
  const results = await Promise.all([uploadPhoto(asset, value => progress.push(value)), uploadPhoto(asset)]);
  assert.ok(progress.some(value => value.stage === 'transfer' && value.percent === 50));
  assert.ok(progress.some(value => value.stage === 'confirm'));
  assert.equal(progress.at(-1).stage, 'complete');
  assert.equal(results[0], results[1]);
  assert.deepEqual(
    requests.map((row) => row.url),
    ['/photos/upload-url', '/photos/confirm'],
  );
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].options.headers, undefined, 'API Bearer token must never reach S3');
  assert.equal(uploads[0].uri, 'file:///cache/sanitized.jpg');
  assert.equal(uploads[0].options.httpMethod, 'POST');
  assert.equal(uploads[0].options.fieldName, 'file');
  assert.equal(uploads[0].options.mimeType, 'image/jpeg');
  assert.equal(uploads[0].options.uploadType, 1);
  assert.equal(uploads[0].options.parameters.key, 'temp/owner/server.jpg');
  assert.ok(requests.every((row) => row.auth?.startsWith('Bearer ')));
  assert.equal(JSON.stringify(requests).includes('file:///'), false);
  assert.deepEqual(resize, [], 'vault preparation already resized the image');
  assert.deepEqual(saves, [], 'transport does not create another plaintext manipulator copy');
  assert.deepEqual(deleted, ['file:///cache/sanitized.jpg']);
  h.runtime.teardownSession();
});

test('a failed S3 POST is never confirmed and scratch files are removed', async () => {
  let confirmations = 0,
    puts = 0,
    cleanup = 0;
  const h = harness({
    'react-native': { Platform: { OS: 'android' } },
    'expo-image-manipulator': {
      ImageManipulator: {
        manipulate: () => ({
          renderAsync: async () => ({
            width: 100,
            saveAsync: async () => ({ uri: 'file:///cache/small.jpg' }),
          }),
        }),
      },
      SaveFormat: { JPEG: 'jpeg' },
    },
    'expo-file-system/legacy': {
      getInfoAsync: async () => ({ exists: true, size: 1000 }),
      deleteAsync: async () => {
        cleanup++;
      },
      FileSystemUploadType: { MULTIPART: 1 },
      createUploadTask: () => ({
        uploadAsync: async () => {
          puts++;
          return { status: 403 };
        },
        cancelAsync: async () => {},
      }),
    },
  });
  h.runtime.setSessionIdentity('111111111111111111111111', h.token('111111111111111111111111'));
  h.apiClient.defaults.adapter = async (config) => {
    if (config.url === '/photos/confirm') confirmations++;
    return h.ok(config, {
      uploadId: 'c191eb48-9c83-4996-99c1-01c2af8d9426',
      status: 'pending',
      url: 'https://private-bucket.s3.amazonaws.com/',
      fields: { key: 'temp/owner/server.jpg' },
    });
  };
  await assert.rejects(
    h.load('src/services/api/photoUpload.ts').uploadPhoto({
      uri: 'file:///cache/original.jpg',
      type: 'image/jpeg',
      name: 'photo.jpg',
    }),
    (error) => error.code === 'VALIDATION' && /S3 storage.*HTTP 403/.test(error.message),
  );
  assert.equal(puts, 1);
  assert.equal(confirmations, 0);
  assert.equal(cleanup, 1);
  h.runtime.teardownSession();
});

test('Android gallery chat uploads bypass a locked vault and clean only temporary files', async () => {
  const deleted = [], requests = [];
  let vaultCalls = 0;
  const h = harness({
    'react-native': { Platform: { OS: 'android' } },
    '@/features/vault/vaultService': { publishPhoto: async () => { vaultCalls++; throw Error('Vault is locked'); } },
    'expo-image-manipulator': {
      ImageManipulator: { manipulate: () => ({ renderAsync: async () => ({
        width: 100, saveAsync: async () => ({ uri: 'file:///cache/chat-clean.jpg' }),
      }) }) }, SaveFormat: { JPEG: 'jpeg' },
    },
    'expo-file-system/legacy': {
      cacheDirectory: 'file:///cache/', getInfoAsync: async () => ({ exists: true, size: 1000 }),
      deleteAsync: async (uri) => deleted.push(uri), FileSystemUploadType: { MULTIPART: 1 },
      createUploadTask: () => ({ uploadAsync: async () => ({ status: 204 }), cancelAsync: async () => {} }),
    },
  });
  h.runtime.setSessionIdentity('111111111111111111111111', h.token('111111111111111111111111'));
  h.apiClient.defaults.adapter = async (config) => {
    requests.push(config.url);
    return h.ok(config, config.url === '/photos/upload-url'
      ? { uploadId: 'gallery-upload', status: 'pending', url: 'https://private.example/', fields: { key: 'temp/server-key' } }
      : { uploadId: 'gallery-upload', status: 'approved' });
  };
  const upload = h.load('src/services/api/photoUpload.ts');
  const asset = { uri: 'content://gallery/original.jpg', type: 'image/jpeg', name: 'photo.jpg' };
  assert.equal(await upload.uploadChatPhoto(asset), 'gallery-upload');
  assert.equal(vaultCalls, 0);
  assert.deepEqual(requests, ['/photos/upload-url', '/photos/confirm']);
  assert.deepEqual(deleted, ['file:///cache/chat-clean.jpg']);
  await upload.cleanupPickedAssets([asset]);
  assert.equal(deleted.includes(asset.uri), false, 'never delete or export the original gallery photo');
  h.runtime.teardownSession();
});

test('timed photo sends carry their one-opening duration without requiring the message TTL flag', async () => {
  const h = harness({ './socketSession': { refreshUnread: async () => {}, getHistory: async () => [] } });
  const me = '111111111111111111111111', other = '222222222222222222222222';
  h.runtime.setSessionIdentity(me, h.token(me));
  let body;
  h.apiClient.defaults.adapter = async (config) => {
    body = JSON.parse(config.data);
    return h.ok(config, { _id: '444444444444444444444444', sender: me, receiver: other,
      sentAt: '2026-10-18T00:00:00Z', viewOnce: true, viewDurationSeconds: 10 });
  };
  const service = h.load('src/features/chat/services/chatService.real.ts').realChatService;
  const sent = await service.sendMessage({ conversationId: `user:${other}`, text: '', clientId: 'timer-photo-1',
    viewDurationSeconds: 10, assets: [{ uri: 'content://photo', type: 'image/jpeg', name: 'photo.jpg' }] });
  assert.equal(body.viewOnce, true);
  assert.equal(body.viewDurationSeconds, 10);
  assert.equal('ttlSeconds' in body, false);
  assert.equal(sent.viewDurationSeconds, 10);
  assert.equal(sent.viewOnce, true);
  h.runtime.teardownSession();
});

test('stale socket and history responses cannot reset an opened photo', () => {
  const h = harness();
  const me = '111111111111111111111111', other = '222222222222222222222222';
  h.runtime.setSessionIdentity(me, h.token(me));
  const chat = h.load('src/features/chat/services/chatState.ts');
  const key = `user:${other}`;
  const message = { id: '444444444444444444444444', conversationId: key, senderId: other,
    text: '', createdAt: '2026-10-18T00:00:00Z', status: 'sent', viewOnce: true };
  chat.mergeMessage({ ...message, viewedAt: '2026-10-18T00:00:10Z' });
  chat.mergeMessage(message);
  let rows = chat.reconcileHistory(key, [message], chat.historyVersion());
  assert.equal(rows[0].viewedAt, '2026-10-18T00:00:10Z');
  h.runtime.teardownSession();
});

function photoViewerHarness(seconds) {
  const hooks = [], effects = [], intervals = new Map();
  let cursor = 0, now = Date.now(), intervalId = 0, background;
  const same = (a, b) => a && b && a.length === b.length && a.every((item, i) => item === b[i]);
  const react = {
    useState(initial) {
      const index = cursor++;
      hooks[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [hooks[index].value, (next) => { hooks[index].value = next; }];
    },
    useRef(initial) { const index = cursor++; return hooks[index] ??= { current: initial }; },
    useCallback(fn, deps) {
      const index = cursor++;
      if (!same(hooks[index]?.deps, deps)) hooks[index] = { value: fn, deps };
      return hooks[index].value;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!same(hooks[index]?.deps, deps)) {
        const previous = hooks[index];
        hooks[index] = { deps };
        effects.push(() => { previous?.cleanup?.(); hooks[index].cleanup = fn(); });
      }
    },
  };
  class Clock extends Date { static now() { return now; } }
  const h = harness({
    react,
    'react-native': { Platform: { OS: 'android' }, Pressable: 'Pressable',
      StyleSheet: { create: (s) => s, hairlineWidth: 1 },
      AppState: { addEventListener: (_name, fn) => { background = fn; return { remove() {} }; } },
    },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/ui': { Text: 'Text' },
    '@/components/ui/Toast': { toast: { error() {} } },
    '@/hooks/useScreenshotProtection': { useScreenshotProtection() {} },
    '@/theme/useTheme': { useTheme: () => ({ theme: { colors: {} } }) },
    '../services/chatState': { acceptMessage() {} },
    './ChatPhotoViewer': { ChatPhotoViewer: 'Viewer' },
    __date: Clock,
    __setInterval: (fn) => { intervals.set(++intervalId, fn); return intervalId; },
    __clearInterval: (id) => intervals.delete(id),
  });
  const me = '111111111111111111111111', other = '222222222222222222222222';
  h.runtime.setSessionIdentity(me, h.token(me));
  let requests = 0;
  h.apiClient.defaults.adapter = async (config) => {
    requests++;
    assert.match(config.url, /\/open$/);
    return h.ok(config, { dataUri: 'data:image/jpeg;base64,/9j/', message: {
      _id: '444444444444444444444444', sender: other, receiver: me,
      sentAt: new Date(now).toISOString(), viewedAt: new Date(now).toISOString(), viewOnce: true,
    } });
  };
  const { ViewOnceAttachment } = h.load('src/features/chat/components/ViewOnceAttachment.tsx');
  const render = () => {
    cursor = 0;
    const tree = ViewOnceAttachment({ messageId: '444444444444444444444444', mine: false,
      media: { _id: '555555555555555555555555', mimetype: 'image/jpeg', status: 'active' },
      viewDurationSeconds: seconds });
    effects.splice(0).forEach((fn) => fn());
    return tree.props.children;
  };
  return { h, render, intervals, requests: () => requests,
    background: () => background('background'),
    advance: (ms) => { now += ms; [...intervals.values()].forEach((fn) => fn()); } };
}

test('view-once viewer blocks double taps and clears in-memory bytes on close', async () => {
  const v = photoViewerHarness();
  const [chip] = v.render();
  chip.props.onPress(); chip.props.onPress();
  await new Promise(setImmediate);
  let [, viewer] = v.render();
  assert.equal(v.requests(), 1);
  assert.equal(viewer.props.uri, 'data:image/jpeg;base64,/9j/');
  viewer.props.onLoad();
  viewer.props.onClose();
  const [closedChip, closedViewer] = v.render();
  assert.equal(closedViewer.props.uri, null);
  assert.equal(closedViewer.props.visible, false);
  closedChip.props.onPress();
  await new Promise(setImmediate);
  assert.equal(v.requests(), 1);
  v.h.runtime.teardownSession();
});

test('timed photo countdown starts after decoding, then clears bytes and prevents reopening', async () => {
  const v = photoViewerHarness(3);
  v.render()[0].props.onPress();
  await new Promise(setImmediate);
  let [, viewer] = v.render();
  assert.equal(v.intervals.size, 0, 'download time is not charged against viewing time');
  viewer.props.onLoad();
  v.render();
  v.advance(3100);
  const [chip, closed] = v.render();
  assert.equal(closed.props.visible, false);
  assert.equal(closed.props.uri, null);
  chip.props.onPress();
  await new Promise(setImmediate);
  assert.equal(v.requests(), 1);
  v.h.runtime.teardownSession();
});

test('backgrounding a restricted photo removes it immediately', async () => {
  const v = photoViewerHarness(10);
  v.render()[0].props.onPress();
  await new Promise(setImmediate);
  assert.equal(v.render()[1].props.visible, true);
  v.background();
  const [, closed] = v.render();
  assert.equal(closed.props.uri, null);
  assert.equal(closed.props.visible, false);
  v.h.runtime.teardownSession();
});

test('release media URLs reject HTTP and file URIs', () => {
  const h = harness();
  const { mediaUrl } = h.load('src/services/api/backend.ts');
  assert.equal(mediaUrl('http://public.example/photo.jpg'), '');
  assert.equal(mediaUrl('file:///private.jpg'), '');
  assert.equal(mediaUrl('https://private.example/photo.jpg'), 'https://private.example/photo.jpg');
});

test('profile photo saves a confirmed upload ID with auth and uses the returned private URL', async () => {
  const h = harness();
  const me = '111111111111111111111111';
  h.runtime.setSessionIdentity(me, h.token(me));
  const requests = [];
  h.apiClient.defaults.adapter = async (config) => {
    requests.push({
      method: config.method,
      url: config.url,
      body: JSON.parse(config.data),
      auth: config.headers.Authorization,
    });
    return h.ok(config, {
      user: { ...h.user, _id: me, avatar: 'https://private.example.test/photo.jpg' },
    });
  };
  const { realProfileService } = h.load('src/features/profile/services/profileService.real.ts');
  const user = await realProfileService.updateAvatar({
    uri: 'file:///cache/picked.jpg',
    type: 'image/jpeg',
    name: 'picked.jpg',
  });
  assert.equal(user.avatarUri, 'https://private.example.test/photo.jpg');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'put');
  assert.equal(requests[0].url, '/users/me/avatar');
  assert.deepEqual(requests[0].body, { uploadId: 'c191eb48-9c83-4996-99c1-01c2af8d9426' });
  assert.ok(requests[0].auth.startsWith('Bearer '));
  assert.equal(JSON.stringify(requests).includes('file:///'), false);
  h.runtime.teardownSession();
});

test('installed Expo fetch rejects URI parts and serializes Expo File bytes', async () => {
  const filename = path.resolve('node_modules/expo/src/winter/fetch/convertFormData.ts');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require: () => ({ blobToArrayBufferAsync: (blob) => blob.arrayBuffer() }),
    Blob,
    TextEncoder,
    Uint8Array,
  });
  const { convertFormDataAsync } = module.exports;
  const legacy = {
    entries: () => [['file', { uri: 'file:///cache/photo.jpg', name: 'photo.jpg' }]],
  };
  await assert.rejects(convertFormDataAsync(legacy), /Unsupported FormDataPart/);
  const file = {
    name: 'photo.jpg',
    type: 'image/jpeg',
    bytes: async () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
  };
  const { body } = await convertFormDataAsync({ entries: () => [['file', file]] });
  const serialized = Buffer.from(body);
  assert.ok(serialized.includes(Buffer.from([0xff, 0xd8, 0xff, 0xe0])));
  assert.ok(serialized.includes(Buffer.from('filename="photo.jpg"')));
});
