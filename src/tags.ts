import type { Content } from './schema.js';

export interface TagUsage {
  tag: string;
  /** Total occurrences across entries and bullets. */
  count: number;
  /** Which sections the tag appears in, sorted. */
  sections: string[];
}

/** Every tagged thing in the store, paired with the section it came from. */
function* walk(content: Content): Generator<{ section: string; tags: string[] }> {
  for (const entry of content.work) {
    yield { section: 'work', tags: entry.tags };
    for (const bullet of entry.highlights) yield { section: 'work', tags: bullet.tags };
  }
  for (const entry of content.education) {
    yield { section: 'education', tags: entry.tags };
    for (const bullet of entry.courses) yield { section: 'education', tags: bullet.tags };
  }
  for (const entry of content.skills) {
    yield { section: 'skills', tags: entry.tags };
    for (const bullet of entry.keywords) yield { section: 'skills', tags: bullet.tags };
  }
  for (const entry of content.languages) yield { section: 'languages', tags: entry.tags };
  for (const entry of content.projects) {
    yield { section: 'projects', tags: entry.tags };
    for (const bullet of entry.highlights)
      yield { section: 'projects', tags: bullet.tags };
  }
}

/** Tag usage counts, most-used first, ties broken alphabetically. */
export function tagUsage(content: Content): TagUsage[] {
  const counts = new Map<string, { count: number; sections: Set<string> }>();

  for (const { section, tags } of walk(content)) {
    for (const tag of tags) {
      const usage = counts.get(tag) ?? { count: 0, sections: new Set<string>() };
      usage.count += 1;
      usage.sections.add(section);
      counts.set(tag, usage);
    }
  }

  return [...counts.entries()]
    .map(([tag, { count, sections }]) => ({ tag, count, sections: [...sections].sort() }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** The set of tags that exist anywhere in the content store. */
export function knownTags(content: Content): Set<string> {
  return new Set(tagUsage(content).map((usage) => usage.tag));
}
