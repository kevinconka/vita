---
version: alpha
name: Verso
description: A CV as a type-led poster. Bento grid, near-black ink, one vermillion accent, serif italic reserved for a single pull quote.
colors:
  paper: '#f4f2ee'
  card: '#ffffff'
  ink: '#0d0c0b'
  graphite: '#54514c'
  faint: '#96918a'
  hairline: '#e2ded6'
  vermillion: '#e2431f'
  on-vermillion: '#fffaf6'
typography:
  hero:
    fontFamily: "'Inter Tight'"
    fontSize: 72pt
    fontWeight: 800
    lineHeight: 0.86
    letterSpacing: -0.045em
  headline:
    fontFamily: "'Inter Tight'"
    fontSize: 14pt
    fontWeight: 700
    letterSpacing: -0.018em
  quote:
    fontFamily: "'Instrument Serif'"
    fontSize: 18pt
    fontWeight: 400
    lineHeight: 1.22
  body:
    fontFamily: "'Inter Tight'"
    fontSize: 9.4pt
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'DM Mono'"
    fontSize: 7pt
    letterSpacing: 0.16em
rounded:
  card: 10px
  chip: 4px
spacing:
  xs: 4px
  sm: 10px
  md: 18px
  lg: 26px
  gap: 6px
---

# Verso

## Overview

A CV that behaves like a poster rather than a form. The reader spends five
seconds before deciding whether to spend five minutes, so one element — the
name — is set at a scale nothing else on the page approaches, and everything
after it is organised into cells the eye can enter in any order.

The name comes from the left-hand page of an open book: the side you are not
supposed to be reading, which is where the interesting things usually are.

## Colors

Two neutrals and one accent. The paper is a warm off-white and the cards sit a
shade brighter on top of it, so the grid reads through fill rather than through
borders — a card is visible because it is _lighter_, not because it is outlined.

`vermillion` is the only chromatic value and it is rationed hard: the role line
under the name, one filled cell, the rule above each section label, and nothing
else. The moment it appears twice in the same glance it stops meaning anything.

## Typography

Three faces, three jobs, no overlap:

- **Inter Tight** carries the hero and every headline. At 800 with -0.045em it
  compresses into something that reads as engineered. Below 10pt it drops to
  400 and disappears into body copy.
- **Instrument Serif Italic** appears **once per page**, on the summary, which
  is treated as a pull quote rather than as a paragraph. Using it anywhere else
  spends the contrast and it stops being a moment.
- **DM Mono** sets everything a machine produced: dates, counts, the contact
  line, section labels. If a human wrote it, it is not in mono.

The ratio between hero and body is roughly 7.5:1. That is deliberate and should
not be softened — a 3:1 hero looks like a heading, and a heading is not a
poster.

## Layout

A twelve-column bento grid with a deliberately tight 6px gutter, so cells read
as tiles of one surface rather than as separate floating cards.

```
┌─────────────────────────────────────────────┐
│  masthead — name, role, contact      12 col │
├───────────────────────────────┬─────────────┤
│                               │  quote  4c  │
│  experience              8col ├─────────────┤
│                               │  stack  4c  │
│                               ├─────────────┤
│                               │  edu    4c  │
└───────────────────────────────┴─────────────┘
```

Asymmetry is the point. An 8/4 split gives experience the weight it deserves
while letting the right column carry four different kinds of information
without any of them needing a heading larger than 7pt.

Experience spans eight columns AND three grid rows. That row span is what
makes the bottom edge come out flush: without it each rail cell claims a row
of its own and the last one leaves four columns of dead paper.

## Elevation & Depth

None. No shadows, no gradients. Depth is a fill difference of about 4% between
paper and card, which is enough on screen and survives a laser printer.

## Shapes

`rounded.card` at 10px on cells, 4px on chips. Enough to read as modern,
not enough to read as a UI component. Nothing else is rounded.

## Do's and Don'ts

- **Do** let the hero break to two lines. It is stronger stacked than shrunk.
- **Do** keep the quote to one sentence. It is a pull quote; two sentences make
  it a paragraph and the italic starts to fatigue.
- **Don't** add a second accent colour. If something needs emphasis, make it
  bigger or set it in mono.
- **Don't** outline the cards. The fill is the boundary; adding a border makes
  the grid twice as loud for no extra information.
- **Don't** use vermillion for the employer names. They repeat too often, and
  the accent must not become a texture.
