export interface SSEEvent {
  event?: string;
  data: string;
}

/** Minimal Server-Sent Events parser over a fetch response body. */
export async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event: string | undefined;
  let data: string[] = [];

  const flush = (): SSEEvent | null => {
    if (data.length === 0) {
      event = undefined;
      return null;
    }
    const out: SSEEvent = event ? { event, data: data.join('\n') } : { data: data.join('\n') };
    event = undefined;
    data = [];
    return out;
  };

  const handleLine = (line: string): SSEEvent | null => {
    if (line === '') return flush();
    if (line.startsWith(':')) return null;
    const idx = line.indexOf(':');
    const field = idx === -1 ? line : line.slice(0, idx);
    let value = idx === -1 ? '' : line.slice(idx + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'data') data.push(value);
    else if (field === 'event') event = value;
    return null;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.search(/\r\n|\n|\r/)) !== -1) {
        // A trailing '\r' may be the first half of a CRLF split across chunks.
        if (nl === buffer.length - 1 && buffer[nl] === '\r') break;
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + (buffer.startsWith('\r\n', nl) ? 2 : 1));
        const ev = handleLine(line);
        if (ev) yield ev;
      }
    }
    if (buffer) handleLine(buffer);
    const last = flush();
    if (last) yield last;
  } finally {
    reader.releaseLock();
  }
}
