import { expect, describe, it } from 'vitest'
import { round } from './stringUtils'

describe('round', () => {
  it('should be able to handle undefined input', () => {
    expect(round(undefined)).toBe("");
  });
})