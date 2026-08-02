import { createServer } from 'node:http';
import { watch } from 'node:fs';
import { extname, join } from 'node:path';
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
 */
export function servePreview(dir: string, port: number) {
  let generation = 0;

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/__generation') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(String(generation));
      return;
    }

    const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    readFile(join(dir, name))
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

  server.listen(port);
  return {
    url: `http://localhost:${port}`,
    /** Call after each successful rebuild so open tabs reload. */
    bump: () => {
      generation += 1;
    },
    close: () => server.close(),
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
