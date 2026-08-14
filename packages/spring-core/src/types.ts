export interface SpringParameters {
  mass: number;
  stiffness: number;
  damping: number;
}

export interface SpringState {
  position: number;
  velocity: number;
}

export interface SpringInitialState extends SpringState {
  target: number;
}

export interface SpringSettlingOptions {
  positionEpsilon: number;
  velocityEpsilon: number;
  maxDuration: number;
  refinementIterations: number;
}

export interface SpringSettleInput {
  position?: number;
  velocity?: number;
  maxDuration?: number;
  refinementIterations?: number;
}

export type SpringRegime = 'underdamped' | 'critical' | 'overdamped';

export interface SpringOptions extends SpringParameters {
  from: number;
  to: number;
  velocity?: number;
  settle?: SpringSettleInput;
}

export interface SettlingResult {
  duration: number;
  iterations: number;
  settled: boolean;
}

export interface SpringSolution {
  readonly dampingRatio: number;
  readonly angularFrequency: number;
  readonly regime: SpringRegime;
  readonly parameters: Readonly<SpringParameters>;
  readonly initialState: Readonly<SpringInitialState>;
  readonly settling: Readonly<SpringSettlingOptions>;
  positionAt(time: number): number;
  velocityAt(time: number): number;
  stateAt(time: number): SpringState;
  getSettlingDuration(): number;
  getSettlingResult(): SettlingResult;
  retarget(target: number, time: number): SpringSolution;
}
