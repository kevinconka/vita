#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Command } from 'commander';
import { compose } from './compose.js';
import { ContentError, loadContent, loadProfile, loadProfiles } from './load.js';
import { lintContent, lintProfiles, type Diagnostic } from './lint.js';
import { tagUsage } from './tags.js';

/**
 * The CLI is deliberately thin: parse flags, call a module, print. Everything
 * worth testing lives in compose.ts / lint.ts / tags.ts / render.ts.
 */

interface Paths {
  content: string;
  profiles: string;
  out: string;
}

const program = new Command();

program
  .name('vita')
  .description('CV as code: tagged content in, tailored resume out')
  .version('0.1.0')
  .option('-c, --content <dir>', 'content directory', 'content')
  .option('-p, --profiles <dir>', 'profiles directory', 'profiles')
  .option('-o, --out <dir>', 'output directory', 'build');

const paths = (): Paths => {
  const options = program.opts<{ content: string; profiles: string; out: string }>();
  return { content: options.content, profiles: options.profiles, out: options.out };
};

const dim = (s: string) => `[2m${s}[22m`;
const bold = (s: string) => `[1m${s}[22m`;
const red = (s: string) => `[31m${s}[39m`;
const yellow = (s: string) => `[33m${s}[39m`;
const green = (s: string) => `[32m${s}[39m`;

/** Compose one profile and write `build/<slug>/resume.json`. */
async function buildResume(slug: string, { content, profiles, out }: Paths) {
  const store = await loadContent(content);
  const profile = await loadProfile(profiles, slug);
  const resume = compose(store, profile, slug);

  const dir = join(out, slug);
  await mkdir(dir, { recursive: true });
  const jsonPath = join(dir, 'resume.json');
  await writeFile(jsonPath, `${JSON.stringify(resume, null, 2)}\n`, 'utf8');

  return { resume, profile, dir, jsonPath };
}

program
  .command('build')
  .argument('<profile>', 'profile slug, e.g. ml-lead')
  .description('compose a profile into resume.json')
  .action(async (slug: string) => {
    const { jsonPath, profile } = await buildResume(slug, paths());
    console.log(`${green('✓')} ${profile.name} ${dim('→')} ${jsonPath}`);
  });

program
  .command('tags')
  .description('list every tag in the content store with usage counts')
  .action(async () => {
    const usage = tagUsage(await loadContent(paths().content));
    if (usage.length === 0) {
      console.log(dim('no tags found'));
      return;
    }
    const width = Math.max(...usage.map((u) => u.tag.length));
    for (const { tag, count, sections } of usage) {
      console.log(
        `${tag.padEnd(width)}  ${String(count).padStart(3)}  ${dim(sections.join(', '))}`,
      );
    }
    console.log(dim(`\n${usage.length} tags`));
  });

function report(diagnostics: Diagnostic[]): number {
  for (const { level, source, message } of diagnostics) {
    const badge = level === 'error' ? red('error') : yellow('warn ');
    console.log(`${badge} ${dim(source)} ${message}`);
  }
  const errors = diagnostics.filter((d) => d.level === 'error').length;
  const warnings = diagnostics.length - errors;

  if (diagnostics.length === 0)
    console.log(`${green('✓')} content and profiles are valid`);
  else console.log(dim(`\n${errors} error(s), ${warnings} warning(s)`));

  return errors > 0 ? 1 : 0;
}

program
  .command('lint')
  .description('validate content and profiles, and report orphan tags')
  .action(async () => {
    const { content, profiles } = paths();
    const store = await loadContent(content);
    const all = await loadProfiles(profiles);
    process.exitCode = report([...lintContent(store), ...lintProfiles(store, all)]);
  });

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof ContentError) {
      console.error(`${red(bold('✗'))} ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

await main();
