import { readdir, readFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { z } from 'zod';
import { contentSchema, profileSchema, type Content, type Profile } from './schema.js';

/** A validation problem, reported with enough context to fix it. */
export interface Issue {
  file: string;
  path: string;
  message: string;
}

export class ContentError extends Error {
  constructor(readonly issues: Issue[]) {
    super(
      `${issues.length} validation error${issues.length === 1 ? '' : 's'}:\n` +
        issues
          .map((i) => `  ${i.file}${i.path ? ` at ${i.path}` : ''}: ${i.message}`)
          .join('\n'),
    );
    this.name = 'ContentError';
  }
}

const toIssues = (file: string, error: z.ZodError): Issue[] =>
  error.issues.map((i) => ({ file, path: i.path.join('.'), message: i.message }));

const isYaml = (name: string) => ['.yaml', '.yml'].includes(extname(name));

async function listYaml(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && isYaml(e.name))
    .map((e) => join(dir, e.name))
    .sort();
}

/** Sections merge by concatenation in filename order, so loading is stable. */
function mergeSections(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (Array.isArray(existing) && Array.isArray(value)) existing.push(...value);
    else target[key] = value;
  }
}

/**
 * Read every YAML file under `dir` and validate the merged result.
 * Files are read in filename order; array sections concatenate, scalar
 * sections (`basics`) take the last writer.
 */
export async function loadContent(dir: string): Promise<Content> {
  const files = await listYaml(resolve(dir));
  if (files.length === 0)
    throw new ContentError([{ file: dir, path: '', message: 'no YAML files found' }]);

  const merged: Record<string, unknown> = {};
  const issues: Issue[] = [];

  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = parseYaml(await readFile(file, 'utf8'));
    } catch (error) {
      issues.push({ file, path: '', message: (error as Error).message });
      continue;
    }
    if (parsed == null) continue;
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      issues.push({
        file,
        path: '',
        message: 'expected a mapping of sections at the top level',
      });
      continue;
    }
    mergeSections(merged, parsed as Record<string, unknown>);
  }

  if (issues.length) throw new ContentError(issues);

  const result = contentSchema.safeParse(merged);
  if (!result.success) throw new ContentError(toIssues(dir, result.error));
  return result.data;
}

/**
 * True for "this candidate path simply is not there", not for real failures.
 *
 * EISDIR is deliberately absent: a directory sitting where `ml-lead.yaml`
 * should be is a misconfiguration worth reporting, not a file to skip past.
 */
const isMissing = (error: unknown) => {
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'ENOENT' || code === 'ENOTDIR';
};

/** Parse YAML into a `ContentError` rather than letting `YAMLParseError` out. */
function parseOrThrow(file: string, raw: string): unknown {
  try {
    return parseYaml(raw);
  } catch (error) {
    throw new ContentError([{ file, path: '', message: (error as Error).message }]);
  }
}

/** Load one profile by name (`ml-lead` → `profiles/ml-lead.yaml`). */
export async function loadProfile(dir: string, name: string): Promise<Profile> {
  const candidates = [join(dir, `${name}.yaml`), join(dir, `${name}.yml`), resolve(name)];
  for (const file of candidates) {
    let raw: string;
    try {
      raw = await readFile(file, 'utf8');
    } catch (error) {
      // Only a missing candidate means "try the next extension". A permission
      // error reported as "profile not found" would send you hunting for a
      // typo that is not there.
      if (isMissing(error)) continue;
      throw new ContentError([{ file, path: '', message: (error as Error).message }]);
    }
    const result = profileSchema.safeParse(parseOrThrow(file, raw));
    if (!result.success) throw new ContentError(toIssues(file, result.error));
    return result.data;
  }
  throw new ContentError([
    { file: join(dir, `${name}.yaml`), path: '', message: 'profile not found' },
  ]);
}

/** Every profile in `dir`, keyed by its slug (filename without extension). */
export async function loadProfiles(dir: string): Promise<Map<string, Profile>> {
  const files = await listYaml(resolve(dir));
  const profiles = new Map<string, Profile>();
  const issues: Issue[] = [];

  for (const file of files) {
    // Collect parse failures alongside schema failures: `vita lint` should
    // report every broken profile in one pass, not stop at the first.
    let parsed: unknown;
    try {
      parsed = parseYaml(await readFile(file, 'utf8'));
    } catch (error) {
      issues.push({ file, path: '', message: (error as Error).message });
      continue;
    }

    const result = profileSchema.safeParse(parsed);
    if (result.success) profiles.set(basename(file, extname(file)), result.data);
    else issues.push(...toIssues(file, result.error));
  }

  if (issues.length) throw new ContentError(issues);
  return profiles;
}
