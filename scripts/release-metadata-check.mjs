import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const packagePath = "packages/tensum/package.json";
const pluginPath = "packages/tensum/src/gsap/plugin.ts";
const changelogPath = "packages/tensum/CHANGELOG.md";

const manifest = JSON.parse(readFileSync(packagePath, "utf8"));
const pluginSource = readFileSync(pluginPath, "utf8");
const changelog = readFileSync(changelogPath, "utf8");

assert.equal(
  manifest.name,
  "tensum",
  "the public package must be named tensum",
);
assert.equal(manifest.private, false, "the public package must not be private");
assert.match(
  manifest.version,
  /^\d+\.\d+\.\d+$/,
  "the release version must be stable SemVer without a prerelease suffix",
);
assert.equal(
  manifest.publishConfig?.registry,
  "https://registry.npmjs.org/",
  "the release must target the public npm registry",
);
assert.equal(
  manifest.publishConfig?.access,
  "public",
  "the release must use public npm access",
);
assert.equal(
  manifest.publishConfig?.tag,
  "latest",
  "a stable release must publish under the latest tag",
);

const escapedVersion = manifest.version.replaceAll(".", "\\.");
assert.match(
  changelog,
  new RegExp(`^## \\[${escapedVersion}\\] - \\d{4}-\\d{2}-\\d{2}$`, "m"),
  `the changelog must contain a dated ${manifest.version} release`,
);
assert.match(
  pluginSource,
  new RegExp(`version: '${escapedVersion}'`),
  "the GSAP plugin version must match the package version",
);

console.log(`Stable release metadata passed for tensum@${manifest.version}.`);
