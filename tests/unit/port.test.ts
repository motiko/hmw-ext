import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startGeneration } from '../../src/ui/port';
import type { GenerateRequest, StreamEvent } from '../../src/core/messages';

const req: GenerateRequest = {
  type: 'generate',
  task: 'create',
  instruction: 'x',
  context: { subject: '', recipients: [], userEmail: '', thread: [] },
  language: 'auto',
};

describe('startGeneration', () => {
  it('reports a reload hint instead of hanging when the extension was updated', () => {
    vi.spyOn(fakeBrowser.runtime, 'connect').mockImplementation(() => {
      throw new Error('Extension context invalidated.');
    });
    const events: StreamEvent[] = [];
    const handle = startGeneration(req, (e) => events.push(e));
    expect(events).toEqual([{ type: 'error', code: 'network', message: expect.stringMatching(/reload/i) }]);
    expect(() => handle.abort()).not.toThrow();
  });
});
