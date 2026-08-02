# Fonts

All three families are licensed under the SIL Open Font License 1.1, which
permits embedding and redistribution.

| Family           | Designer / Foundry              | Source                                             |
| ---------------- | ------------------------------- | -------------------------------------------------- |
| Instrument Serif | Instrument                      | https://fonts.google.com/specimen/Instrument+Serif |
| Instrument Sans  | Instrument / Rodrigo Fuenzalida | https://fonts.google.com/specimen/Instrument+Sans  |
| DM Mono          | Colophon Foundry                | https://fonts.google.com/specimen/DM+Mono          |

Latin subsets only, to keep the embedded payload near 90 KB.

## Adding a face

Drop a `.woff2` into this directory named:

```
<Family_Name>-<weight>-<style>.woff2

Instrument_Serif-400-italic.woff2
Instrument_Sans-400-700-normal.woff2    # variable: a weight range
```

Underscores become spaces; nothing else is transformed. Name the family
exactly as your CSS asks for it — `DM_Mono`, not `dm-mono`. The renderer
inlines whatever it finds as base64 `@font-face` rules, with no manifest
to keep in sync.
