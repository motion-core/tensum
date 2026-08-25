import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
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

function exactVersion(specifier, dependency) {
  const match = /^(?:\^|~|>=)?\s*(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(
    specifier,
  );
  if (!match) {
    throw new TypeError(
      `${dependency} must have a single explicit lower-bound version; received ${specifier}`,
    );
  }
  return match[1];
}

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

const peerRange = packageManifest.peerDependencies.gsap;
const minimumGsap = exactVersion(peerRange, "GSAP peer dependency");
const typescriptVersion = exactVersion(
  packageManifest.devDependencies.typescript,
  "TypeScript dev dependency",
);
const matrix = [
  { label: "minimum peer", specifier: minimumGsap },
  { label: "npm latest", specifier: "latest" },
];
const temporaryRoot = mkdtempSync(join(tmpdir(), "tensum-gsap-compat-"));
const packDirectory = join(temporaryRoot, "pack");
mkdirSync(packDirectory);

const runtimeSource = `import assert from 'node:assert/strict';
import { gsap } from 'gsap';
import {
  createMotionSpringTween,
  registerSpringPlugin,
  springTo,
} from 'tensum';

const parameters = { mass: 1, stiffness: 180, damping: 24 };

registerSpringPlugin(gsap);
assert.equal(typeof gsap.effects.motionSpring, 'function');

const controllerTarget = { score: 0 };
const controller = springTo(controllerTarget, {
  targets: { score: 80 },
  spring: parameters,
});
controller.pause();
controller.seek(controller.duration);
assert.equal(controllerTarget.score, 80);
controller.kill();

const effectTarget = { score: 0 };
const effectTween = createMotionSpringTween(effectTarget, {
  values: { score: 60 },
  from: { score: 0 },
  parameters,
  tween: { paused: true },
});
const timelineTarget = { score: 0 };
const timeline = gsap.timeline({ paused: true }).motionSpring(
  timelineTarget,
  {
    values: { score: 60 },
    from: { score: 0 },
    parameters,
  },
);
assert.equal(timeline.duration(), effectTween.duration());
timeline.time(timeline.duration(), true);
assert.equal(timelineTarget.score, 60);
effectTween.kill();
timeline.kill();

console.log('GSAP runtime compatibility passed.');
`;

const typeSource = `import { gsap } from 'gsap';
import {
  createMotionSpringTween,
  registerSpringPlugin,
  springTo,
  type MotionSpringEffectVars,
  type MotionSpringVars,
  type SpringController,
  type SpringTweenTarget,
} from 'tensum';

const parameters = { mass: 1, stiffness: 180, damping: 24 };
const springVars: MotionSpringVars = {
  values: { score: 100 },
  parameters,
};
const effectVars: MotionSpringEffectVars = {
  ...springVars,
  from: { score: 0 },
  parameters,
  tween: { paused: true },
};
const target: SpringTweenTarget = { score: 0 };

registerSpringPlugin(gsap);
const controller: SpringController = springTo(target, {
  targets: { score: 100 },
  spring: parameters,
});
const effect = createMotionSpringTween(target, effectVars);
const timeline: gsap.core.Timeline = gsap
  .timeline({ paused: true })
  .motionSpring(target, effectVars);

void controller;
void effect;
void timeline;
`;

try {
  run(
    "Pack tensum once for the compatibility matrix",
    pnpm,
    ["--filter", "tensum", "pack", "--pack-destination", packDirectory],
    repositoryRoot,
  );

  const tarballs = readdirSync(packDirectory).filter((file) =>
    file.endsWith(".tgz"),
  );
  assert.equal(tarballs.length, 1, "pack must produce exactly one tarball");
  const tarball = join(packDirectory, tarballs[0]);
  const results = [];

  for (const [index, entry] of matrix.entries()) {
    const consumerDirectory = join(temporaryRoot, `consumer-${index + 1}`);
    mkdirSync(consumerDirectory);
    writeJson(join(consumerDirectory, "package.json"), {
      name: `tensum-gsap-${entry.label.replaceAll(" ", "-")}`,
      private: true,
      type: "module",
      packageManager: repositoryManifest.packageManager,
      dependencies: {
        tensum: `file:${tarball}`,
        gsap: entry.specifier,
      },
      devDependencies: { typescript: typescriptVersion },
    });
    writeFileSync(join(consumerDirectory, "runtime.mjs"), runtimeSource);
    writeFileSync(join(consumerDirectory, "consumer.ts"), typeSource);
    writeJson(join(consumerDirectory, "tsconfig.json"), {
      compilerOptions: {
        strict: true,
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        noEmit: true,
        skipLibCheck: false,
        lib: ["ES2022", "DOM", "DOM.Iterable"],
      },
      include: ["consumer.ts"],
    });

    run(
      `Install GSAP ${entry.label} (${entry.specifier})`,
      pnpm,
      [
        "install",
        "--prefer-offline",
        "--ignore-scripts",
        "--lockfile=false",
        "--strict-peer-dependencies",
      ],
      consumerDirectory,
    );

    const installedGsapManifest = JSON.parse(
      readFileSync(
        join(consumerDirectory, "node_modules", "gsap", "package.json"),
        "utf8",
      ),
    );
    if (entry.label === "minimum peer") {
      assert.equal(installedGsapManifest.version, minimumGsap);
    }

    run(
      `Run Node ESM smoke with GSAP ${installedGsapManifest.version}`,
      process.execPath,
      ["runtime.mjs"],
      consumerDirectory,
    );
    run(
      `Resolve TypeScript against GSAP ${installedGsapManifest.version}`,
      pnpm,
      ["exec", "tsc", "--project", "tsconfig.json"],
      consumerDirectory,
    );
    results.push({
      label: entry.label,
      version: installedGsapManifest.version,
    });
  }

  console.log("\nGSAP compatibility matrix passed:");
  for (const result of results) {
    console.log(`- ${result.label}: ${result.version}`);
  }
  console.log("No package was published.");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
