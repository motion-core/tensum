import { performance } from 'node:perf_hooks';
import { gsap } from 'gsap';
import { springTo } from '../dist/index.js';

gsap.ticker.sleep();

const parameters = { mass: 1, stiffness: 180, damping: 24 };
let checksum = 0;

function measure(name, operations, run) {
  const startedAt = performance.now();
  for (let operation = 0; operation < operations; operation += 1) run();
  const elapsedMs = performance.now() - startedAt;
  return {
    name,
    operations,
    elapsedMs: Number(elapsedMs.toFixed(3)),
    microsecondsPerOperation: Number(((elapsedMs * 1e3) / operations).toFixed(2)),
  };
}

const customAdapter = {
  progress: {
    read: (subject) => subject.nested.progress,
    write: (subject, value) => {
      subject.nested.progress = value;
    },
  },
};

const cases = [
  {
    name: 'springTo GSAP property + seek',
    run: () => {
      const target = { progress: 0 };
      const controller = springTo(target, {
        targets: { progress: 1 },
        spring: parameters,
      });
      controller.seek(0.15);
      checksum += target.progress;
      controller.kill();
    },
  },
  {
    name: 'springTo custom adapter + seek',
    run: () => {
      const target = { nested: { progress: 0 } };
      const controller = springTo(target, {
        targets: { progress: 1 },
        spring: parameters,
        adapters: customAdapter,
      });
      controller.seek(0.15);
      checksum += target.nested.progress;
      controller.kill();
    },
  },
  {
    name: 'springTo custom adapter + callback + seek',
    run: () => {
      const target = { nested: { progress: 0 } };
      const controller = springTo(target, {
        targets: { progress: 1 },
        spring: parameters,
        adapters: customAdapter,
        onUpdate(snapshot) {
          checksum += snapshot.states.progress?.velocity ?? 0;
        },
      });
      controller.seek(0.15);
      checksum += target.nested.progress;
      controller.kill();
    },
  },
];

for (let warmup = 0; warmup < 1_000; warmup += 1) {
  for (const benchmark of cases) benchmark.run();
}

const results = cases.map(({ name, run }) => measure(name, 50_000, run));

console.log(
  JSON.stringify(
    {
      runtime: `${process.release.name} ${process.version} ${process.platform} ${process.arch}`,
      results,
      checksum: Number(checksum.toFixed(3)),
    },
    null,
    2,
  ),
);
