import { keepAlive, KEEPALIVE_MS } from '../../src/core/keepalive';

describe('keepAlive', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('pings below the 30s idle limit until stopped', () => {
    const ping = vi.fn(async () => {});
    const stop = keepAlive(ping);
    expect(KEEPALIVE_MS).toBeLessThan(30_000);
    vi.advanceTimersByTime(KEEPALIVE_MS * 2);
    expect(ping).toHaveBeenCalledTimes(2);
    stop();
    vi.advanceTimersByTime(KEEPALIVE_MS * 3);
    expect(ping).toHaveBeenCalledTimes(2);
  });

  it('ignores ping failures', () => {
    const stop = keepAlive(async () => Promise.reject(new Error('x')));
    expect(() => vi.advanceTimersByTime(KEEPALIVE_MS)).not.toThrow();
    stop();
  });
});
