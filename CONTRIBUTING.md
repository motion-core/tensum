# Contributing

## Local setup

The repository requires Node.js 20.19.x, or Node.js 22.12 and newer, with pnpm
10.33.3. The package runtime has a separate Node.js 18 minimum.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm lint
pnpm build
```

Use `pnpm dev` to run the product site and playground.

## Before submitting a change

Keep changes focused and add tests for public behavior. If a change affects the
package contract, update `packages/tensum/README.md` and
`packages/tensum/CHANGELOG.md` in the same change.

Run the local release rehearsal before a package release:

```bash
pnpm release:check
```

The command packs the library and tests it in a temporary consumer. It does not
publish, tag, or push anything.

Do not commit generated `dist`, site build output, coverage data, or package
tarballs.
