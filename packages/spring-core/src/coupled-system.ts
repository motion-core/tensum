export interface CoupledAnchor {
  target: number;
  stiffness: number;
  damping: number;
}

export interface CoupledParticle {
  mass: number;
  position: number;
  velocity?: number;
  fixed?: boolean;
  anchor?: CoupledAnchor;
  min?: number;
  max?: number;
  restitution?: number;
}

export interface SpringConnection {
  from: number;
  to: number;
  stiffness: number;
  damping: number;
  restOffset?: number;
}

export interface CoupledSpringOptions {
  particles: readonly CoupledParticle[];
  connections: readonly SpringConnection[];
  maxStep?: number;
}

export interface CoupledSpringState {
  position: readonly number[];
  velocity: readonly number[];
}

export interface MutableCoupledSpringState {
  position: number[];
  velocity: number[];
}

export interface CoupledSpringSystem {
  readonly dimension: number;
  readonly particles: readonly Readonly<CoupledParticle>[];
  readonly connections: readonly Readonly<SpringConnection>[];
  readonly initialState: Readonly<CoupledSpringState>;
  readonly maxStep: number;
  forceAt(state: CoupledSpringState): readonly number[];
  accelerationAt(state: CoupledSpringState): readonly number[];
  advance(state: CoupledSpringState, deltaTime: number): CoupledSpringState;
  advanceInto(
    state: CoupledSpringState,
    deltaTime: number,
    output: MutableCoupledSpringState,
  ): MutableCoupledSpringState;
  stateAt(time: number): CoupledSpringState;
  energyAt(state: CoupledSpringState): number;
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number`);
  }
}

function assertPositive(name: string, value: number): void {
  assertFinite(name, value);
  if (value <= 0) throw new RangeError(`${name} must be greater than 0`);
}

function assertNonNegative(name: string, value: number): void {
  assertFinite(name, value);
  if (value < 0) throw new RangeError(`${name} must be greater than or equal to 0`);
}

export function createCoupledSpringSystem(
  options: CoupledSpringOptions,
): CoupledSpringSystem {
  if (options.particles.length === 0) {
    throw new RangeError('a coupled spring system requires at least one particle');
  }
  const maxStep = options.maxStep ?? 1 / 240;
  assertPositive('maxStep', maxStep);
  const particles = Object.freeze(
    options.particles.map((particle, index) => {
      assertPositive(`particles[${index}].mass`, particle.mass);
      assertFinite(`particles[${index}].position`, particle.position);
      assertFinite(`particles[${index}].velocity`, particle.velocity ?? 0);
      if (particle.min !== undefined) {
        assertFinite(`particles[${index}].min`, particle.min);
      }
      if (particle.max !== undefined) {
        assertFinite(`particles[${index}].max`, particle.max);
      }
      if (
        particle.min !== undefined &&
        particle.max !== undefined &&
        particle.min > particle.max
      ) {
        throw new RangeError(`particles[${index}].min must not exceed max`);
      }
      const restitution = particle.restitution ?? 0;
      assertFinite(`particles[${index}].restitution`, restitution);
      if (restitution < 0 || restitution > 1) {
        throw new RangeError(`particles[${index}].restitution must be between 0 and 1`);
      }
      if (particle.anchor) {
        assertFinite(`particles[${index}].anchor.target`, particle.anchor.target);
        assertPositive(
          `particles[${index}].anchor.stiffness`,
          particle.anchor.stiffness,
        );
        assertNonNegative(
          `particles[${index}].anchor.damping`,
          particle.anchor.damping,
        );
      }
      return Object.freeze({
        ...particle,
        velocity: particle.fixed ? 0 : particle.velocity ?? 0,
        restitution,
        ...(particle.anchor === undefined
          ? {}
          : { anchor: Object.freeze({ ...particle.anchor }) }),
      });
    }),
  );
  const dimension = particles.length;
  const connections = Object.freeze(
    options.connections.map((connection, index) => {
      if (
        !Number.isInteger(connection.from) ||
        connection.from < 0 ||
        connection.from >= dimension
      ) {
        throw new RangeError(`connections[${index}].from is out of range`);
      }
      if (
        !Number.isInteger(connection.to) ||
        connection.to < 0 ||
        connection.to >= dimension
      ) {
        throw new RangeError(`connections[${index}].to is out of range`);
      }
      if (connection.from === connection.to) {
        throw new RangeError(`connections[${index}] must join two particles`);
      }
      assertPositive(`connections[${index}].stiffness`, connection.stiffness);
      assertNonNegative(`connections[${index}].damping`, connection.damping);
      assertFinite(`connections[${index}].restOffset`, connection.restOffset ?? 0);
      return Object.freeze({ ...connection, restOffset: connection.restOffset ?? 0 });
    }),
  );
  const fixedPositions = particles.map((particle) => particle.position);
  const initialState: Readonly<CoupledSpringState> = Object.freeze({
    position: Object.freeze(particles.map((particle) => particle.position)),
    velocity: Object.freeze(particles.map((particle) => particle.velocity)),
  });

  const validateState = (state: CoupledSpringState): void => {
    if (state.position.length !== dimension || state.velocity.length !== dimension) {
      throw new RangeError(`state must contain exactly ${dimension} components`);
    }
    for (let index = 0; index < dimension; index += 1) {
      assertFinite(`state.position[${index}]`, state.position[index]!);
      assertFinite(`state.velocity[${index}]`, state.velocity[index]!);
    }
  };

  const forceAtMutable = (
    position: readonly number[],
    velocity: readonly number[],
  ): number[] => {
    const force = Array<number>(dimension).fill(0);
    for (let index = 0; index < dimension; index += 1) {
      const anchor = particles[index]!.anchor;
      if (!anchor) continue;
      force[index] =
        -anchor.stiffness * (position[index]! - anchor.target) -
        anchor.damping * velocity[index]!;
    }
    for (const connection of connections) {
      const extension =
        position[connection.to]! -
        position[connection.from]! -
        connection.restOffset;
      const relativeVelocity =
        velocity[connection.to]! - velocity[connection.from]!;
      const couplingForce =
        connection.stiffness * extension + connection.damping * relativeVelocity;
      force[connection.from]! += couplingForce;
      force[connection.to]! -= couplingForce;
    }
    return force;
  };

  const derivative = (
    position: readonly number[],
    velocity: readonly number[],
  ): { position: number[]; velocity: number[] } => {
    const force = forceAtMutable(position, velocity);
    return {
      position: velocity.map((value, index) =>
        particles[index]!.fixed ? 0 : value,
      ),
      velocity: force.map((value, index) =>
        particles[index]!.fixed ? 0 : value / particles[index]!.mass,
      ),
    };
  };

  const integrateStep = (
    position: number[],
    velocity: number[],
    step: number,
  ): void => {
    const k1 = derivative(position, velocity);
    const p2 = position.map((value, index) => value + (k1.position[index]! * step) / 2);
    const v2 = velocity.map((value, index) => value + (k1.velocity[index]! * step) / 2);
    const k2 = derivative(p2, v2);
    const p3 = position.map((value, index) => value + (k2.position[index]! * step) / 2);
    const v3 = velocity.map((value, index) => value + (k2.velocity[index]! * step) / 2);
    const k3 = derivative(p3, v3);
    const p4 = position.map((value, index) => value + k3.position[index]! * step);
    const v4 = velocity.map((value, index) => value + k3.velocity[index]! * step);
    const k4 = derivative(p4, v4);

    for (let index = 0; index < dimension; index += 1) {
      const particle = particles[index]!;
      if (particle.fixed) {
        position[index] = fixedPositions[index]!;
        velocity[index] = 0;
        continue;
      }
      position[index] =
        position[index]! +
        (step / 6) *
        (k1.position[index]! +
          2 * k2.position[index]! +
          2 * k3.position[index]! +
          k4.position[index]!);
      velocity[index] =
        velocity[index]! +
        (step / 6) *
        (k1.velocity[index]! +
          2 * k2.velocity[index]! +
          2 * k3.velocity[index]! +
          k4.velocity[index]!);

      if (particle.min !== undefined && position[index]! < particle.min) {
        position[index] = particle.min;
        if (velocity[index]! < 0) velocity[index] = -velocity[index]! * particle.restitution;
      }
      if (particle.max !== undefined && position[index]! > particle.max) {
        position[index] = particle.max;
        if (velocity[index]! > 0) velocity[index] = -velocity[index]! * particle.restitution;
      }
    }
  };

  const advanceInto = (
    state: CoupledSpringState,
    deltaTime: number,
    output: MutableCoupledSpringState,
  ): MutableCoupledSpringState => {
    validateState(state);
    assertFinite('deltaTime', deltaTime);
    if (deltaTime < 0) {
      throw new RangeError('deltaTime must be greater than or equal to 0');
    }
    if (output.position.length < dimension || output.velocity.length < dimension) {
      throw new RangeError(`output buffers must contain at least ${dimension} components`);
    }
    const position = Array.from(state.position);
    const velocity = Array.from(state.velocity);
    const steps = Math.max(1, Math.ceil(deltaTime / maxStep));
    const step = deltaTime / steps;
    for (let index = 0; index < steps; index += 1) {
      integrateStep(position, velocity, step);
    }
    for (let index = 0; index < dimension; index += 1) {
      output.position[index] = position[index]!;
      output.velocity[index] = velocity[index]!;
    }
    return output;
  };

  const advance = (
    state: CoupledSpringState,
    deltaTime: number,
  ): CoupledSpringState => {
    const output = advanceInto(state, deltaTime, {
      position: Array<number>(dimension),
      velocity: Array<number>(dimension),
    });
    return Object.freeze({
      position: Object.freeze(output.position),
      velocity: Object.freeze(output.velocity),
    });
  };

  return Object.freeze({
    dimension,
    particles,
    connections,
    initialState,
    maxStep,
    forceAt(state: CoupledSpringState): readonly number[] {
      validateState(state);
      return Object.freeze(forceAtMutable(state.position, state.velocity));
    },
    accelerationAt(state: CoupledSpringState): readonly number[] {
      validateState(state);
      const force = forceAtMutable(state.position, state.velocity);
      return Object.freeze(
        force.map((value, index) =>
          particles[index]!.fixed ? 0 : value / particles[index]!.mass,
        ),
      );
    },
    advance,
    advanceInto,
    stateAt(time: number): CoupledSpringState {
      assertFinite('time', time);
      if (time < 0) throw new RangeError('time must be greater than or equal to 0');
      if (time === 0) return initialState;
      return advance(initialState, time);
    },
    energyAt(state: CoupledSpringState): number {
      validateState(state);
      let energy = 0;
      for (let index = 0; index < dimension; index += 1) {
        const particle = particles[index]!;
        if (!particle.fixed) {
          energy += (particle.mass * state.velocity[index]! ** 2) / 2;
        }
        if (particle.anchor) {
          energy +=
            (particle.anchor.stiffness *
              (state.position[index]! - particle.anchor.target) ** 2) /
            2;
        }
      }
      for (const connection of connections) {
        const extension =
          state.position[connection.to]! -
          state.position[connection.from]! -
          connection.restOffset;
        energy += (connection.stiffness * extension ** 2) / 2;
      }
      return energy;
    },
  });
}
