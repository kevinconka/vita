import { createServer } from 'node:http';
import { watch } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { readFile } from 'node:fs/promises';

/**
 * Watch mode. Deliberately dependency-free: node's own watcher plus a small
 * static server, because pulling a bundler in to serve one HTML file would be
 * a lot of machinery for a page with no JavaScript.
 */

/** Coalesce the burst of events an editor's atomic save produces. */
function debounce(fn: () => void, ms: number): () => void {
  let timer: NodeJS.Timeout | undefined;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

export interface WatchOptions {
  /** Directories to watch recursively. */
  dirs: string[];
  /** Called once per settled burst of changes. */
  onChange: () => void | Promise<void>;
  debounceMs?: number;
}

export function watchDirs({
  dirs,
  onChange,
  debounceMs = 120,
}: WatchOptions): () => void {
  const run = debounce(() => void onChange(), debounceMs);
  const watchers = dirs.map((dir) => watch(dir, { recursive: true }, run));
  return () => watchers.forEach((w) => w.close());
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/**
 * Serve one built profile directory. `/` maps to the rendered HTML; the
 * refresh script polls a build counter so a rebuild reloads the tab.
 *
 * Pass port 0 to bind an ephemeral port and read the real one off `ready`.
 */
export function servePreview(dir: string, port: number) {
  let generation = 0;

  /** A traversal guard: `/../../etc/passwd` must not escape the build dir. */
  const resolveWithin = (name: string): string | undefined => {
    const target = resolve(dir, name);
    const root = resolve(dir);
    return target === root || target.startsWith(`${root}${sep}`) ? target : undefined;
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/__generation') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(String(generation));
      return;
    }

    const name =
      url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const target = resolveWithin(name);

    if (!target) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('forbidden');
      return;
    }

    readFile(target)
      .then((body) => {
        const type = CONTENT_TYPES[extname(name)] ?? 'application/octet-stream';
        res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
        res.end(body);
      })
      .catch(() => {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('not found');
      });
  });

  // Resolves once bound, so callers (and tests) can learn an ephemeral port.
  const ready = new Promise<string>((resolvePort) => {
    server.once('listening', () => {
      const address = server.address();
      const bound = typeof address === 'object' && address ? address.port : port;
      resolvePort(`http://localhost:${bound}`);
    });
  });

  // Loopback only. This serves the build directory off the developer's
  // machine; binding 0.0.0.0 would expose an unfinished CV — and whatever the
  // process can read — to everyone on the same network.
  server.listen(port, '127.0.0.1');

  return {
    ready,
    /** Call after each successful rebuild so open tabs reload. */
    bump: () => {
      generation += 1;
    },
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}

/**
 * Injected into the preview copy only — the HTML written to build/ stays a
 * clean, self-contained document with no dev machinery in it.
 */
export const LIVE_RELOAD_SCRIPT = `<script>
  (async () => {
    const read = async () => (await fetch('/__generation')).text();
    let current = await read();
    setInterval(async () => {
      try {
        const next = await read();
        if (next !== current) location.reload();
      } catch {}
    }, 500);
  })();
</script>`;
