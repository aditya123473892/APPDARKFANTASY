const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
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
