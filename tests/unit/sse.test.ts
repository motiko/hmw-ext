import { parseSSE } from '../../src/core/providers/sse';

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
}

async function collect(s: ReadableStream<Uint8Array>) {
  const out = [];
  for await (const e of parseSSE(s)) out.push(e);
  return out;
}

describe('parseSSE', () => {
  it('parses data lines split across chunks', async () => {
    expect(await collect(streamOf('data: hel', 'lo\n\ndata: wor', 'ld\n\n'))).toEqual([
      { data: 'hello' },
      { data: 'world' },
    ]);
  });

  it('handles CRLF and multi-line data joined with \\n', async () => {
    expect(await collect(streamOf('data: a\r\ndata: b\r\n\r\n'))).toEqual([{ data: 'a\nb' }]);
  });

  it('treats CRLF split across chunks as one line break', async () => {
    expect(await collect(streamOf('data: a\r', '\ndata: b\r\n\r\n'))).toEqual([{ data: 'a\nb' }]);
  });

  it('captures event: field', async () => {
    expect(await collect(streamOf('event: content_block_delta\ndata: {}\n\n'))).toEqual([
      { event: 'content_block_delta', data: '{}' },
    ]);
  });

  it('ignores comments and blank keep-alives', async () => {
    expect(await collect(streamOf(': ping\n\n\n\ndata: x\n\n'))).toEqual([{ data: 'x' }]);
  });

  it('flushes final event without trailing blank line', async () => {
    expect(await collect(streamOf('data: last'))).toEqual([{ data: 'last' }]);
  });
});
