import { performance } from 'node:perf_hooks';
import { createSpring, createVectorSpring } from '../dist/index.js';

const parameters = { mass: 1, stiffness: 180, damping: 24 };
let checksum = 0;

function measure(name, operationsPerRound, rounds, run) {
  run();
  const startedAt = performance.now();
  for (let round = 0; round < rounds; round += 1) run();
  const elapsedMs = performance.now() - startedAt;
  const operations = operationsPerRound * rounds;
  return {
    name,
    operations,
    elapsedMs: Number(elapsedMs.toFixed(3)),
    nanosecondsPerOperation: Number(((elapsedMs * 1e6) / operations).toFixed(2)),
  };
}

const underdamped = createSpring({
  from: 0,
  to: 500,
  velocity: 300,
  ...parameters,
  damping: 8,
});
const critical = createSpring({
  from: 0,
  to: 500,
  velocity: 300,
  ...parameters,
  damping: 2 * Math.sqrt(parameters.mass * parameters.stiffness),
});
const overdamped = createSpring({
  from: 0,
  to: 500,
  velocity: 300,
  ...parameters,
  damping: 60,
});

function sampleSolution(solution) {
  let time = 0;
  return () => {
    for (let index = 0; index < 10_000; index += 1) {
      time = (index % 240) / 120;
      const state = solution.stateAt(time);
      checksum += state.position + state.velocity;
    }
  };
}

const results = [
  measure('stateAt underdamped', 10_000, 50, sampleSolution(underdamped)),
  measure('stateAt critical', 10_000, 50, sampleSolution(critical)),
  measure('stateAt overdamped', 10_000, 50, sampleSolution(overdamped)),
  measure('create + settling', 1_000, 10, () => {
    for (let index = 1; index <= 1_000; index += 1) {
      checksum += createSpring({
        from: 0,
        to: index,
        velocity: index,
        ...parameters,
      }).getSettlingDuration();
    }
  }),
];

for (const count of [1, 100, 1_000, 10_000]) {
  const springs = Array.from({ length: count }, (_, index) =>
    createSpring({
      from: 0,
      to: index + 1,
      velocity: index % 500,
      ...parameters,
    }),
  );
  results.push(
    measure(`parallel stateAt x${count}`, count, Math.max(10, 100_000 / count), () => {
      for (const spring of springs) checksum += spring.positionAt(0.25);
    }),
  );
}

results.push(
  measure('retarget', 1_000, 10, () => {
    for (let index = 0; index < 1_000; index += 1) {
      checksum += underdamped.retarget(index, 0.25).velocityAt(0);
    }
  }),
);

const vector = createVectorSpring({
  from: [0, 0, 0, 0],
  to: [100, 200, 300, 400],
  velocity: [10, 20, 30, 40],
  parameters,
});
const output = { position: [0, 0, 0, 0], velocity: [0, 0, 0, 0] };
results.push(
  measure('vector stateAt allocation', 10_000, 20, () => {
    for (let index = 0; index < 10_000; index += 1) {
      checksum += vector.stateAt(0.25).position[0];
    }
  }),
  measure('vector stateAtInto reuse', 10_000, 20, () => {
    for (let index = 0; index < 10_000; index += 1) {
      vector.stateAtInto(0.25, output);
      checksum += output.position[0];
    }
  }),
);

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
