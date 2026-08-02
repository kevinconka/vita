import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateRange,
  loadTheme,
  renderHtml,
  tokensToRootBlock,
} from '../src/render.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const themeDir = join(root, 'theme');

describe('tokens', () => {
  it('flattens nested keys into custom properties', () => {
    const css = tokensToRootBlock({
      color: { accent: '#f00', text: '#000' },
      page: { margin: '10mm' },
    });
    expect(css).toContain('--color-accent: #f00;');
    expect(css).toContain('--color-text: #000;');
    expect(css).toContain('--page-margin: 10mm;');
  });

  it('skips $-prefixed metadata keys', () => {
    expect(
      tokensToRootBlock({ $comment: 'ignore me', color: { accent: '#f00' } }),
    ).not.toContain('$comment');
  });
});

describe('dates', () => {
  it.each([
    ['2024-07', 'Jul 2024'],
    ['2024', '2024'],
    ['2024-01-15', 'Jan 2024'],
    ['', ''],
  ])('formats %s as %s', (input, expected) => {
    expect(formatDate(input)).toBe(expected);
  });

  it('treats a missing end date as ongoing', () => {
    expect(formatDateRange('2024-07', undefined)).toBe('Jul 2024 – Present');
  });

  it('renders a closed range', () => {
    expect(formatDateRange('2019-01', '2024-06')).toBe('Jan 2019 – Jun 2024');
  });
});

describe('hostname helper', () => {
  const hostname = async (value: unknown) => {
    const theme = await loadTheme(themeDir);
    return renderHtml(theme, {
      basics: { name: 'X', url: value as string },
    }).match(/<a href="[^"]*">([^<]*)<\/a>/)?.[1];
  };

  it('strips the scheme and www', async () => {
    expect(await hostname('https://www.example.com/cv')).toBe('example.com');
  });

  it('passes through something that is not a URL', async () => {
    expect(await hostname('not a url')).toBe('not a url');
  });
});

describe('html', () => {
  const resume = {
    basics: {
      name: 'Test Person',
      label: 'Engineer',
      email: 'test@example.com',
      profiles: [{ network: 'GitHub', username: 'test', url: 'https://github.com/test' }],
    },
    work: [
      {
        name: 'Acme',
        position: 'Engineer',
        startDate: '2020-01',
        highlights: ['Shipped **a thing**'],
      },
    ],
    skills: [{ name: 'Stack', keywords: ['TypeScript'] }],
  };

  it('renders a self-contained document with the tokens inlined', async () => {
    const theme = await loadTheme(themeDir);
    const html = renderHtml(theme, resume);

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Test Person');
    expect(html).toContain('--color-accent:');
    // No external requests: everything is inline.
    expect(html).not.toContain('<link rel="stylesheet"');
    expect(html).not.toContain('<script src=');
  });

  it('renders Markdown in bullets without wrapping them in a paragraph', async () => {
    const theme = await loadTheme(themeDir);
    const html = renderHtml(theme, resume);
    expect(html).toContain('Shipped <strong>a thing</strong>');
    expect(html).not.toContain('<li><p>');
  });

  it('escapes HTML that appears in content', async () => {
    const theme = await loadTheme(themeDir);
    const html = renderHtml(theme, { basics: { name: '<script>alert(1)</script>' } });
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('links social profiles from basics', async () => {
    const theme = await loadTheme(themeDir);
    expect(renderHtml(theme, resume)).toContain('https://github.com/test');
  });
});

describe('theme discipline', () => {
  it('keeps brand values out of the stylesheet', async () => {
    const { readFile } = await import('node:fs/promises');
    const css = await readFile(join(themeDir, 'style.css'), 'utf8');
    // Strip comments before looking for literals.
    const body = css.replace(/\/\*[\s\S]*?\*\//g, '');

    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(body).not.toMatch(/\brgba?\(/);
    // `\s+` rather than `\s*`: with `*` the quantifier backtracks to empty and
    // the negative lookahead passes on every declaration.
    expect(body).not.toMatch(/\bfont-family:\s+(?!var\()/);
  });
});

describe('calendar dates', () => {
  it.each([
    ['2024-13', 'month 13'],
    ['2024-02-30', 'February 30th'],
    ['2024-00', 'month zero'],
  ])('rejects %s (%s)', async (value) => {
    const { contentSchema } = await import('../src/schema.js');
    const result = contentSchema.safeParse({
      work: [{ name: 'A', position: 'P', startDate: value }],
    });
    expect(result.success).toBe(false);
  });

  it.each(['2024', '2024-02', '2024-02-29'])('accepts %s', async (value) => {
    const { contentSchema } = await import('../src/schema.js');
    const result = contentSchema.safeParse({
      work: [{ name: 'A', position: 'P', startDate: value }],
    });
    expect(result.success).toBe(true);
  });
});
