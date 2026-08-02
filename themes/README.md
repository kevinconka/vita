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
