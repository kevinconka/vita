import type {
  Bullet,
  Content,
  EducationEntry,
  LanguageEntry,
  Profile,
  ProjectEntry,
  Section,
  SkillEntry,
  WorkEntry,
} from './schema.js';
import { SECTIONS } from './schema.js';

/**
 * Composition: content + profile -> resume.json.
 *
 * Deterministic by construction — a tag query, never a rewrite. Same inputs
 * always produce byte-identical output, which is what the golden test pins.
 *
 * The pipeline per section is: filter -> sort -> cap -> strip.
 */

/** Anything the filter can look at. */
interface Taggable {
  tags: string[];
  priority: number;
}

/**
 * Keep an entry when it carries at least one `include` tag (an empty
 * `include` keeps everything) and no `exclude` tag. Exclude always wins.
 */
function matches(entry: Taggable, profile: Profile): boolean {
  if (profile.exclude.some((tag) => entry.tags.includes(tag))) return false;
  if (profile.include.length === 0) return true;
  return profile.include.some((tag) => entry.tags.includes(tag));
}

/**
 * Containers (a job, a degree, a skill group) are kept when they match on
 * their own tags *or* when any of their children do. Without this you would
 * have to repeat every bullet tag on the job that holds them, and a profile
 * that selects on `tracking` would silently lose the job it happened in.
 *
 * `exclude` is not softened this way: excluding a job's tag drops the job and
 * everything under it, which is what "leave this off the CV" has to mean.
 */
function matchesContainer(
  entry: Taggable,
  children: Taggable[],
  profile: Profile,
): boolean {
  if (profile.exclude.some((tag) => entry.tags.includes(tag))) return false;
  if (profile.include.length === 0) return true;
  if (profile.include.some((tag) => entry.tags.includes(tag))) return true;
  return children.some((child) => matches(child, profile));
}

/**
 * Position of the entry's earliest tag in `profile.order`. Unranked entries
 * get MAX_SAFE_INTEGER rather than Infinity so subtracting two ranks always
 * yields a usable number.
 */
function orderRank(entry: Taggable, profile: Profile): number {
  let rank = Number.MAX_SAFE_INTEGER;
  for (const tag of entry.tags) {
    const index = profile.order.indexOf(tag);
    if (index !== -1 && index < rank) rank = index;
  }
  return rank;
}

/** Sortable stand-in for a date; an ongoing entry sorts newest. */
function dateKey(entry: { startDate?: string; endDate?: string }): string {
  if (entry.endDate) return entry.endDate;
  if (entry.startDate) return '9999';
  return '';
}

/**
 * Sort order, most significant first:
 *   1. `priority` descending — the per-entry knob, so it wins
 *   2. `profile.order` tag rank ascending — breaks ties between equal priorities
 *   3. date descending — reverse-chronological within a tie
 *   4. original document order — makes the sort total, and so reproducible
 */
function sortEntries<T extends Taggable & { startDate?: string; endDate?: string }>(
  entries: T[],
  profile: Profile,
): T[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const byPriority = b.entry.priority - a.entry.priority;
      if (byPriority !== 0) return byPriority;

      const byOrder = orderRank(a.entry, profile) - orderRank(b.entry, profile);
      if (byOrder !== 0) return byOrder;

      const byDate = dateKey(b.entry).localeCompare(dateKey(a.entry));
      if (byDate !== 0) return byDate;

      return a.index - b.index;
    })
    .map(({ entry }) => entry);
}

function cap<T>(entries: T[], limit: number | undefined): T[] {
  return limit === undefined ? entries : entries.slice(0, limit);
}

/**
 * Flatten a bullet to the plain string JSON Resume expects. `metrics` is
 * appended as an em-dash clause unless the text already says it, so the
 * number lives in its own field but still reaches the page.
 */
function renderBullet(bullet: Bullet): string {
  const text = bullet.text.trim();
  if (!bullet.metrics) return text;
  const metrics = bullet.metrics.trim();
  if (text.includes(metrics)) return text;
  return `${text.replace(/[.]$/, '')} — ${metrics}`;
}

function selectBullets(bullets: Bullet[], profile: Profile, limit?: number): string[] {
  const kept = sortEntries(
    bullets.filter((bullet) => matches(bullet, profile)),
    profile,
  );
  return cap(kept, limit).map(renderBullet);
}

/** Drop undefined values and empty arrays so resume.json stays clean. */
function compact<T extends Record<string, unknown>>(object: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(object)) {
    if (value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    result[key] = value;
  }
  return result as Partial<T>;
}

/**
 * Filter -> sort -> cap for one section. `children` names the entry's bullets
 * so a container can be kept on the strength of what is inside it.
 */
function selectSection<T extends Taggable>(
  entries: T[],
  profile: Profile,
  children: (entry: T) => Taggable[] = () => [],
): T[] {
  const kept = sortEntries(
    entries.filter((entry) => matchesContainer(entry, children(entry), profile)) as (T & {
      startDate?: string;
      endDate?: string;
    })[],
    profile,
  );
  return cap(kept, profile.max_per_section);
}

const composeWork = (entries: WorkEntry[], profile: Profile) =>
  selectSection(entries, profile, (entry) => entry.highlights)
    .map((entry) =>
      compact({
        name: entry.name,
        position: entry.position,
        url: entry.url,
        location: entry.location,
        startDate: entry.startDate,
        endDate: entry.endDate,
        summary: entry.summary,
        highlights: selectBullets(entry.highlights, profile, profile.max_highlights),
      }),
    )
    // A job with nothing left to say about it is not worth a heading.
    .filter(
      (entry) => entry.summary !== undefined || (entry.highlights?.length ?? 0) > 0,
    );

const composeEducation = (entries: EducationEntry[], profile: Profile) =>
  selectSection(entries, profile, (entry) => entry.courses).map((entry) =>
    compact({
      institution: entry.institution,
      url: entry.url,
      area: entry.area,
      studyType: entry.studyType,
      startDate: entry.startDate,
      endDate: entry.endDate,
      score: entry.score,
      courses: selectBullets(entry.courses, profile),
    }),
  );

const composeSkills = (entries: SkillEntry[], profile: Profile) =>
  selectSection(entries, profile, (entry) => entry.keywords)
    .map((entry) =>
      compact({
        name: entry.name,
        level: entry.level,
        keywords: selectBullets(entry.keywords, profile),
      }),
    )
    .filter((entry) => (entry.keywords?.length ?? 0) > 0);

const composeLanguages = (entries: LanguageEntry[], profile: Profile) =>
  selectSection(entries, profile).map((entry) =>
    compact({ language: entry.language, fluency: entry.fluency }),
  );

const composeProjects = (entries: ProjectEntry[], profile: Profile) =>
  selectSection(entries, profile, (entry) => entry.highlights)
    .map((entry) =>
      compact({
        name: entry.name,
        description: entry.description,
        url: entry.url,
        startDate: entry.startDate,
        endDate: entry.endDate,
        highlights: selectBullets(entry.highlights, profile, profile.max_highlights),
      }),
    )
    .filter(
      (entry) => entry.description !== undefined || (entry.highlights?.length ?? 0) > 0,
    );

/** A JSON Resume document. Loosely typed — the schema is the contract. */
export type Resume = Record<string, unknown>;

const SCHEMA_URL =
  'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json';

/** Compose `content` through `profile` into a JSON Resume document. */
export function compose(content: Content, profile: Profile, profileSlug: string): Resume {
  const basics = { ...content.basics, ...profile.basics };
  const sections: Record<Section, unknown[]> = {
    work: composeWork(content.work, profile),
    education: composeEducation(content.education, profile),
    skills: composeSkills(content.skills, profile),
    languages: composeLanguages(content.languages, profile),
    projects: composeProjects(content.projects, profile),
  };

  const resume: Resume = { $schema: SCHEMA_URL };
  if (content.basics) resume.basics = compact(basics as Record<string, unknown>);

  // `sections` doubles as the output order; omitted sections are dropped.
  for (const section of profile.sections ?? SECTIONS) {
    const entries = sections[section];
    if (entries.length > 0) resume[section] = entries;
  }

  // No timestamps: the output has to be byte-stable for the golden test.
  resume.meta = { profile: profileSlug, profileName: profile.name };
  return resume;
}

/** True when composing produced no content sections at all. */
export function isEmpty(resume: Resume): boolean {
  return SECTIONS.every((section) => !(section in resume));
}
