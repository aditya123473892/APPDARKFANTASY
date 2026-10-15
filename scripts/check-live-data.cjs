// Local development smoke check. Never prints credentials, tokens, profiles or message content.
const { io } = require('socket.io-client');
async function main() {
  const base = process.env.CHECK_API_URL || 'http://127.0.0.1:9000/api';
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin@darkfantasy.local', password: 'Test1234@' }),
  }).then((r) => r.json());
  if (!login.data?.accessToken) throw new Error('Local test account login failed');
  const token = login.data.accessToken;
  const get = async (path) => {
    const response = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();
    console.log(
      path,
      'HTTP',
      response.status,
      'envelope',
      body.statusCode,
      'data keys',
      Object.keys(body.data ?? {}),
    );
    if (!response.ok || body.error) throw new Error(`Read failed: ${path}`);
    return body.data;
  };
  const users = await get('/users?limit=50&skip=0');
  const posts = await get('/posts/public/feeds?limit=50&skip=0');
  await get('/posts/private/me?limit=50&skip=0');
  const groups = await get('/groups/my-groups');
  await get('/users/chatlist');
  await get('/users/follow/follow-requests');
  console.log(
    'Counts:',
    JSON.stringify({ users: users.count, posts: posts.count, groups: groups.length }),
  );
  if (posts.posts?.length)
    console.log(
      'Post fields:',
      Object.keys(posts.posts[0]),
      'author fields:',
      Object.keys(posts.posts[0].user ?? {}),
    );
  const socket = io(new URL(base).origin, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
  });
  const once = (event) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Socket timeout: ${event}`)), 10000);
      socket.once(event, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  try {
    await once('connect');
    const unread = once('unreadMessageCount');
    socket.emit('getUnreadCount');
    console.log('Socket unread rows:', (await unread).length);
    const other = users.users.find((u) => u._id !== login.data.user._id);
    if (other) {
      const history = once('chatHistory');
      socket.emit('getChatHistory', { user2: other._id });
      console.log('Socket direct history rows:', (await history).length);
    }
    if (groups.length) {
      await get(`/groups/${groups[0]._id}/members`);
      const history = once('groupChatHistory');
      socket.emit('getGroupChatHistory', { groupId: groups[0]._id });
      console.log('Socket group history rows:', (await history).length);
    }
  } finally {
    socket.disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
