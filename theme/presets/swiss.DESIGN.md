---
version: alpha
name: Swiss
description: Single-column CV. Near-black on white, hierarchy from type and space alone.
colors:
  background: '#ffffff'
  surface: '#fafafa'
  primary: '#0a0a0a'
  neutral: '#737373'
  accent: '#0a0a0a'
  outline: '#d4d4d4'
typography:
  display-lg:
    fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif"
    fontSize: 22pt
    fontWeight: 700
    lineHeight: 1.1
  title-md:
    fontFamily: '{typography.display-lg.fontFamily}'
    fontSize: 12pt
    fontWeight: 700
    lineHeight: 1.2
  label-sm:
    fontFamily: '{typography.display-lg.fontFamily}'
    fontSize: 10pt
    fontWeight: 700
    letterSpacing: 0.14em
  body-md:
    fontFamily: '{typography.display-lg.fontFamily}'
    fontSize: 10pt
    fontWeight: 400
    lineHeight: 1.5
spacing:
  xs: 0.25rem
  sm: 0.35rem
  md: 1.05rem
  lg: 1.9rem
rounded:
  none: 0
---

# Swiss

## Overview

A CV that looks like it was set, not decorated. The reader is a hiring manager
skimming for evidence in under a minute, and every visual flourish is a thing
they have to look past. Restraint here is not an aesthetic preference; it is
the shortest path between a claim and someone believing it.

## Colors

There is one ink and one paper. `accent` is deliberately identical to
`primary` — the palette has no second colour, so nothing can accidentally
become more important than the words. `neutral` carries dates and locations,
which are context rather than content. `outline` draws the single hairline
under each section heading and appears nowhere else.

## Typography

One family, four roles, separated by size and weight rather than by style.
`label-sm` is the only tracked-out, uppercase level; it marks section
headings so they read as furniture instead of as content. Bullets and prose
share `body-md`, because a bullet is a sentence, not a different species.

## Layout

Single column. Skills and languages flow underneath experience rather than
into a sidebar: a sidebar implies two parallel reading orders, and there is
only one. Generous outer margin (16mm) and a large section step (`lg`) do the
work that rules and boxes would otherwise do.

## Elevation & Depth

None. No shadows, no tonal fills, no cards. Depth on a printed page is a
fiction, and on a CV it costs contrast.

## Shapes

`rounded.none`. Tags are bare words separated by space, not chips — a rounded
rectangle around "PyTorch" adds a border and a fill to communicate nothing the
word did not already say.

## Do's and Don'ts

- **Do** let a section run short. Empty space at the foot of the page reads as
  confidence, not as a gap to fill.
- **Do** keep the accent equal to the ink unless the brand genuinely requires
  otherwise — see the `vivid` preset for the restrained-colour alternative.
- **Don't** add a second font family. If a level needs distinguishing, change
  its size or weight.
- **Don't** reintroduce the sidebar by setting `page.columns` back to two
  tracks; the spacing here is tuned for a single measure.
