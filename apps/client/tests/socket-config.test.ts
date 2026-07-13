import { describe, expect, it } from 'vitest';
import { resolveSocketUrl } from '../src/socket-config';

describe('socket URL selection', () => {
  it('uses same origin in production', () => expect(resolveSocketUrl({ isDevelopment: false })).toBeUndefined());
  it('keeps the local development server default', () => expect(resolveSocketUrl({ isDevelopment: true })).toBe('http://localhost:3001'));
  it('preserves explicit test and development overrides', () => expect(resolveSocketUrl({ isDevelopment: false, explicitUrl: 'http://127.0.0.1:4555' })).toBe('http://127.0.0.1:4555'));
});
