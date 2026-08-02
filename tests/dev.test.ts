import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE_RELOAD_SCRIPT, servePreview, watchDirs } from '../src/dev.js';

let dir: string;
let preview: ReturnType<typeof servePreview> | undefined;
let base: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'vita-dev-'));
});

afterEach(async () => {
  await preview?.close();
  preview = undefined;
});

/** Boot the preview server on an ephemeral port. */
async function serve() {
  preview = servePreview(dir, 0);
  base = await preview.ready;
  return preview;
}

describe('servePreview', () => {
  it('serves index.html at the root', async () => {
    await writeFile(join(dir, 'index.html'), '<h1>hello</h1>', 'utf8');
    await serve();

    const response = await fetch(base);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toBe('<h1>hello</h1>');
  });

  it('serves other build artefacts with the right content type', async () => {
    await writeFile(join(dir, 'resume.json'), '{"a":1}', 'utf8');
    await serve();

    const response = await fetch(`${base}/resume.json`);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ a: 1 });
  });

  it('never caches, so a rebuild is always picked up', async () => {
    await writeFile(join(dir, 'index.html'), 'x', 'utf8');
    await serve();
    expect((await fetch(base)).headers.get('cache-control')).toBe('no-store');
  });

  it('404s for a file that is not there', async () => {
    await serve();
    expect((await fetch(`${base}/missing.html`)).status).toBe(404);
  });

  it('reports the build generation and bumps it on demand', async () => {
    const server = await serve();

    expect(await (await fetch(`${base}/__generation`)).text()).toBe('0');
    server.bump();
    expect(await (await fetch(`${base}/__generation`)).text()).toBe('1');
  });

  it('refuses to serve a path outside the build directory', async () => {
    const secret = join(dir, '..', 'vita-dev-secret.txt');
    await writeFile(secret, 'do not serve me', 'utf8');
    await serve();

    const response = await fetch(`${base}/../vita-dev-secret.txt`, {
      redirect: 'manual',
    });
    expect(await response.text()).not.toContain('do not serve me');
  });
});

describe('watchDirs', () => {
  it('fires once for a burst of changes and stops when closed', async () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      const stop = watchDirs({ dirs: [dir], onChange, debounceMs: 50 });

      // Three edits inside the debounce window collapse into one rebuild.
      await writeFile(join(dir, 'a.yaml'), '1', 'utf8');
      await writeFile(join(dir, 'b.yaml'), '2', 'utf8');
      await writeFile(join(dir, 'c.yaml'), '3', 'utf8');

      await vi.advanceTimersByTimeAsync(200);
      expect(onChange).toHaveBeenCalledTimes(1);

      stop();
      await writeFile(join(dir, 'd.yaml'), '4', 'utf8');
      await vi.advanceTimersByTimeAsync(200);
      expect(onChange).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('watches nested directories', async () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      await mkdir(join(dir, 'nested'), { recursive: true });
      const stop = watchDirs({ dirs: [dir], onChange, debounceMs: 20 });

      await writeFile(join(dir, 'nested', 'deep.yaml'), 'x', 'utf8');
      await vi.advanceTimersByTimeAsync(100);

      expect(onChange).toHaveBeenCalled();
      stop();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('live reload', () => {
  it('injects a script that polls the generation endpoint', () => {
    expect(LIVE_RELOAD_SCRIPT).toContain('/__generation');
    expect(LIVE_RELOAD_SCRIPT).toContain('location.reload()');
  });
});
