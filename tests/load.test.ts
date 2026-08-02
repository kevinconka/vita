import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { ContentError, loadContent, loadProfile, loadProfiles } from '../src/load.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'vita-load-'));
});

/** Write one YAML file into the temp store. */
const write = (name: string, body: string) => writeFile(join(dir, name), body, 'utf8');

describe('loadContent', () => {
  it('merges array sections across files in filename order', async () => {
    await write('a-first.yaml', 'work:\n  - {name: A, position: P, startDate: "2020"}\n');
    await write(
      'b-second.yaml',
      'work:\n  - {name: B, position: P, startDate: "2021"}\n',
    );

    const content = await loadContent(dir);
    expect(content.work.map((w) => w.name)).toEqual(['A', 'B']);
  });

  it('accepts .yml as well as .yaml', async () => {
    await write('basics.yml', 'basics:\n  name: Test Person\n');
    expect((await loadContent(dir)).basics?.name).toBe('Test Person');
  });

  it('applies schema defaults for omitted fields', async () => {
    await write('w.yaml', 'work:\n  - {name: A, position: P, startDate: "2020"}\n');
    const entry = (await loadContent(dir)).work[0];
    expect(entry?.tags).toEqual([]);
    expect(entry?.priority).toBe(0);
  });

  it('skips an empty file rather than failing', async () => {
    await write('empty.yaml', '');
    await write('w.yaml', 'work:\n  - {name: A, position: P, startDate: "2020"}\n');
    expect((await loadContent(dir)).work).toHaveLength(1);
  });

  it('rejects a directory with no YAML in it', async () => {
    await expect(loadContent(dir)).rejects.toThrow(/no YAML files found/);
  });

  it('rejects a file whose top level is not a mapping', async () => {
    await write('list.yaml', '- just\n- a\n- list\n');
    await expect(loadContent(dir)).rejects.toThrow(/expected a mapping of sections/);
  });

  it('rejects malformed YAML with the filename attached', async () => {
    await write('broken.yaml', 'work: [unclosed\n');
    await expect(loadContent(dir)).rejects.toThrow(ContentError);
  });

  it('rejects an unknown key instead of silently dropping it', async () => {
    await write(
      'w.yaml',
      'work:\n  - {name: A, position: P, startDate: "2020", tag: [x]}\n',
    );
    await expect(loadContent(dir)).rejects.toThrow(/Unrecognized key/);
  });

  it('rejects a malformed date', async () => {
    await write('w.yaml', 'work:\n  - {name: A, position: P, startDate: "Jan 2020"}\n');
    await expect(loadContent(dir)).rejects.toThrow(/YYYY/);
  });

  it('carries structured issues on the error', async () => {
    await write('w.yaml', 'work:\n  - {position: P, startDate: "2020"}\n');
    const error = await loadContent(dir).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ContentError);
    expect((error as ContentError).issues.length).toBeGreaterThan(0);
  });
});

describe('loadProfile', () => {
  it('resolves a slug to <dir>/<slug>.yaml', async () => {
    await write('ml-lead.yaml', 'name: ML Lead\ninclude: [ml]\n');
    expect((await loadProfile(dir, 'ml-lead')).name).toBe('ML Lead');
  });

  it('falls back to a .yml extension', async () => {
    await write('alt.yml', 'name: Alt\n');
    expect((await loadProfile(dir, 'alt')).name).toBe('Alt');
  });

  it('reports a missing profile by the path it looked for', async () => {
    await expect(loadProfile(dir, 'nope')).rejects.toThrow(/profile not found/);
  });

  it('rejects a profile with an unknown key', async () => {
    await write('bad.yaml', 'name: Bad\nincldue: [typo]\n');
    await expect(loadProfile(dir, 'bad')).rejects.toThrow(/Unrecognized key/);
  });

  it('rejects a non-positive cap', async () => {
    await write('bad.yaml', 'name: Bad\nmax_per_section: 0\n');
    await expect(loadProfile(dir, 'bad')).rejects.toThrow();
  });

  it('reports malformed profile YAML as a ContentError, not a raw parser throw', async () => {
    await write('broken.yaml', 'name: [unclosed\n');
    await expect(loadProfile(dir, 'broken')).rejects.toThrow(ContentError);
  });

  it('does not disguise a read failure as a missing profile', async () => {
    // A directory where a profile file is expected: readFile fails with EISDIR,
    // which must not be swallowed as "try the next candidate".
    await mkdir(join(dir, 'adir.yaml'), { recursive: true });
    const error = await loadProfile(dir, 'adir').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ContentError);
    expect((error as ContentError).message).not.toContain('profile not found');
  });
});

describe('loadProfiles', () => {
  it('keys every profile by its slug', async () => {
    await write('one.yaml', 'name: One\n');
    await write('two.yaml', 'name: Two\n');

    const profiles = await loadProfiles(dir);
    expect([...profiles.keys()].sort()).toEqual(['one', 'two']);
    expect(profiles.get('one')?.name).toBe('One');
  });

  it('returns an empty map for a directory with no profiles', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'vita-empty-'));
    await mkdir(empty, { recursive: true });
    expect((await loadProfiles(empty)).size).toBe(0);
  });

  it('reports every invalid profile at once, not just the first', async () => {
    await write('bad-one.yaml', 'include: [x]\n');
    await write('bad-two.yaml', 'name: 5\n');
    const error = await loadProfiles(dir).catch((e: unknown) => e);
    expect((error as ContentError).issues.length).toBeGreaterThanOrEqual(2);
  });
});
