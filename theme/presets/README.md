# presets

Alternative token sets for the vendored theme. Each is a complete replacement
for `theme/tokens.json` — the markup and stylesheet never change.

```bash
# preview one without committing to it
mkdir -p /tmp/vita-theme && cp theme/template.hbs theme/style.css /tmp/vita-theme/
cp theme/presets/editorial.json /tmp/vita-theme/tokens.json
pnpm vita --theme /tmp/vita-theme build ml-lead

# adopt one
cp theme/presets/editorial.json theme/tokens.json
```
