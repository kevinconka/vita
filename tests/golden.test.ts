import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compose } from '../src/compose.js';
import { loadContent, loadProfile } from '../src/load.js';

/**
 * Composition has to be deterministic — that is the whole premise of the tool.
 * This pins the real `content/` + `profiles/ml-lead.yaml` to a checked-in
 * resume.json, so any change to filtering, ordering or emit shows up as a diff
 * a human has to look at.
 *
 * Refresh deliberately with: UPDATE_GOLDEN=1 pnpm test
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const goldenPath = join(root, 'tests/__golden__/ml-lead.resume.json');

const serialise = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

describe('golden: ml-lead', () => {
  it('composes to the checked-in resume.json', async () => {
    const content = await loadContent(join(root, 'content'));
    const profile = await loadProfile(join(root, 'profiles'), 'ml-lead');
    const actual = serialise(compose(content, profile, 'ml-lead'));

    if (process.env.UPDATE_GOLDEN) {
      await writeFile(goldenPath, actual, 'utf8');
      return;
    }

    expect(actual).toEqual(await readFile(goldenPath, 'utf8'));
  });

  it('is stable across repeated composes', async () => {
    const content = await loadContent(join(root, 'content'));
    const profile = await loadProfile(join(root, 'profiles'), 'ml-lead');
    const first = serialise(compose(content, profile, 'ml-lead'));
    const second = serialise(compose(content, profile, 'ml-lead'));
    expect(first).toEqual(second);
  });
});
