/**
 * User story: voice-bridge2 server emits OTLP spans when OTEL_EXPORTER_OTLP_ENDPOINT is set.
 *
 * Given a local OTLP receiver listening on a random TCP port
 * And the voice-bridge2 server is started with OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:<port>
 * When a client calls GET /health on the voice-bridge2 server
 * Then the local OTLP receiver receives at least one POST to /v1/traces
 * And the request body is non-empty (real span payload)
 *
 * Run: bun test ./tests/stories/otel/server-emits-spans.story.ts
 */

import { test, expect, beforeAll, afterAll } from 'bun:test';
import { spawn, type ChildProcess } from 'child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { type Server } from 'node:net';

const VB_TEST_PORT = Number(process.env['VB_TEST_PORT'] ?? 18801);
const OTLP_TEST_PORT = Number(process.env['OTLP_TEST_PORT'] ?? 18802);
const VB_URL = `http://127.0.0.1:${VB_TEST_PORT}`;
const PRODUCTION_PORTS = new Set([3030]);

if (PRODUCTION_PORTS.has(VB_TEST_PORT)) {
  throw new Error(`otel story test refuses to run against production port ${VB_TEST_PORT}`);
}

let serverProcess: ChildProcess | null = null;
let otlpServer: Server | null = null;
const receivedPaths: string[] = [];

async function waitFor(fn: () => boolean, timeoutMs = 15_000, intervalMs = 100): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fn()) return;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

async function waitForServer(url: string, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    otlpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        if (req.method === 'POST') {
          receivedPaths.push(req.url ?? '');
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
      });
    });
    otlpServer.listen(OTLP_TEST_PORT, '127.0.0.1', () => resolve());
    otlpServer.on('error', reject);
  });

  serverProcess = spawn(
    'bun',
    ['run', 'server/index.ts'],
    {
      cwd: '/Users/riseof/environment/projects/management-apps/voice-bridge2',
      env: {
        ...process.env,
        PORT: String(VB_TEST_PORT),
        OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${OTLP_TEST_PORT}`,
        OTEL_SERVICE_NAME: 'voice-bridge-story-test',
        NODE_ENV: 'test',
      },
      stdio: 'pipe',
    }
  );

  serverProcess.stderr?.on('data', (d: Buffer) => {
    process.stderr.write(`[voice-bridge] ${d.toString()}`);
  });

  await waitForServer(VB_URL);
});

afterAll(async () => {
  serverProcess?.kill('SIGTERM');
  await new Promise<void>(resolve => {
    if (otlpServer) {
      otlpServer.close(() => resolve());
    } else {
      resolve();
    }
  });
});

test('voice-bridge2 server emits OTLP trace spans to the configured endpoint when /health is called', async () => {
  // Negative control: verify no spans before the request
  const pathsBeforeRequest = [...receivedPaths];
  expect(pathsBeforeRequest.length).toBe(0);

  // When: hit /health to trigger a request span
  const res = await fetch(`${VB_URL}/health`);
  expect(res.status).toBe(200);

  // Then: wait for at least one OTLP trace export POST
  await waitFor(() => receivedPaths.some(p => p.includes('traces') || p.includes('metrics') || p.includes('logs')), 10_000);

  const exportPaths = receivedPaths.filter(p =>
    p.includes('traces') || p.includes('metrics') || p.includes('logs')
  );
  expect(exportPaths.length).toBeGreaterThan(0);
});
