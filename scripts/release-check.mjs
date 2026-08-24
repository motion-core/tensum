import { spawnSync } from 'node:child_process';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function run(label, command, args) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, CI: process.env.CI ?? '1' },
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${label} failed with exit code ${result.status ?? 'unknown'}`,
    );
  }
}

const steps = [
  ['Build all workspaces', pnpm, ['build']],
  ['Type-check all workspaces', pnpm, ['check']],
  ['Run all tests', pnpm, ['test']],
  ['Run Chromium integration tests', pnpm, ['test:browser']],
  ['Lint all workspaces', pnpm, ['lint']],
  [
    'Validate the package manifest',
    pnpm,
    ['exec', 'publint', 'packages/spring'],
  ],
  ['Test the packed package in a clean consumer', pnpm, ['release:consumer']],
];

for (const [label, command, args] of steps) run(label, command, args);

console.log('\nLocal release checks passed. No package was published.');
