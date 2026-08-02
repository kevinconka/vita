import { describe, expect, it } from 'vitest';
import { compose, isEmpty } from '../src/compose.js';
import { contentSchema, profileSchema } from '../src/schema.js';
import type { Content, Profile } from '../src/schema.js';

/** Minimal store so each case exercises one rule at a time. */
const content = (overrides: Record<string, unknown> = {}): Content =>
  contentSchema.parse({
    basics: { name: 'Test Person' },
    work: [
      {
        name: 'Acme',
        position: 'Engineer',
        startDate: '2020-01',
        tags: ['eng'],
        highlights: [
          { text: 'Shipped a thing', tags: ['ship'], priority: 10 },
          { text: 'Wrote a doc', tags: ['docs'], priority: 20 },
          { text: 'Fixed a bug', tags: ['ship', 'legacy'], priority: 30 },
        ],
      },
    ],
    ...overrides,
  });

const profile = (overrides: Partial<Profile> = {}): Profile =>
  profileSchema.parse({ name: 'Test', ...overrides });

const highlights = (resume: Record<string, unknown>): string[] =>
  ((resume.work as { highlights?: string[] }[])?.[0]?.highlights ?? []) as string[];

describe('filtering', () => {
  it('keeps everything when include is empty', () => {
    expect(highlights(compose(content(), profile(), 't'))).toHaveLength(3);
  });

  it('keeps only entries carrying an include tag', () => {
    const resume = compose(content(), profile({ include: ['ship'] }), 't');
    expect(highlights(resume)).toEqual(['Fixed a bug', 'Shipped a thing']);
  });

  it('lets exclude win over include', () => {
    const resume = compose(
      content(),
      profile({ include: ['ship'], exclude: ['legacy'] }),
      't',
    );
    expect(highlights(resume)).toEqual(['Shipped a thing']);
  });

  it('keeps a job whose own tags miss but whose bullets match', () => {
    // The job is tagged `eng`; the profile only asks for `ship`.
    const resume = compose(content(), profile({ include: ['ship'] }), 't');
    expect(resume.work).toHaveLength(1);
    expect(highlights(resume)).toEqual(['Fixed a bug', 'Shipped a thing']);
  });

  it('drops a whole job when the job itself is excluded', () => {
    const resume = compose(content(), profile({ exclude: ['eng'] }), 't');
    expect(resume.work).toBeUndefined();
  });

  it('drops a work entry once nothing is left to say about it', () => {
    const resume = compose(content(), profile({ include: ['nonexistent-tag'] }), 't');
    expect(resume.work).toBeUndefined();
    expect(isEmpty(resume)).toBe(true);
  });

  it('keeps a work entry that still has a summary but no highlights', () => {
    const store = content({
      work: [
        {
          name: 'Acme',
          position: 'Engineer',
          startDate: '2020-01',
          summary: 'Did things.',
          tags: ['eng'],
          highlights: [{ text: 'Irrelevant', tags: ['other'] }],
        },
      ],
    });
    const resume = compose(store, profile({ include: ['eng'] }), 't');
    expect(resume.work).toHaveLength(1);
    expect(highlights(resume)).toEqual([]);
  });
});

describe('ordering', () => {
  it('sorts by priority descending', () => {
    const resume = compose(content(), profile(), 't');
    expect(highlights(resume)).toEqual(['Fixed a bug', 'Wrote a doc', 'Shipped a thing']);
  });

  it('breaks ties on equal priority using the order list', () => {
    const store = content({
      work: [
        {
          name: 'Acme',
          position: 'Engineer',
          startDate: '2020-01',
          tags: ['eng'],
          highlights: [
            { text: 'B', tags: ['beta'] },
            { text: 'A', tags: ['alpha'] },
          ],
        },
      ],
    });
    expect(
      highlights(compose(store, profile({ order: ['alpha', 'beta'] }), 't')),
    ).toEqual(['A', 'B']);
    expect(
      highlights(compose(store, profile({ order: ['beta', 'alpha'] }), 't')),
    ).toEqual(['B', 'A']);
  });

  it('falls back to document order for otherwise identical entries', () => {
    const store = content({
      work: [
        {
          name: 'Acme',
          position: 'Engineer',
          startDate: '2020-01',
          tags: ['eng'],
          highlights: [
            { text: 'first', tags: ['x'] },
            { text: 'second', tags: ['x'] },
          ],
        },
      ],
    });
    expect(highlights(compose(store, profile(), 't'))).toEqual(['first', 'second']);
  });
});

describe('caps', () => {
  it('caps highlights per work entry', () => {
    const resume = compose(content(), profile({ max_highlights: 2 }), 't');
    expect(highlights(resume)).toEqual(['Fixed a bug', 'Wrote a doc']);
  });

  it('caps top-level entries per section', () => {
    const store = content({
      education: [
        { institution: 'A', startDate: '2010', tags: ['edu'], priority: 2 },
        { institution: 'B', startDate: '2011', tags: ['edu'], priority: 1 },
      ],
    });
    const resume = compose(store, profile({ max_per_section: 1 }), 't');
    expect(resume.education).toEqual([{ institution: 'A', startDate: '2010' }]);
  });
});

describe('emit', () => {
  it('strips tags, priority and metrics from the output', () => {
    const json = JSON.stringify(compose(content(), profile(), 't'));
    expect(json).not.toContain('"tags"');
    expect(json).not.toContain('"priority"');
    expect(json).not.toContain('"metrics"');
  });

  it('folds metrics into the bullet text', () => {
    const store = content({
      work: [
        {
          name: 'Acme',
          position: 'Engineer',
          startDate: '2020-01',
          tags: ['eng'],
          highlights: [
            { text: 'Sped up the pipeline.', metrics: '3x faster', tags: ['x'] },
          ],
        },
      ],
    });
    expect(highlights(compose(store, profile(), 't'))).toEqual([
      'Sped up the pipeline — 3x faster',
    ]);
  });

  it('does not duplicate metrics already present in the text', () => {
    const store = content({
      work: [
        {
          name: 'Acme',
          position: 'Engineer',
          startDate: '2020-01',
          tags: ['eng'],
          highlights: [{ text: 'Made it 3x faster', metrics: '3x faster', tags: ['x'] }],
        },
      ],
    });
    expect(highlights(compose(store, profile(), 't'))).toEqual(['Made it 3x faster']);
  });

  it('honours the section order a profile asks for', () => {
    const store = content({
      education: [{ institution: 'A', startDate: '2010', tags: ['edu'] }],
    });
    const resume = compose(store, profile({ sections: ['education', 'work'] }), 't');
    const keys = Object.keys(resume).filter((k) => k === 'work' || k === 'education');
    expect(keys).toEqual(['education', 'work']);
  });

  it('lets a profile override basics without touching content', () => {
    const resume = compose(content(), profile({ basics: { label: 'Tailored' } }), 't');
    expect(resume.basics).toMatchObject({ name: 'Test Person', label: 'Tailored' });
  });

  it('emits basics supplied only by the profile, with none in content', () => {
    const store = contentSchema.parse({
      work: [
        {
          name: 'Acme',
          position: 'Engineer',
          startDate: '2020-01',
          tags: ['eng'],
          highlights: [{ text: 'x', tags: ['eng'] }],
        },
      ],
    });
    const resume = compose(store, profile({ basics: { label: 'Profile only' } }), 't');
    expect(resume.basics).toEqual({ label: 'Profile only' });
  });

  it('keeps basics fields the profile did not set', () => {
    const store = content({
      basics: {
        name: 'Test Person',
        email: 'test@example.com',
        profiles: [{ network: 'GitHub', username: 'test' }],
      },
    });
    const resume = compose(store, profile({ basics: { label: 'Tailored' } }), 't');
    expect(resume.basics).toMatchObject({
      email: 'test@example.com',
      profiles: [{ network: 'GitHub', username: 'test' }],
    });
  });
});
