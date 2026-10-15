function validateAuthBuild(env, { development = false } = {}) {
  const value = env.EXPO_PUBLIC_API_URL || (development ? 'http://localhost:9000/api' : '');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL must be configured');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid API URL');
  if (!development && url.protocol !== 'https:')
    throw new Error('Release builds require an HTTPS API URL');
  const enabled = env.EXPO_PUBLIC_SSL_PINNING_ENABLED === 'true';
  const pins = (env.EXPO_PUBLIC_SSL_PINS || '')
    .split(',')
    .map((pin) => pin.trim())
    .filter(Boolean);
  if (
    !development &&
    enabled &&
    (new Set(pins).size < 2 || pins.some((pin) => !/^[A-Za-z0-9+/]{43}=$/.test(pin)))
  )
    throw new Error('Pinning requires at least two distinct SHA-256 SPKI pins');
  const idle = Number(env.EXPO_PUBLIC_AUTH_BACKGROUND_TIMEOUT_MINUTES || 0);
  if (!Number.isFinite(idle) || idle < 0) throw new Error('Invalid background timeout');
  return { url: value, development };
}
module.exports = { validateAuthBuild };
