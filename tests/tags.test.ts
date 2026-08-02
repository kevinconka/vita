import { describe, expect, it } from 'vitest';
import { knownTags, tagUsage } from '../src/tags.js';
import { contentSchema } from '../src/schema.js';
import type { Content } from '../src/schema.js';

const content = (overrides: Record<string, unknown> = {}): Content =>
  contentSchema.parse(overrides);

describe('tagUsage', () => {
  it('counts entry tags and bullet tags together', () => {
    const store = content({
      work: [
        {
          name: 'Acme',
          position: 'Engineer',
          startDate: '2020-01',
          tags: ['eng'],
          highlights: [
            { text: 'a', tags: ['eng', 'ship'] },
            { text: 'b', tags: ['eng'] },
          ],
        },
      ],
    });
    expect(tagUsage(store)).toEqual([
      { tag: 'eng', count: 3, sections: ['work'] },
      { tag: 'ship', count: 1, sections: ['work'] },
    ]);
  });

  it('records every section a tag appears in, sorted', () => {
    const store = content({
      work: [{ name: 'A', position: 'B', startDate: '2020', tags: ['ml'] }],
      education: [{ institution: 'C', startDate: '2019', tags: ['ml'] }],
      skills: [{ name: 'D', tags: ['ml'] }],
    });
    expect(tagUsage(store)[0]).toEqual({
      tag: 'ml',
      count: 3,
      sections: ['education', 'skills', 'work'],
    });
  });

  it('walks skill keywords, education courses and project highlights', () => {
    const store = content({
      skills: [{ name: 'S', tags: [], keywords: [{ text: 'k', tags: ['kw'] }] }],
      education: [
        {
          institution: 'E',
          startDate: '2019',
          courses: [{ text: 'c', tags: ['course'] }],
        },
      ],
      projects: [{ name: 'P', highlights: [{ text: 'h', tags: ['proj'] }] }],
      languages: [{ language: 'English', tags: ['lang'] }],
    });
    const tags = tagUsage(store).map((u) => u.tag);
    expect(tags).toEqual(['course', 'kw', 'lang', 'proj']);
  });

  it('sorts by count descending, then alphabetically', () => {
    const store = content({
      work: [
        {
          name: 'A',
          position: 'B',
          startDate: '2020',
          tags: [],
          highlights: [
            { text: 'x', tags: ['zebra', 'apple'] },
            { text: 'y', tags: ['apple'] },
            { text: 'z', tags: ['mango'] },
          ],
        },
      ],
    });
    expect(tagUsage(store).map((u) => [u.tag, u.count])).toEqual([
      ['apple', 2],
      ['mango', 1],
      ['zebra', 1],
    ]);
  });

  it('returns nothing for an empty store', () => {
    expect(tagUsage(content())).toEqual([]);
  });
});

describe('knownTags', () => {
  it('collects every tag as a set', () => {
    const store = content({
      work: [
        {
          name: 'A',
          position: 'B',
          startDate: '2020',
          tags: ['one'],
          highlights: [{ text: 'x', tags: ['two'] }],
        },
      ],
    });
    expect(knownTags(store)).toEqual(new Set(['one', 'two']));
  });
});
