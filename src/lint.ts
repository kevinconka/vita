import { compose, isEmpty } from './compose.js';
import { knownTags } from './tags.js';
import type { Content, Profile } from './schema.js';

export interface Diagnostic {
  level: 'error' | 'warn';
  /** Where the problem is, e.g. `profiles/ml-lead.yaml`. */
  source: string;
  message: string;
}

/**
 * Check profiles against the content store.
 *
 * Schema validation already happened at load time, so this catches the class
 * of mistake a schema cannot see: a tag query that quietly matches nothing.
 */
export function lintProfiles(
  content: Content,
  profiles: Map<string, Profile>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const known = knownTags(content);

  if (profiles.size === 0) {
    diagnostics.push({
      level: 'warn',
      source: 'profiles/',
      message: 'no profiles found',
    });
  }

  for (const [slug, profile] of profiles) {
    const source = `profiles/${slug}.yaml`;

    // An orphan tag is almost always a typo, and it fails silently otherwise:
    // include misses, exclude excludes nothing, order ranks nothing.
    for (const [field, tags] of [
      ['include', profile.include],
      ['exclude', profile.exclude],
      ['order', profile.order],
    ] as const) {
      for (const tag of tags) {
        if (!known.has(tag)) {
          diagnostics.push({
            level: 'warn',
            source,
            message: `orphan tag "${tag}" in ${field}: no content entry uses it`,
          });
        }
      }
    }

    const resume = compose(content, profile, slug);
    if (isEmpty(resume)) {
      diagnostics.push({
        level: 'warn',
        source,
        message: 'composes to an empty resume: no entry matches this tag query',
      });
      continue;
    }

    for (const section of profile.sections ?? []) {
      if (!(section in resume)) {
        diagnostics.push({
          level: 'warn',
          source,
          message: `section "${section}" is requested but composes to nothing`,
        });
      }
    }
  }

  return diagnostics;
}

/** Content-side hygiene that the schema cannot express. */
export function lintContent(content: Content): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const entry of content.work) {
    const label = `${entry.position} at ${entry.name}`;
    if (entry.highlights.length === 0 && !entry.summary) {
      diagnostics.push({
        level: 'warn',
        source: 'content/',
        message: `work entry "${label}" has neither summary nor highlights`,
      });
    }
    if (entry.endDate && entry.endDate < entry.startDate) {
      diagnostics.push({
        level: 'error',
        source: 'content/',
        message: `work entry "${label}" ends (${entry.endDate}) before it starts (${entry.startDate})`,
      });
    }
    for (const bullet of entry.highlights) {
      if (bullet.tags.length === 0) {
        diagnostics.push({
          level: 'warn',
          source: 'content/',
          message: `untagged bullet in "${label}": no profile can select it — "${bullet.text.slice(0, 60)}…"`,
        });
      }
    }
  }

  return diagnostics;
}
