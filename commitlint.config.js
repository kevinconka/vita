/**
 * Conventional Commits, so history stays greppable and a changelog can be
 * generated later without rewriting anything.
 *
 *   <type>(<optional scope>): <subject>
 *   feat(compose): cap highlights per work entry
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Scopes used so far. Not enforced as an allow-list — new areas appear and
    // failing a commit over an unlisted scope is friction with no upside.
    'scope-case': [2, 'always', 'kebab-case'],
    // Commit bodies here carry reasoning and quoted output; wrapping them to a
    // hard limit does more harm than good.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
  },
};
