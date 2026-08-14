import { describe, expect, it } from 'vitest';
import * as adapter from '../src/index.js';

describe('public API', () => {
  it('keeps adapter exports intentional', () => {
    expect(Object.keys(adapter).sort()).toEqual([
      'MotionCoreSpringPlugin',
      'SUPPORTED_PROPERTIES',
      'registerMotionCoreSpringPlugin',
      'springTo',
    ]);
  });
});
