// Deep links never supply arbitrary post-login destinations or navigation params.
const allowed = new Set(['/login', '/welcome', '/discover', '/matches', '/chats', '/profile']);
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (path.length > 2048 || /[\\\u0000-\u001f]/.test(path)) return '/login';
    if (path.startsWith('/') && !path.startsWith('//')) {
      const target = new URL(path, 'https://local.invalid');
      return allowed.has(target.pathname) ? target.pathname : '/login';
    }
    const target = new URL(path);
    if (target.protocol !== 'darkfantasy:' || target.username || target.password || target.port)
      return '/login';
    const route = `/${target.hostname}${target.pathname}`.replace(/\/$/, '');
    return allowed.has(route) ? route : '/login';
  } catch {
    return '/login';
  }
}
