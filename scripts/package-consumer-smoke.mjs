import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const packageRoot = join(repositoryRoot, 'packages', 'spring');
const repositoryManifest = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
);
const packageManifest = JSON.parse(
  readFileSync(join(packageRoot, 'package.json'), 'utf8'),
);
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function run(label, command, args, cwd) {
  console.log(`\n--> ${label}`);
  const result = spawnSync(command, args, {
    cwd,
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

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const temporaryRoot = mkdtempSync(
  join(tmpdir(), 'motion-core-spring-consumer-'),
);
const packDirectory = join(temporaryRoot, 'pack');
const consumerDirectory = join(temporaryRoot, 'consumer');
mkdirSync(packDirectory);
mkdirSync(consumerDirectory);

try {
  run(
    'Pack @motion-core/spring',
    pnpm,
    [
      '--filter',
      '@motion-core/spring',
      'pack',
      '--pack-destination',
      packDirectory,
    ],
    repositoryRoot,
  );

  const tarballs = readdirSync(packDirectory).filter((file) =>
    file.endsWith('.tgz'),
  );
  assert.equal(tarballs.length, 1, 'pack must produce exactly one tarball');
  const tarball = join(packDirectory, tarballs[0]);

  writeJson(join(consumerDirectory, 'package.json'), {
    name: 'motion-core-spring-release-consumer',
    private: true,
    type: 'module',
    packageManager: repositoryManifest.packageManager,
    dependencies: {
      '@motion-core/spring': `file:${tarball}`,
      gsap: packageManifest.devDependencies.gsap,
    },
    devDependencies: {
      typescript: packageManifest.devDependencies.typescript,
    },
  });

  writeFileSync(
    join(consumerDirectory, 'runtime.mjs'),
    `import assert from 'node:assert/strict';
import { SpringPlugin, createSpring } from '@motion-core/spring';
import { springToCSSLinear } from '@motion-core/spring/css';
import { createCoupledSpringSystem } from '@motion-core/spring/coupled';

assert.equal(SpringPlugin.name, 'motionSpring');

const spring = createSpring({
  from: 0,
  to: 100,
  mass: 1,
  stiffness: 180,
  damping: 24,
});
assert.equal(Number.isFinite(spring.positionAt(0.2)), true);
assert.equal(springToCSSLinear(spring).easing.startsWith('linear('), true);

const coupled = createCoupledSpringSystem({
  particles: [
    {
      mass: 1,
      position: 0,
      anchor: { target: 1, stiffness: 120, damping: 18 },
    },
  ],
  connections: [],
});
assert.equal(coupled.stateAt(0.1).position.length, 1);

console.log('ESM runtime exports passed.');
`,
  );

  writeFileSync(
    join(consumerDirectory, 'cjs-contract.cjs'),
    `const assert = require('node:assert/strict');

for (const packageId of [
  '@motion-core/spring',
  '@motion-core/spring/css',
  '@motion-core/spring/coupled',
]) {
  assert.throws(
    () => require(packageId),
    (error) => error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    \`CommonJS require must stay unsupported for \${packageId}\`,
  );
}

(async () => {
  const spring = await import('@motion-core/spring');
  assert.equal(spring.SpringPlugin.name, 'motionSpring');
  console.log('ESM-only CommonJS contract passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`,
  );

  writeFileSync(
    join(consumerDirectory, 'consumer.ts'),
    `import { gsap } from 'gsap';
import {
  SpringPlugin,
  createSpring,
  type MotionSpringPluginVars,
  type SpringParameters,
} from '@motion-core/spring';
import {
  springToCSSLinear,
  type CSSLinearSpring,
} from '@motion-core/spring/css';
import {
  createCoupledSpringSystem,
  type CoupledSpringSystem,
} from '@motion-core/spring/coupled';

const parameters: SpringParameters = {
  mass: 1,
  stiffness: 180,
  damping: 24,
};
const pluginVars: MotionSpringPluginVars = {
  x: 100,
  parameters,
};
const tweenVars: gsap.TweenVars = { motionSpring: pluginVars };

gsap.registerPlugin(SpringPlugin);
const spring = createSpring({ from: 0, to: 1, ...parameters });
const css: CSSLinearSpring = springToCSSLinear(spring);
const coupled: CoupledSpringSystem = createCoupledSpringSystem({
  particles: [{ mass: 1, position: 0 }],
  connections: [],
});

void tweenVars;
void css;
void coupled;
`,
  );

  const sharedCompilerOptions = {
    strict: true,
    target: 'ES2022',
    noEmit: true,
    skipLibCheck: false,
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
  };
  const typeScriptConfigurations = [
    ['Node16', { module: 'Node16', moduleResolution: 'Node16' }],
    ['NodeNext', { module: 'NodeNext', moduleResolution: 'NodeNext' }],
    ['Bundler', { module: 'ESNext', moduleResolution: 'Bundler' }],
  ];

  for (const [name, compilerOptions] of typeScriptConfigurations) {
    writeJson(join(consumerDirectory, `tsconfig.${name.toLowerCase()}.json`), {
      compilerOptions: { ...sharedCompilerOptions, ...compilerOptions },
      include: ['consumer.ts'],
    });
  }

  run(
    'Install the tarball from the local pnpm store',
    pnpm,
    ['install', '--offline', '--ignore-scripts', '--lockfile=false'],
    consumerDirectory,
  );

  const installedPackage = join(
    consumerDirectory,
    'node_modules',
    '@motion-core',
    'spring',
  );
  assert.equal(existsSync(join(installedPackage, 'LICENSE')), true);
  assert.equal(existsSync(join(installedPackage, 'CHANGELOG.md')), true);
  assert.equal(existsSync(join(installedPackage, 'src', 'index.ts')), true);
  assert.equal(existsSync(join(installedPackage, 'tests')), false);
  assert.equal(existsSync(join(installedPackage, 'benchmarks')), false);
  const installedManifest = JSON.parse(
    readFileSync(join(installedPackage, 'package.json'), 'utf8'),
  );
  assert.equal(installedManifest.license, 'MIT');

  run('Run ESM exports', process.execPath, ['runtime.mjs'], consumerDirectory);
  run(
    'Verify the ESM-only CommonJS contract',
    process.execPath,
    ['cjs-contract.cjs'],
    consumerDirectory,
  );

  for (const [name] of typeScriptConfigurations) {
    run(
      `Resolve declarations with TypeScript ${name}`,
      pnpm,
      ['exec', 'tsc', '--project', `tsconfig.${name.toLowerCase()}.json`],
      consumerDirectory,
    );
  }

  console.log('\nPacked package consumer checks passed.');
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
