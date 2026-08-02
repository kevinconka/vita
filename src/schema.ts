import { z } from 'zod';

/**
 * Content and profile models for vita.
 *
 * Two layers live here:
 *
 * 1. **Content** — the tagged source of truth under `content/`. Every entry may
 *    carry `tags` and `priority`, which drive composition but are *not* part of
 *    JSON Resume and get stripped before emit.
 * 2. **Profile** — the tag query under `profiles/` that selects a CV variant.
 *
 * Field names follow JSON Resume (https://jsonresume.org/schema) wherever a
 * counterpart exists, so composition is mostly a filter-and-strip, not a remap.
 */

/** Fields every taggable thing shares. Stripped from the emitted resume.json. */
const taggable = {
  /** Tags a profile can select on. Free-form, lowercase-kebab by convention. */
  tags: z.array(z.string()).default([]),
  /** Higher sorts earlier within a section. Defaults to 0. */
  priority: z.number().default(0),
};

/** A single tagged bullet. `text` is Markdown; inline formatting is rendered. */
export const bulletSchema = z
  .object({
    text: z.string().min(1),
    /**
     * Optional quantified outcome. Appended to `text` as ` — <metrics>` at
     * compose time unless `text` already contains it, so the number survives
     * into resume.json while staying editable as its own field.
     */
    metrics: z.string().optional(),
    /** ISO date (YYYY, YYYY-MM or YYYY-MM-DD) this bullet refers to. */
    date: z.string().optional(),
    ...taggable,
  })
  .strict();

export type Bullet = z.infer<typeof bulletSchema>;

/** ISO 8601 date, truncated to the precision you actually have. */
const isoDate = z
  .string()
  .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'expected YYYY, YYYY-MM or YYYY-MM-DD');

export const workSchema = z
  .object({
    /** Employer. `name` in JSON Resume. */
    name: z.string().min(1),
    position: z.string().min(1),
    url: z.url().optional(),
    location: z.string().optional(),
    startDate: isoDate,
    /** Omit for an ongoing role. */
    endDate: isoDate.optional(),
    summary: z.string().optional(),
    highlights: z.array(bulletSchema).default([]),
    ...taggable,
  })
  .strict();

export const educationSchema = z
  .object({
    institution: z.string().min(1),
    url: z.url().optional(),
    area: z.string().optional(),
    studyType: z.string().optional(),
    startDate: isoDate,
    endDate: isoDate.optional(),
    score: z.string().optional(),
    courses: z.array(bulletSchema).default([]),
    ...taggable,
  })
  .strict();

/**
 * A skill group ("AI Stack", "Dev Stack"). Keywords are tagged individually so
 * a profile can drop irrelevant tools without dropping the whole group.
 */
export const skillSchema = z
  .object({
    name: z.string().min(1),
    level: z.string().optional(),
    keywords: z.array(bulletSchema).default([]),
    ...taggable,
  })
  .strict();

export const languageSchema = z
  .object({
    language: z.string().min(1),
    fluency: z.string().optional(),
    ...taggable,
  })
  .strict();

export const projectSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    url: z.url().optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    highlights: z.array(bulletSchema).default([]),
    ...taggable,
  })
  .strict();

/** JSON Resume `basics`. Not taggable — it is on every variant. */
export const basicsSchema = z
  .object({
    name: z.string().min(1),
    label: z.string().optional(),
    image: z.string().optional(),
    email: z.email().optional(),
    phone: z.string().optional(),
    url: z.url().optional(),
    /** Markdown. Profiles may override it with their own `summary`. */
    summary: z.string().optional(),
    location: z
      .object({
        address: z.string().optional(),
        postalCode: z.string().optional(),
        city: z.string().optional(),
        countryCode: z.string().optional(),
        region: z.string().optional(),
      })
      .optional(),
    /**
     * Optional rather than defaulted: a profile's `basics` block is a
     * `.partial()` of this schema, and a default would materialise an empty
     * array that silently overwrites the real profiles in the override merge.
     */
    profiles: z
      .array(
        z.object({
          network: z.string(),
          username: z.string().optional(),
          url: z.url().optional(),
        }),
      )
      .optional(),
  })
  .strict();

/**
 * The whole content store, merged from every file under `content/`.
 * Each file contributes one or more top-level sections.
 */
export const contentSchema = z
  .object({
    basics: basicsSchema.optional(),
    work: z.array(workSchema).default([]),
    education: z.array(educationSchema).default([]),
    skills: z.array(skillSchema).default([]),
    languages: z.array(languageSchema).default([]),
    projects: z.array(projectSchema).default([]),
  })
  .strict();

export type Content = z.infer<typeof contentSchema>;
export type WorkEntry = z.infer<typeof workSchema>;
export type EducationEntry = z.infer<typeof educationSchema>;
export type SkillEntry = z.infer<typeof skillSchema>;
export type LanguageEntry = z.infer<typeof languageSchema>;
export type ProjectEntry = z.infer<typeof projectSchema>;

/** Sections a profile may order or restrict. */
export const SECTIONS = ['work', 'education', 'skills', 'languages', 'projects'] as const;
export type Section = (typeof SECTIONS)[number];

export const profileSchema = z
  .object({
    /** Human-readable variant name, e.g. "ML Lead". */
    name: z.string().min(1),
    /**
     * Keep entries carrying at least one of these tags. An empty or omitted
     * list keeps everything, so a profile can start broad and subtract.
     */
    include: z.array(z.string()).default([]),
    /** Drop entries carrying any of these tags. Applied after `include`. */
    exclude: z.array(z.string()).default([]),
    /** Cap on top-level entries per section (jobs, schools, skill groups). */
    max_per_section: z.number().int().positive().optional(),
    /** Cap on bullets kept per work entry, applied after filtering. */
    max_highlights: z.number().int().positive().optional(),
    /**
     * Tag precedence, used to break ties between entries of equal `priority`.
     * An entry ranks by the position of its earliest matching tag in this list.
     */
    order: z.array(z.string()).default([]),
    /** Section order in the output. Omitted sections are dropped. */
    sections: z.array(z.enum(SECTIONS)).optional(),
    /** Overrides merged onto `basics`, for tailoring the headline per variant. */
    basics: basicsSchema.partial().optional(),
  })
  .strict();

export type Profile = z.infer<typeof profileSchema>;
