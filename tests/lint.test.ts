import { describe, expect, it } from 'vitest';
import { lintContent, lintProfiles } from '../src/lint.js';
import { contentSchema, profileSchema } from '../src/schema.js';
import type { Content, Profile } from '../src/schema.js';

const content = (overrides: Record<string, unknown> = {}): Content =>
  contentSchema.parse(overrides);

const profile = (overrides: Record<string, unknown> = {}): Profile =>
  profileSchema.parse({ name: 'Test', ...overrides });

const messages = (diagnostics: { message: string }[]) =>
  diagnostics.map((d) => d.message);

/** A store with one tagged job, enough for the profile checks to have something to hit. */
const store = () =>
  content({
    work: [
      {
        name: 'Acme',
        position: 'Engineer',
        startDate: '2020-01',
        tags: ['eng'],
        highlights: [{ text: 'Shipped a thing', tags: ['ship'] }],
      },
    ],
  });

describe('lintProfiles', () => {
  it('is quiet when a profile matches real content', () => {
    const profiles = new Map([
      ['ok', profile({ include: ['eng', 'ship'], order: ['ship'] })],
    ]);
    expect(lintProfiles(store(), profiles)).toEqual([]);
  });

  it('flags an orphan tag in include', () => {
    const profiles = new Map([['p', profile({ include: ['eng', 'typoo'] })]]);
    expect(messages(lintProfiles(store(), profiles))).toContain(
      'orphan tag "typoo" in include: no content entry uses it',
    );
  });

  it('flags orphan tags in exclude and order too', () => {
    const profiles = new Map([
      ['p', profile({ include: ['eng'], exclude: ['nope'], order: ['alsonope'] })],
    ]);
    const found = messages(lintProfiles(store(), profiles));
    expect(found).toContain('orphan tag "nope" in exclude: no content entry uses it');
    expect(found).toContain('orphan tag "alsonope" in order: no content entry uses it');
  });

  it('flags a profile that composes to nothing', () => {
    const profiles = new Map([['empty', profile({ exclude: ['eng'] })]]);
    expect(messages(lintProfiles(store(), profiles))).toContain(
      'composes to an empty resume: no entry matches this tag query',
    );
  });

  it('flags a requested section that composes to nothing', () => {
    const profiles = new Map([
      ['p', profile({ include: ['eng', 'ship'], sections: ['work', 'education'] })],
    ]);
    expect(messages(lintProfiles(store(), profiles))).toContain(
      'section "education" is requested but composes to nothing',
    );
  });

  it('does not also report empty sections when the whole profile is empty', () => {
    const profiles = new Map([
      ['empty', profile({ exclude: ['eng'], sections: ['work', 'education'] })],
    ]);
    const found = messages(lintProfiles(store(), profiles));
    expect(
      found.filter((m) => m.includes('is requested but composes to nothing')),
    ).toEqual([]);
  });

  it('warns when there are no profiles at all', () => {
    expect(messages(lintProfiles(store(), new Map()))).toContain('no profiles found');
  });

  it('reports the offending profile by filename', () => {
    const profiles = new Map([['ml-lead', profile({ include: ['typo'] })]]);
    expect(lintProfiles(store(), profiles)[0]?.source).toBe('profiles/ml-lead.yaml');
  });
});

describe('lintContent', () => {
  it('is quiet on a well-formed store', () => {
    expect(lintContent(store())).toEqual([]);
  });

  it('warns about a job with neither summary nor highlights', () => {
    const bare = content({
      work: [{ name: 'Acme', position: 'Engineer', startDate: '2020-01', tags: ['eng'] }],
    });
    expect(messages(lintContent(bare))).toContain(
      'work entry "Engineer at Acme" has neither summary nor highlights',
    );
  });

  it('errors when a job ends before it starts', () => {
    const backwards = content({
      work: [
        {
          name: 'Acme',
          position: 'Engineer',
          startDate: '2020-01',
          endDate: '2019-01',
          tags: ['eng'],
          highlights: [{ text: 'x', tags: ['y'] }],
        },
      ],
    });
    const diagnostics = lintContent(backwards);
    expect(diagnostics[0]?.level).toBe('error');
    expect(diagnostics[0]?.message).toContain(
      'ends (2019-01) before it starts (2020-01)',
    );
  });

  it('warns about a bullet no profile could ever select', () => {
    const untagged = content({
      work: [
        {
          name: 'Acme',
          position: 'Engineer',
          startDate: '2020-01',
          tags: ['eng'],
          highlights: [{ text: 'An untagged bullet', tags: [] }],
        },
      ],
    });
    expect(messages(lintContent(untagged))[0]).toContain('untagged bullet');
  });

  it('accepts an ongoing role with no end date', () => {
    const ongoing = content({
      work: [
        {
          name: 'Acme',
          position: 'Engineer',
          startDate: '2020-01',
          tags: ['eng'],
          highlights: [{ text: 'x', tags: ['y'] }],
        },
      ],
    });
    expect(lintContent(ongoing)).toEqual([]);
  });
});
