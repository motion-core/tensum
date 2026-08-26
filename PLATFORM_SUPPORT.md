# Platform support baseline

This document defines the environments verified for a Tensum release. Support
is based on this matrix, not on the broader set of environments in which GSAP
may happen to run.

## Published package

- Node.js: `20.19.x`, `22.12.0` and newer `22.x`, and `24.x`.
- Browsers: ES2022-capable browser releases represented by the Chromium,
  Firefox, and WebKit builds installed by the pinned Playwright version.
- GSAP: the peer lower bound (`3.15.0`) and the npm `latest` GSAP 3 release at
  release time.
- Modules: ESM imports only. CommonJS may use dynamic `import()`; synchronous
  `require()` is not exported.
- TypeScript: declarations are verified with TypeScript 6 under `Node16`,
  `NodeNext`, and `Bundler` module resolution.

The JavaScript target is ES2022. Using the string returned by
`springToCSSLinear()` also requires browser support for the CSS `linear()`
easing function.

## Release evidence

The mandatory local release gate builds the package, checks its complete named
value and type export surface, runs unit tests, executes the browser integration
suite in all three engines, validates package metadata, and installs the packed
tarball in a clean consumer. CI additionally installs that tarball under the
three supported Node.js release lines.

Before publishing, `pnpm release:compat` verifies the GSAP peer lower bound and
the current npm `latest` release. That network-dependent matrix remains a
separate command so ordinary offline development stays deterministic.

## Repository tooling

The full monorepo, including the documentation site and release tooling,
requires Node.js 22.12 or newer. Node.js 20 support applies to the published
`tensum` runtime package, not to the site toolchain.
