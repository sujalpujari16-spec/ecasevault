import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Run ensure-env.js first synchronously
const ensureEnv = spawn(process.execPath, [path.join(__dirname, 'ensure-env.js')], {
  cwd: rootDir,
  stdio: 'inherit',
});

ensureEnv.on('close', () => {
  console.log('================================================================');
  console.log('  e-CASEVAULT — Maharashtra Police Digital Evidence Management  ');
  console.log('  Starting Full Stack (Frontend + Backend API) in Antigravity... ');
  console.log('================================================================');

  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';

  // 1. Start Backend Express API (Port 5001)
  const server = spawn(npmCmd, ['run', 'dev:server'], {
    cwd: rootDir,
    env: { ...process.env, PORT: process.env.PORT || '5001' },
    shell: true,
  });

  server.stdout.on('data', (data) => {
    process.stdout.write(`\x1b[36m[API 5001]\x1b[0m ${data}`);
  });

  server.stderr.on('data', (data) => {
    process.stderr.write(`\x1b[33m[API 5001]\x1b[0m ${data}`);
  });

  // 2. Start Frontend Vite (Port 3000)
  const client = spawn(npmCmd, ['run', 'dev:client'], {
    cwd: rootDir,
    env: { ...process.env },
    shell: true,
  });

  client.stdout.on('data', (data) => {
    process.stdout.write(`\x1b[32m[VITE 3000]\x1b[0m ${data}`);
  });

  client.stderr.on('data', (data) => {
    process.stderr.write(`\x1b[35m[VITE 3000]\x1b[0m ${data}`);
  });

  const cleanup = () => {
    console.log('\n[e-CASEVAULT] Shutting down frontend and backend...');
    try {
      if (server.pid) process.kill(-server.pid, 'SIGINT');
    } catch {
      server.kill('SIGINT');
    }
    try {
      if (client.pid) process.kill(-client.pid, 'SIGINT');
    } catch {
      client.kill('SIGINT');
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
});
