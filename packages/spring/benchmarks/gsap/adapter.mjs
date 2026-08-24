import { performance } from 'node:perf_hooks';
import { gsap } from 'gsap';
import { springTo } from '../../dist/index.js';

gsap.ticker.sleep();

const parameters = { mass: 1, stiffness: 180, damping: 24 };
let checksum = 0;

function percentile(sorted, quantile) {
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * quantile) - 1),
  );
  return sorted[index];
}

function measure({
  name,
  operationsPerSample,
  run,
  samples,
  workUnitsPerOperation = 1,
}) {
  const microsecondsPerOperation = [];
  let elapsedMs = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const startedAt = performance.now();
    for (let operation = 0; operation < operationsPerSample; operation += 1) {
      run();
    }
    const sampleElapsedMs = performance.now() - startedAt;
    elapsedMs += sampleElapsedMs;
    microsecondsPerOperation.push(
      (sampleElapsedMs * 1e3) / operationsPerSample,
    );
  }

  const sorted = [...microsecondsPerOperation].sort(
    (first, second) => first - second,
  );
  const median = percentile(sorted, 0.5);
  const p95 = percentile(sorted, 0.95);
  const operations = operationsPerSample * samples;
  return {
    name,
    samples,
    operations,
    workUnitsPerOperation,
    totalWorkUnits: operations * workUnitsPerOperation,
    elapsedMs: Number(elapsedMs.toFixed(3)),
    // Kept as an alias for consumers of the previous single-sample format.
    microsecondsPerOperation: Number(median.toFixed(2)),
    medianMicrosecondsPerOperation: Number(median.toFixed(2)),
    p95MicrosecondsPerOperation: Number(p95.toFixed(2)),
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
    operationsPerSample: 2_000,
    samples: 21,
    warmupOperations: 500,
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
    operationsPerSample: 2_000,
    samples: 21,
    warmupOperations: 500,
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
    operationsPerSample: 2_000,
    samples: 21,
    warmupOperations: 500,
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
  {
    name: 'springTo automatic handoff + seek',
    operationsPerSample: 1_000,
    samples: 21,
    warmupOperations: 250,
    run: () => {
      const target = { nested: { progress: 0 } };
      const first = springTo(target, {
        targets: { progress: 1 },
        velocity: { progress: 2 },
        spring: parameters,
        adapters: customAdapter,
      });
      first.seek(0.1);
      const second = springTo(target, {
        targets: { progress: -1 },
        spring: parameters,
        adapters: customAdapter,
      });
      second.seek(0.15);
      checksum += target.nested.progress;
      second.kill();
      first.kill();
    },
  },
  {
    name: 'springTo 1,000 completed retargets',
    operationsPerSample: 1,
    samples: 15,
    warmupOperations: 1,
    workUnitsPerOperation: 1_000,
    run: () => {
      const target = { progress: 0 };
      let controller;
      for (let index = 0; index < 1_000; index += 1) {
        controller = springTo(target, {
          targets: { progress: index % 2 === 0 ? 1 : -1 },
          spring: parameters,
        });
        controller.seek(controller.duration);
        checksum += target.progress;
      }
      controller.kill();
    },
  },
];

for (const benchmark of cases) {
  for (let warmup = 0; warmup < benchmark.warmupOperations; warmup += 1) {
    benchmark.run();
  }
}

const results = cases.map(measure);

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
