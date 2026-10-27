import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface MockLlm {
  url: string;
  requests: { path: string; body: unknown }[];
  setTokens(tokens: string[]): void;
  close(): Promise<void>;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, api-key, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/** OpenAI-compatible streaming endpoint that replies with fixed tokens. */
export async function startMockLlm(): Promise<MockLlm> {
  let tokens = ['Hallo ', 'Anna,', '\n\n', 'Donnerstag passt.'];
  const requests: MockLlm['requests'] = [];
  const server: Server = createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS).end();
      return;
    }
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      requests.push({ path: req.url ?? '', body: raw ? JSON.parse(raw) : null });
      if (req.url === '/v1/chat/completions') {
        res.writeHead(200, { ...CORS, 'Content-Type': 'text/event-stream' });
        for (const t of tokens) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`);
        res.end('data: [DONE]\n\n');
      } else {
        res.writeHead(404, CORS).end();
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/v1`,
    requests,
    setTokens: (t) => (tokens = t),
    close: () => new Promise((r) => server.close(() => r())),
  };
}
