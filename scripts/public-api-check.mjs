import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const packageRoot = join(repositoryRoot, "packages", "tensum");
const requireFromPackage = createRequire(join(packageRoot, "package.json"));
const ts = requireFromPackage("typescript");

const expected = {
  "index.d.ts": {
    values: [
      "CRITICAL_DAMPING_TOLERANCE",
      "DEFAULT_SETTLING_OPTIONS",
      "MOTION_COMPATIBILITY_COMMIT",
      "MOTION_COMPATIBILITY_VERSION",
      "SUPPORTED_PROPERTIES",
      "TensumPlugin",
      "angularFrequency",
      "classifyDamping",
      "createAdditiveSpringValue",
      "createAnalyticalSolver",
      "createInertia",
      "createMotionSpringTween",
      "createSpring",
      "createSpringKeyframes",
      "createSpringModel",
      "createSpringValue",
      "createVectorSpring",
      "dampingRatio",
      "getSettlingResult",
      "motionSpringParameters",
      "normalizedVelocity",
      "physicalVelocity",
      "resolveSettlingOptions",
      "snapToGrid",
      "springCharacteristics",
      "springParameters",
      "springPresets",
      "springTo",
      "validateSettlingOptions",
      "validateSpringParameters",
      "velocityFromSamples",
    ],
    types: [
      "AdditiveSpringContributionOptions",
      "AdditiveSpringEvent",
      "AdditiveSpringListener",
      "AdditiveSpringOptions",
      "AdditiveSpringSnapshot",
      "AdditiveSpringValue",
      "BuiltInSpringProperty",
      "FrameDriver",
      "InertiaBoundaryTransition",
      "InertiaOptions",
      "InertiaPhase",
      "InertiaSolution",
      "MotionDurationSpringInput",
      "MotionSpringEffectTweenVars",
      "MotionSpringEffectVars",
      "MotionSpringParameterConverters",
      "MotionSpringVars",
      "MotionVisualDurationSpringInput",
      "MutableVectorSpringState",
      "PerceptualSpringInput",
      "ResponseSpringInput",
      "SettlingDurationSpringInput",
      "SettlingResult",
      "SpringCharacteristics",
      "SpringController",
      "SpringInitialState",
      "SpringKeyframe",
      "SpringKeyframeSegment",
      "SpringKeyframeSequence",
      "SpringKeyframesOptions",
      "SpringModel",
      "SpringOptions",
      "SpringParameterConverters",
      "SpringParameters",
      "SpringPreset",
      "SpringPresetOptions",
      "SpringPresets",
      "SpringProperty",
      "SpringPropertyAdapter",
      "SpringPropertyOptions",
      "SpringRegime",
      "SpringSettleInput",
      "SpringSettlingOptions",
      "SpringSolution",
      "SpringSolutionMap",
      "SpringState",
      "SpringStateMap",
      "SpringTargetValue",
      "SpringTargets",
      "SpringTiming",
      "SpringTimingInput",
      "SpringToSnapshot",
      "SpringToVars",
      "SpringTweenTarget",
      "SpringValue",
      "SpringValueEvent",
      "SpringValueListener",
      "SpringValueOptions",
      "SpringValueRetargetOptions",
      "SpringValueSnapshot",
      "SpringVelocities",
      "UnsettledPolicy",
      "VectorSpringOptions",
      "VectorSpringSolution",
      "VectorSpringState",
      "VelocityFromSamplesOptions",
      "VelocitySample",
      "VisualSpringInput",
    ],
  },
  "css.d.ts": {
    values: ["springToCSSLinear"],
    types: ["CSSLinearSample", "CSSLinearSpring", "CSSLinearSpringOptions"],
  },
  "coupled.d.ts": {
    values: ["createCoupledSpringSystem"],
    types: [
      "CoupledAnchor",
      "CoupledParticle",
      "CoupledSpringOptions",
      "CoupledSpringState",
      "CoupledSpringSystem",
      "MutableCoupledSpringState",
      "SpringConnection",
    ],
  },
};

function declaredExports(file) {
  const path = join(packageRoot, "dist", file);
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const result = { values: [], types: [] };

  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    assert.ok(
      statement.exportClause && ts.isNamedExports(statement.exportClause),
      `${file} must use explicit named exports`,
    );
    for (const element of statement.exportClause.elements) {
      const collection = statement.isTypeOnly || element.isTypeOnly
        ? result.types
        : result.values;
      collection.push(element.name.text);
    }
  }

  result.values.sort();
  result.types.sort();
  return result;
}

for (const [file, contract] of Object.entries(expected)) {
  assert.deepEqual(
    declaredExports(file),
    {
      values: [...contract.values].sort(),
      types: [...contract.types].sort(),
    },
    `${file} public declarations changed; review the API contract intentionally`,
  );
}

console.log("Public value and type export contracts passed for all entry points.");
