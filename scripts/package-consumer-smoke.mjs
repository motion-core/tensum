import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const packageRoot = join(repositoryRoot, "packages", "tensum");
const repositoryManifest = JSON.parse(
  readFileSync(join(repositoryRoot, "package.json"), "utf8"),
);
const packageManifest = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
);
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(label, command, args, cwd) {
  console.log(`\n--> ${label}`);
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, CI: process.env.CI ?? "1" },
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${label} failed with exit code ${result.status ?? "unknown"}`,
    );
  }
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const temporaryRoot = mkdtempSync(join(tmpdir(), "tensum-consumer-"));
const packDirectory = join(temporaryRoot, "pack");
const consumerDirectory = join(temporaryRoot, "consumer");
mkdirSync(packDirectory);
mkdirSync(consumerDirectory);

try {
  run(
    "Pack tensum",
    pnpm,
    ["--filter", "tensum", "pack", "--pack-destination", packDirectory],
    repositoryRoot,
  );

  const tarballs = readdirSync(packDirectory).filter((file) =>
    file.endsWith(".tgz"),
  );
  assert.equal(tarballs.length, 1, "pack must produce exactly one tarball");
  const tarball = join(packDirectory, tarballs[0]);

  writeJson(join(consumerDirectory, "package.json"), {
    name: "tensum-release-consumer",
    private: true,
    type: "module",
    packageManager: repositoryManifest.packageManager,
    dependencies: {
      tensum: `file:${tarball}`,
      gsap: packageManifest.devDependencies.gsap,
    },
    devDependencies: {
      typescript: packageManifest.devDependencies.typescript,
    },
  });

  writeFileSync(
    join(consumerDirectory, "runtime.mjs"),
    `import assert from 'node:assert/strict';
import { gsap } from 'gsap';
import {
  SUPPORTED_PROPERTIES,
  TensumPlugin,
  createMotionSpringTween,
  createSpring,
  springTo,
} from 'tensum';
import { springToCSSLinear } from 'tensum/css';
import { createCoupledSpringSystem } from 'tensum/coupled';

assert.deepEqual(SUPPORTED_PROPERTIES, ['x', 'y', 'scale', 'rotation']);
gsap.registerPlugin(TensumPlugin);
assert.equal(typeof gsap.effects.spring, 'function');

const effectTarget = { x: 0 };
const effectTween = createMotionSpringTween(effectTarget, {
  x: 100,
  from: { x: 0 },
  parameters: { mass: 1, stiffness: 180, damping: 24 },
  tween: { paused: true },
});
assert.equal(effectTween.duration() > 0, true);

const effectTimelineTarget = { x: 0 };
const effectTimeline = gsap.timeline({ paused: true }).spring(
  effectTimelineTarget,
  {
    x: 100,
    from: { x: 0 },
    parameters: { mass: 1, stiffness: 180, damping: 24 },
  },
);
assert.equal(effectTimeline.duration(), effectTween.duration());
effectTimeline.time(effectTimeline.duration(), true);
assert.equal(effectTimeline.getChildren(false, true, false).length, 1);
assert.equal(effectTimelineTarget.x, 100);
assert.equal(typeof effectTimelineTarget.x, 'number');
effectTween.kill();
effectTimeline.kill();

const objectTransformTarget = { x: 0, rotation: 0 };
const objectTransform = springTo(objectTransformTarget, {
  x: 100,
  rotation: 45,
  spring: { mass: 1, stiffness: 180, damping: 24 },
});
objectTransform.pause();
objectTransform.seek(objectTransform.duration);
assert.equal(objectTransformTarget.x, 100);
assert.equal(objectTransformTarget.rotation, 45);
assert.equal(typeof objectTransformTarget.x, 'number');
assert.equal(typeof objectTransformTarget.rotation, 'number');
objectTransform.kill();

const controllerTarget = { score: 0 };
const controller = springTo(controllerTarget, {
  targets: { score: 80 },
  spring: { mass: 1, stiffness: 180, damping: 24 },
});
controller.pause();
controller.seek(controller.duration);
assert.equal(controllerTarget.score, 80);
controller.kill();

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
    join(consumerDirectory, "cjs-contract.cjs"),
    `const assert = require('node:assert/strict');

for (const packageId of [
  'tensum',
  'tensum/css',
  'tensum/coupled',
]) {
  assert.throws(
    () => require(packageId),
    (error) => error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    \`CommonJS require must stay unsupported for \${packageId}\`,
  );
}

(async () => {
  const spring = await import('tensum');
  assert.equal(typeof spring.TensumPlugin, 'object');
  console.log('ESM-only CommonJS contract passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`,
  );

  writeFileSync(
    join(consumerDirectory, "consumer.ts"),
    `import { gsap } from 'gsap';
import {
  TensumPlugin,
  createMotionSpringTween,
  createSpring,
  springTo,
  type MotionSpringEffectTweenVars,
  type MotionSpringEffectVars,
  type MotionSpringVars,
  type AdditiveSpringContributionOptions,
  type AdditiveSpringOptions,
  type SpringParameters,
  type SpringPropertyAdapter,
  type SpringToVars,
  type SpringTweenTarget,
} from 'tensum';
import {
  springToCSSLinear,
  type CSSLinearSpring,
} from 'tensum/css';
import {
  createCoupledSpringSystem,
  type CoupledSpringSystem,
} from 'tensum/coupled';

const parameters: SpringParameters = {
  mass: 1,
  stiffness: 180,
  damping: 24,
};
const springVars: MotionSpringVars = {
  x: 100,
  parameters,
};
const effectTweenVars: MotionSpringEffectTweenVars = {
  paused: true,
  stagger: 0.06,
  repeat: 1,
  repeatDelay: 0.1,
  yoyo: true,
};
const invalidEffectTweenVars: MotionSpringEffectTweenVars = {
  // @ts-expect-error The effect derives and owns its GSAP duration.
  duration: 1,
};
const effectVars: MotionSpringEffectVars = {
  ...springVars,
  from: { x: 0 },
  parameters,
  tween: effectTweenVars,
  unsettled: 'stop',
  onLogicalComplete: (snapshot) => {
    void snapshot.states.x;
  },
};
const adapter: SpringPropertyAdapter = {
  read: (target) => Number((target as { progress: number }).progress),
  write: (target, value) => {
    (target as { progress: number }).progress = value;
  },
};
const resolvedTarget: SpringTweenTarget = { progress: 0 };
const controllerVars: SpringToVars = {
  targets: { progress: 1 },
  spring: parameters,
  adapters: { progress: adapter },
};
const additiveOptions: AdditiveSpringOptions = {
  settle: { position: 0.01 },
};
const additiveContributionOptions: AdditiveSpringContributionOptions = {
  velocity: 10,
};
const invalidAdditiveOptions: AdditiveSpringOptions = {
  // @ts-expect-error Additive values have no logical timing phase.
  timing: { perceptualDuration: 0.2 },
};
// @ts-expect-error SpringTweenTarget represents an already resolved object.
const unresolvedTarget: SpringTweenTarget = '.selector';

gsap.registerPlugin(TensumPlugin);
const effectTween = createMotionSpringTween({ x: 0 }, effectVars);
const effectTimeline = gsap.timeline({ paused: true }).spring(
  { x: 0 },
  effectVars,
);
const controller = springTo(resolvedTarget, controllerVars);
const spring = createSpring({ from: 0, to: 1, ...parameters });
const css: CSSLinearSpring = springToCSSLinear(spring);
const coupled: CoupledSpringSystem = createCoupledSpringSystem({
  particles: [{ mass: 1, position: 0 }],
  connections: [],
});

void invalidEffectTweenVars;
void additiveOptions;
void additiveContributionOptions;
void invalidAdditiveOptions;
void effectTween;
void effectTimeline;
void controller;
void unresolvedTarget;
void css;
void coupled;
`,
  );

  const sharedCompilerOptions = {
    strict: true,
    target: "ES2022",
    noEmit: true,
    skipLibCheck: false,
    lib: ["ES2022", "DOM", "DOM.Iterable"],
  };
  const typeScriptConfigurations = [
    ["Node16", { module: "Node16", moduleResolution: "Node16" }],
    ["NodeNext", { module: "NodeNext", moduleResolution: "NodeNext" }],
    ["Bundler", { module: "ESNext", moduleResolution: "Bundler" }],
  ];

  for (const [name, compilerOptions] of typeScriptConfigurations) {
    writeJson(join(consumerDirectory, `tsconfig.${name.toLowerCase()}.json`), {
      compilerOptions: { ...sharedCompilerOptions, ...compilerOptions },
      include: ["consumer.ts"],
    });
  }

  run(
    "Install the tarball in a clean consumer",
    pnpm,
    ["install", "--ignore-scripts", "--lockfile=false"],
    consumerDirectory,
  );

  const installedPackage = join(consumerDirectory, "node_modules", "tensum");
  assert.equal(existsSync(join(installedPackage, "LICENSE")), true);
  assert.equal(existsSync(join(installedPackage, "CHANGELOG.md")), true);
  assert.equal(existsSync(join(installedPackage, "src", "index.ts")), true);
  assert.equal(existsSync(join(installedPackage, "tests")), false);
  assert.equal(existsSync(join(installedPackage, "benchmarks")), false);
  const installedManifest = JSON.parse(
    readFileSync(join(installedPackage, "package.json"), "utf8"),
  );
  assert.equal(installedManifest.license, "MIT");
  assert.equal(installedManifest.type, "module");
  assert.equal(installedManifest.types, "./dist/index.d.ts");
  assert.equal(
    installedManifest.engines.node,
    "^20.19.0 || ^22.12.0 || ^24.0.0",
  );
  assert.deepEqual(installedManifest.exports["."], {
    types: "./dist/index.d.ts",
    import: "./dist/index.js",
  });

  for (const artifact of ["index.js", "index.d.ts"]) {
    const artifactPath = join(installedPackage, "dist", artifact);
    const artifactSource = readFileSync(artifactPath, "utf8");
    const sourceMapReference = artifactSource.match(
      /\/\/# sourceMappingURL=([^\s]+)/,
    )?.[1];
    assert.ok(sourceMapReference, `${artifact} must reference a source map`);
    const sourceMapPath = resolve(dirname(artifactPath), sourceMapReference);
    assert.equal(existsSync(sourceMapPath), true);
    const sourceMap = JSON.parse(readFileSync(sourceMapPath, "utf8"));
    assert.equal(sourceMap.file, artifact);
    assert.deepEqual(sourceMap.sources, ["../src/index.ts"]);
    for (const source of sourceMap.sources) {
      assert.equal(
        existsSync(
          resolve(dirname(sourceMapPath), sourceMap.sourceRoot ?? "", source),
        ),
        true,
        `${artifact} source map must resolve ${source}`,
      );
    }
  }

  run("Run ESM exports", process.execPath, ["runtime.mjs"], consumerDirectory);
  run(
    "Verify the ESM-only CommonJS contract",
    process.execPath,
    ["cjs-contract.cjs"],
    consumerDirectory,
  );

  for (const [name] of typeScriptConfigurations) {
    run(
      `Resolve declarations with TypeScript ${name}`,
      pnpm,
      ["exec", "tsc", "--project", `tsconfig.${name.toLowerCase()}.json`],
      consumerDirectory,
    );
  }

  console.log("\nPacked package consumer checks passed.");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
