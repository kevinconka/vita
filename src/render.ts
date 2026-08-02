import { readFile } from 'node:fs/promises';
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
  handlebars.registerHelper('hostname', (value: unknown) => {
    if (typeof value !== 'string') return '';
    try {
      return new URL(value).hostname.replace(/^www\./, '');
    } catch {
      return value;
    }
  });
}

/* ------------------------------------------------------------------- theme */

/** Read the vendored theme from disk and compile it once. */
export async function loadTheme(dir: string): Promise<Theme> {
  const [templateSource, styles, tokensSource] = await Promise.all([
    readFile(join(dir, 'template.hbs'), 'utf8'),
    readFile(join(dir, 'style.css'), 'utf8'),
    readFile(join(dir, 'tokens.json'), 'utf8'),
  ]);

  const handlebars = Handlebars.create();
  registerHelpers(handlebars);

  const tokens = JSON.parse(tokensSource) as TokenTree;
  // Tokens first: style.css derives its scale from them.
  const css = `${tokensToRootBlock(tokens)}\n\n${styles}`;

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
