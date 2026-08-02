# themes

Complete alternative themes — each has its own `template.hbs`, `style.css` and
`tokens.json`, so they differ in **layout and structure**, not just colour.
`theme/` at the repo root stays the default.

```bash
pnpm vita --theme themes/noir build ml-lead
pnpm vita --theme themes/timeline build ml-lead
```

Adopt one by copying it over the default: `cp themes/noir/* theme/`.

| Theme      | Structure                                                            |
| ---------- | -------------------------------------------------------------------- |
| `noir`     | Dark ground, section labels in the left margin, hairline rules       |
| `timeline` | Vertical rail with date markers; content offset right of the line    |
| `grid`     | Graph-paper ground, brutalist bordered cells, monospace throughout   |
| `magazine` | Cream stock, oversized serif masthead, drop cap, multi-column skills |

## Reference-derived

| Theme     | Source                       | The idea                                                                                   |
| --------- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| `aurora`  | [Linear](https://linear.app) | Surface ladder + hairlines instead of shadows; one chromatic accent; a single indigo bloom |
| `keynote` | Apple product pages          | A hero allowed to waste space, then everything else as spec rows                           |

Token values for `aurora` come from Linear's published
[DESIGN.md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md),
not from eyeballing screenshots.

### Fitting to one page

These are tuned to fill A4 exactly, so edits push them over. Measure rather
than guess — lay the HTML out at **794px** (210mm), and remember the `@page`
margin comes off the available height twice:

```
available = 297mm − 2 × page.margin
```
