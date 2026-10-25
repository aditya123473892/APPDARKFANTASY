const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const config = getSentryExpoConfig(__dirname);
// expo-sqlite's web worker imports its WASM binary as an asset.
if (!config.resolver.assetExts.includes('wasm')) config.resolver.assetExts.push('wasm');
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // noble-hashes 1.x's browser map redirects ./crypto to the unexported
  // ./crypto.js subpath. Let its conditional exports select WebCrypto instead.
  if (moduleName === '@noble/hashes/crypto') {
    context = {
      ...context,
      mainFields: context.mainFields.filter((field) => field !== 'browser'),
    };
  }
  return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};
// File-map snapshots use V8 serialization, which can differ between Node runtimes.
// Keep separate caches when starting Expo with system or portable Node installs.
config.fileMapCacheDirectory = path.join(
  os.tmpdir(),
  'darkfantasy-metro-file-map',
  `${process.versions.node}-${process.versions.v8}`,
);
fs.mkdirSync(config.fileMapCacheDirectory, { recursive: true });
if (process.env.EXPO_DEV_API_PROXY === 'true' && process.env.APP_VARIANT === 'development') {
  const { createDevApiProxy } = require('./scripts/dev-api-proxy.cjs');
  const backendPort = Number(process.env.EXPO_DEV_API_PORT || 9000);
  const backendHost = process.env.EXPO_DEV_API_HOST || '127.0.0.1';
  if (!Number.isInteger(backendPort) || backendPort < 1 || backendPort > 65535)
    throw new Error('EXPO_DEV_API_PORT must be an integer between 1 and 65535');
  const enhance = config.server.enhanceMiddleware;
  config.server.enhanceMiddleware = (middleware, server) =>
    createDevApiProxy(enhance ? enhance(middleware, server) : middleware, backendPort, backendHost);
}
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const existing = config.resolver.blockList;
// These are separate server/desktop projects, not mobile dependencies.
const folders = [
  'backenddf',
  'Df-Fortend-pm-fe',
  'darkfantasy-runtime',
  'darkfantasy-share',
  'mongo-init',
  '.npm-cache',
];
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  ...folders.map(
    (folder) => new RegExp(`^${escape(path.resolve(__dirname, folder))}(?:[/\\\\].*)?$`),
  ),
];
module.exports = config;
