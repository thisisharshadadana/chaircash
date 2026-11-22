import { describe, it, expect } from 'vitest';
import { bucketFor } from '../aging';

describe('bucketFor', () => {
  it('returns null when not overdue', () => {
    expect(bucketFor(0)).toBeNull();
    expect(bucketFor(-3)).toBeNull();
  });

  it('respects bucket boundaries', () => {
    expect(bucketFor(1)).toBe('0-7');
    expect(bucketFor(7)).toBe('0-7');
    expect(bucketFor(8)).toBe('8-30');
    expect(bucketFor(30)).toBe('8-30');
    expect(bucketFor(31)).toBe('31-60');
    expect(bucketFor(60)).toBe('31-60');
    expect(bucketFor(61)).toBe('60+');
  });
});
