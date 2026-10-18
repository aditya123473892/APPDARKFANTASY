import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvFile } from 'node:process';

process.env.EXPO_NO_DOTENV = '1';
if (existsSync('.env.mobile')) loadEnvFile('.env.mobile');
// Dev opt-in is only provided by this launcher for interactive Metro sessions.
if (process.argv[2] === 'start' && !process.env.EAS_BUILD_PROFILE)
  process.env.APP_VARIANT ??= 'development';

const expoCli = join('node_modules', 'expo', 'bin', 'cli');
const args = process.argv.slice(2);
// Default to Expo Go for the simpler vault; developers can still opt into --dev-client.
if (args[0] === 'start' && !args.includes('--dev-client') && !args.includes('--go'))
  args.push('--go');
const child = spawn(process.execPath, [expoCli, ...args], {
  stdio: 'inherit',
  env: process.env,
});
child.on('exit', (code) => process.exit(code ?? 1));
