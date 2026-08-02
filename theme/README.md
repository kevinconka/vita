# theme

The vendored renderer. This *is* the brand — vita ships it as source, not as a
dependency, so you can restyle it freely without forking a package.

| File            | What it is                                                      |
| --------------- | --------------------------------------------------------------- |
| `tokens.json`   | Every brand value. Compiled to CSS custom properties at render.  |
| `style.css`     | Structure and typography. Reads `var(--…)` only.                 |
| `template.hbs`  | Handlebars markup for a JSON Resume document.                    |

## The one rule

`style.css` and `template.hbs` must not contain a literal colour, font family
or brand size. If you need one, add it to `tokens.json` — a nested key
`color.accent` becomes `--color-accent`. That is what keeps "change a token,
see it in the PDF" true.

## Attribution

The layout and typographic scale are derived from the
[`even`](https://github.com/rbardini/jsonresume-theme-even) JSON Resume theme
by Rafael Bardini, MIT licensed (see `NOTICE`). The markup was rewritten in
Handlebars and the styling reworked around tokens; no upstream code is used
verbatim.
