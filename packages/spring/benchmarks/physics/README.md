# Spring benchmark baseline

Run from the repository root:

```bash
pnpm benchmark
```

The command builds `@motion-core/spring`, then measures closed-form sampling,
settling construction, parallel batches, retargeting, and vector buffer reuse.
It prints machine-readable JSON. Results are a local comparison baseline, not a
CI pass/fail threshold: CPU power management and concurrent desktop work can
move microbenchmarks substantially.

The first recorded baseline was captured on Node 22 arm64 in August 2026. The
exact output is kept in `baseline-node22-arm64.json`. Compare changes on the
same machine and runtime, using several runs rather than a single outlier.
