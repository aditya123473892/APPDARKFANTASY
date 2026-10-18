const { spawn } = require('node:child_process');
const path = require('node:path');
const { loadEnvFile } = require('node:process');
const { existsSync } = require('node:fs');
process.env.EXPO_NO_DOTENV = '1';
if (existsSync('.env.mobile')) loadEnvFile('.env.mobile');
process.env.APP_VARIANT = 'development';
process.env.EXPO_PUBLIC_API_URL ||= 'http://10.0.2.2:9000/api';
// The EAS profile can override this API URL; never load server .env into a mobile build.
const cli = path.join(process.env.APPDATA, 'npm/node_modules/eas-cli/bin/run');
const args = process.argv.slice(2);
const child = spawn(process.execPath, [cli, ...args], { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 1));
