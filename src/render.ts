import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Handlebars from 'handlebars';
import type { Page } from 'playwright';
import { marked } from 'marked';
import type { Resume } from './compose.js';

/**
 * Rendering: resume.json -> HTML (vendored theme) -> PDF (Playwright).
 *
 * Strictly offline. The theme is read from disk, tokens are inlined as CSS
 * custom properties and the stylesheet is inlined too, so the HTML in build/
 * is a single self-contained file you can email as-is.
 */

export interface Theme {
  dir: string;
  template: HandlebarsTemplateDelegate;
  css: string;
}

/* ------------------------------------------------------------------ tokens */

type TokenTree = { [key: string]: string | number | TokenTree };

/**
 * Flatten `{ color: { accent: "#000" } }` to `--color-accent: #000`.
 * Keys starting with `$` are metadata (`$comment`) and are skipped.
 */
function tokensToCss(tokens: TokenTree, prefix = ''): string[] {
  const declarations: string[] = [];

  for (const [key, value] of Object.entries(tokens)) {
    if (key.startsWith('$')) continue;
    const name = prefix ? `${prefix}-${key}` : key;

    if (value !== null && typeof value === 'object') {
      declarations.push(...tokensToCss(value, name));
    } else {
      declarations.push(`  --${name}: ${value};`);
    }
  }

  return declarations;
}

/** The `:root` block that every other stylesheet rule depends on. */
export function tokensToRootBlock(tokens: TokenTree): string {
  return `:root {\n${tokensToCss(tokens).join('\n')}\n}`;
}

/* ----------------------------------------------------------------- helpers */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** `2024-07` -> `Jul 2024`. Year-only and full dates degrade gracefully. */
export function formatDate(value: unknown): string {
  if (typeof value !== 'string' || value === '') return '';
  const [year, month] = value.split('-');
  if (!year) return '';
  if (!month) return year;
  return `${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

/** A missing end date means the entry is ongoing, not undated. */
export function formatDateRange(start: unknown, end: unknown): string {
  const from = formatDate(start);
  if (!from) return '';
  const to = formatDate(end);
  return `${from} – ${to || 'Present'}`;
}

/**
 * Bullets are Markdown but live inside `<li>`, so render inline-only: no
 * wrapping `<p>`, no block constructs promoted out of the list item.
 */
function renderMarkdown(value: unknown): string {
  if (typeof value !== 'string') return '';
  return marked.parseInline(value, { async: false }).trim();
}

function registerHelpers(handlebars: typeof Handlebars): void {
  handlebars.registerHelper(
    'md',
    (value: unknown) => new handlebars.SafeString(renderMarkdown(value)),
  );
  handlebars.registerHelper('dateRange', (start: unknown, end: unknown) =>
    formatDateRange(start, end),
  );
  /*
   * `Robin Vega` -> `Robin <em>Vega</em>`. Lets a display face's italic carry
   * the surname without hardcoding a name into the template. Escapes both
   * halves itself, since it has to return a SafeString to emit the tag.
   */
  handlebars.registerHelper('nameWithItalicSurname', (value: unknown) => {
    if (typeof value !== 'string' || value.trim() === '') return '';
    const escape = (s: string) => handlebars.Utils.escapeExpression(s);

    const parts = value.trim().split(/\s+/);
    if (parts.length === 1) return new handlebars.SafeString(escape(parts[0]!));

    const surname = parts.pop()!;
    return new handlebars.SafeString(
      `${escape(parts.join(' '))} <em>${escape(surname)}</em>`,
    );
  });

  handlebars.registerHelper('hostname', (value: unknown) => {
    if (typeof value !== 'string') return '';
    try {
      return new URL(value).hostname.replace(/^www\./, '');
    } catch {
      return value;
    }
  });
}

/* ------------------------------------------------------------------- fonts */

/**
 * Filename convention for a vendored face:
 *
 *   <Family_Name>-<weight>-<style>.woff2
 *   Inter-400-normal.woff2          Instrument_Serif-400-italic.woff2
 *   Instrument_Sans-400-700-normal.woff2   (variable: a weight range)
 *
 * Underscores become spaces and nothing else is transformed, so the family
 * name in the filename is exactly the one the stylesheet must ask for.
 * Deriving it instead — title-casing a lowercase slug — silently mangles
 * acronyms: `dm-mono` becomes `Dm Mono`, which never matches `DM Mono`, and
 * the face falls back to a system font with no error anywhere.
 */
const FONT_FILE =
  /^(?<family>.+?)-(?<weight>\d{3}(?:-\d{3})?)-(?<style>normal|italic)\.woff2$/;

/**
 * Inline every `<theme>/fonts/*.woff2` as a base64 `@font-face`.
 *
 * Embedding rather than linking is what makes the typography survive: the
 * output has to render identically on a machine that has none of these faces
 * installed, and rendering makes no network calls. Costs roughly a third more
 * bytes than the raw woff2, which is nothing against a self-contained PDF.
 */
async function inlineFonts(dir: string): Promise<string> {
  const fontDir = join(dir, 'fonts');

  let files: string[];
  try {
    files = (await readdir(fontDir)).filter((f) => f.endsWith('.woff2')).sort();
  } catch {
    return ''; // A theme without a fonts/ directory just uses system faces.
  }

  const faces = await Promise.all(
    files.map(async (file) => {
      const match = FONT_FILE.exec(file);
      if (!match?.groups) return `/* skipped ${file}: unrecognised filename */`;

      const { family, weight, style } = match.groups;
      const data = await readFile(join(fontDir, file));
      return [
        '@font-face {',
        `  font-family: '${family!.replace(/_/g, ' ')}';`,
        `  font-style: ${style};`,
        `  font-weight: ${weight!.replace('-', ' ')};`,
        '  font-display: block;',
        `  src: url(data:font/woff2;base64,${data.toString('base64')}) format('woff2');`,
        '}',
      ].join('\n');
    }),
  );

  return faces.join('\n\n');
}

/* ------------------------------------------------------------------- theme */

/** Read the vendored theme from disk and compile it once. */
export async function loadTheme(dir: string): Promise<Theme> {
  const [templateSource, styles, tokensSource, fontFaces] = await Promise.all([
    readFile(join(dir, 'template.hbs'), 'utf8'),
    readFile(join(dir, 'style.css'), 'utf8'),
    readFile(join(dir, 'tokens.json'), 'utf8'),
    inlineFonts(dir),
  ]);

  const handlebars = Handlebars.create();
  registerHelpers(handlebars);

  const tokens = JSON.parse(tokensSource) as TokenTree;
  // Faces first so they are available before any rule references them, then
  // tokens, since style.css derives its whole scale from those.
  const css = [fontFaces, tokensToRootBlock(tokens), styles].filter(Boolean).join('\n\n');

  return { dir, template: handlebars.compile(templateSource), css };
}

/** Render a resume to a single self-contained HTML document. */
export function renderHtml(theme: Theme, resume: Resume): string {
  return theme.template({ resume, css: theme.css });
}

/* --------------------------------------------------------------------- pdf */

export interface PdfOptions {
  /** Paper size understood by Playwright, e.g. `A4`. Defaults to the token. */
  format?: string;
}

/**
 * Load the HTML in a headless page and hand it to `use`, closing the browser
 * whatever happens. Playwright is imported lazily so `vita lint` and
 * `vita tags` never pay for a browser launch.
 */
async function withPage<T>(
  html: string,
  use: (page: Page) => Promise<T>,
  viewport?: { width: number; height: number },
): Promise<T> {
  const { chromium } = await import('playwright');

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(viewport ? { viewport } : undefined);
    await page.setContent(html, { waitUntil: 'load' });
    return await use(page);
  } finally {
    await browser.close();
  }
}

/**
 * Print the HTML headless. Margins come from the theme's `@page` rule rather
 * than Playwright options, so screen and print stay in sync with the tokens.
 */
export async function renderPdf(html: string, outPath: string, options: PdfOptions = {}) {
  await withPage(html, async (page) => {
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: outPath,
      format: options.format ?? 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
  });
}

/** Screenshot the rendered HTML. Used for docs and visual review. */
export async function renderScreenshot(html: string, outPath: string, width = 900) {
  await withPage(html, (page) => page.screenshot({ path: outPath, fullPage: true }), {
    width,
    height: 1200,
  });
}
