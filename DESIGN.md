---
name: StashPlugins
description: One searchable index of every community Stash plugin source, with review status and install snippets.
colors:
  signal-amber: "#f5b041"
  amber-ink: "#1a1306"
  amber-wash: "rgb(245 176 65 / 0.12)"
  workbench-ink: "#0e1015"
  raised-slate: "#151821"
  sunken-ink: "#0a0c10"
  hover-slate: "#1b1f2a"
  hairline-slate: "#252a36"
  edge-slate: "#343a49"
  chalk: "#e8eaf0"
  fog-grey: "#a3a9b8"
  dust-grey: "#7f8696"
  control-slate: "#636a7b"
  verified-mint: "#4ccb8f"
  revoked-coral: "#f0716b"
  ui-cornflower: "#7aa7ff"
  theme-orchid: "#e58bd8"
  burnt-amber: "#c27803"
  deep-ochre: "#965a00"
  amber-wash-light: "rgb(194 120 3 / 0.1)"
  bench-paper: "#f7f7f5"
  paper-white: "#ffffff"
  sunken-paper: "#efefec"
  hover-paper: "#f1f1ee"
  paper-hairline: "#e2e2dd"
  paper-edge: "#cfcfc8"
  press-ink: "#17181c"
  graphite: "#4d5260"
  pewter: "#676c7a"
  control-pewter: "#80848f"
  ui-cobalt: "#2a5fcc"
  theme-plum: "#a1358f"
  backend-green: "#127650"
  brick-red: "#b42318"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(30px, 5.2vw, 52px)"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(26px, 4vw, 38px)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  card-title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 650
    lineHeight: 1.2
  lede:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  body-small:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.06em"
  tag:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "11.5px"
    fontWeight: 550
    lineHeight: "20px"
  mono:
    fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Code', 'JetBrains Mono', Menlo, Consolas, monospace"
    fontSize: "0.86em"
    lineHeight: 1.6
  hash:
    fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Code', 'JetBrains Mono', Menlo, Consolas, monospace"
    fontSize: "12px"
rounded:
  inline: "4px"
  xs: "6px"
  radius-sm: "8px"
  radius: "12px"
  pill: "999px"
components:
  button:
    backgroundColor: "{colors.raised-slate}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.radius-sm}"
    padding: "0 14px"
    height: "36px"
  button-hover:
    backgroundColor: "{colors.hover-slate}"
  button-primary:
    backgroundColor: "{colors.signal-amber}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.radius-sm}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "color-mix(in srgb, #f5b041 88%, white)"
  button-sm:
    padding: "0 12px"
    height: "30px"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.fog-grey}"
    rounded: "{rounded.radius-sm}"
    size: "30px"
  icon-button-hover:
    backgroundColor: "{colors.hover-slate}"
    textColor: "{colors.chalk}"
  nav-link:
    textColor: "{colors.fog-grey}"
    rounded: "{rounded.radius-sm}"
    padding: "6px 10px"
  nav-link-active:
    backgroundColor: "{colors.hover-slate}"
    textColor: "{colors.chalk}"
  search-input:
    backgroundColor: "{colors.raised-slate}"
    textColor: "{colors.chalk}"
    rounded: "14px"
    padding: "0 64px 0 50px"
    height: "56px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.fog-grey}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "32px"
  chip-selected:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.workbench-ink}"
  tag:
    backgroundColor: "{colors.sunken-ink}"
    textColor: "{colors.fog-grey}"
    typography: "{typography.tag}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
  select:
    backgroundColor: "{colors.raised-slate}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.radius-sm}"
    padding: "0 30px 0 10px"
    height: "32px"
  card:
    backgroundColor: "{colors.raised-slate}"
    rounded: "{rounded.radius}"
    padding: "16px 16px 12px"
  panel:
    backgroundColor: "{colors.raised-slate}"
    rounded: "{rounded.radius}"
    padding: "18px"
  tabs:
    backgroundColor: "{colors.sunken-ink}"
    rounded: "10px"
    padding: "3px"
  tab:
    textColor: "{colors.fog-grey}"
    rounded: "7px"
    padding: "0 10px"
    height: "32px"
  tab-selected:
    backgroundColor: "{colors.raised-slate}"
    textColor: "{colors.chalk}"
  code-block:
    backgroundColor: "{colors.sunken-ink}"
    textColor: "{colors.chalk}"
    typography: "{typography.mono}"
    rounded: "{rounded.radius-sm}"
    padding: "14px 90px 14px 16px"
  copy-button:
    backgroundColor: "{colors.raised-slate}"
    textColor: "{colors.fog-grey}"
    rounded: "{rounded.xs}"
    padding: "0 10px"
    height: "28px"
  dialog:
    backgroundColor: "{colors.raised-slate}"
    textColor: "{colors.chalk}"
    rounded: "16px"
    width: "min(640px, calc(100vw - 24px))"
  selection-bar:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.workbench-ink}"
    rounded: "{rounded.pill}"
    padding: "8px 8px 8px 16px"
  toast:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.workbench-ink}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
---

# Design System: StashPlugins

## Overview

**Creative North Star: "The Workbench Index"**

StashPlugins is a quiet, dense tool surface. It is meant to sit in a tab next to someone's Stash instance and answer three questions fast: what is this plugin, can I trust this exact version, and how do I install it. The default world is a dark workbench (Workbench Ink, with slightly lifted Raised Slate surfaces and recessed Sunken Ink wells), lit by a single signal color, Signal Amber. Everything else is neutral, so amber always means "act here" or "this is the brand".

Density is a feature. Cards carry a title, a clamped description, a tag row, a two-column metadata strip and an action row inside 16px of padding; grids pack at 290px minimum with 14px gutters. Hierarchy comes from tone (three text greys), weight and hairlines, not from size jumps or decoration. Mono type is reserved for things a user will actually paste or verify: install snippets, source URLs, package hashes, keyboard hints.

A light theme mirrors the same structure on warm paper neutrals with a darker Burnt Amber, chosen from `prefers-color-scheme` and persisted via the header toggle. Both themes share radii, spacing and component geometry; only the tone tokens swap.

**Key Characteristics:**
- Dark workbench by default, warm paper light theme with identical structure.
- One signal color (amber) for primary action, focus, selection and the brand mark.
- Flat tonal layering; soft shadows only on the search field, dialog and floating selection bar.
- Hairline borders define every container.
- Mono only for real code, URLs and hashes.
- Status colors (mint, coral) and plugin-type hues live only inside small tags, dots and rails.

## Colors

A near-monochrome slate (or paper) neutral ramp carrying one amber signal, with a small set of semantic hues confined to tags and status markers.

### Primary
- **Signal Amber** (dark, `--accent`): primary buttons, the selected-card outline, the search field's focus border, focus rings (`--focus`), the "Plugins" half of the wordmark, accented words in the hero headline, and the favicon's package mark. Also doubles as the hybrid plugin-type hue in the dark theme.
- **Burnt Amber** (light, `--accent`): the same roles in the light theme; darker so it holds up as a fill and outline on paper.
- **Amber Ink** (`--accent-ink`, both themes): text on amber fills.
- **Deep Ochre** (light, `--accent-text`): amber used as small text on paper (the "Changed since review" tag), darkened to hold 4.5:1. In the dark theme `--accent-text` is Signal Amber itself.
- **Amber Wash** / **Amber Wash Light** (`--accent-soft`): the 4px focus halo around the search field. Never a surface fill.

### Secondary
Semantic status, used only at tag, dot and rail scale:
- **Verified Mint** (dark) / **Backend Green** (light) (`--ok`): verified tags (tinted 10% background, 45% border), the verified count in the hero stats, healthy-source dots, the "copied" state of copy buttons, and the left rail of a verified review box. Also the backend plugin-type hue in the dark theme.
- **Revoked Coral** (dark) / **Brick Red** (light) (`--err`): revoked tags, failing-source dots, the left rail of a revoked review box.

### Tertiary
Plugin-type hues, one per type, applied as tag text plus a 35% border:
- **UI Cornflower** (dark) / **UI Cobalt** (light) (`--t-ui`): UI plugins.
- **Theme Orchid** (dark) / **Theme Plum** (light) (`--t-theme`): themes.
- **Verified Mint** (dark) / **Backend Green** (light) (`--t-backend`): task (backend) plugins.
- **Signal Amber** (dark) / **Deep Ochre** (light) (`--t-hybrid`): UI plus tasks.

### Neutral
- **Workbench Ink** (dark) / **Bench Paper** (light) (`--bg`): page background, also the translucent base of the sticky header.
- **Raised Slate** (dark) / **Paper White** (light) (`--bg-raised`): cards, panels, buttons, selects, the search field, the dialog, table wrappers.
- **Sunken Ink** (dark) / **Sunken Paper** (light) (`--bg-sunken`): wells: code blocks, copy fields, the tab track, tags, inline code.
- **Hover Slate** (dark) / **Hover Paper** (light) (`--bg-hover`): hover and current-page fill for nav links, buttons and icon buttons; avatar placeholder.
- **Hairline Slate** (dark) / **Paper Hairline** (light) (`--line`): default 1px border on every container and divider.
- **Edge Slate** (dark) / **Paper Edge** (light) (`--line-strong`): border on buttons and copy buttons, hover border on cards and chips, link underlines, scrollbar thumb.
- **Control Slate** (dark) / **Control Pewter** (light) (`--control-line`): border of text fields and selects (search, source and sort selects, target form inputs), tuned to 3:1 against every surface.
- **Chalk** (dark) / **Press Ink** (light) (`--text`): primary text; also the fill of selected chips, the selection bar and the toast (inverted surfaces).
- **Fog Grey** (dark) / **Graphite** (light) (`--text-2`): descriptions, secondary copy, resting nav links, unselected chips and tabs.
- **Dust Grey** (dark) / **Pewter** (light) (`--text-3`): metadata labels, counts, placeholders, breadcrumbs, footer. Tuned to stay legible at 11 to 13px on both grounds.

### Named Rules
**The One Signal Rule.** Amber is the only accent. It marks the primary action, focus, selection and the brand; it never fills a large surface or decorates a heading for its own sake.

**The Tag-Scale Rule.** Status and plugin-type hues appear only as tag text, tag borders, 7px dots and 3px review rails. They never color a card, a button or body text.

**The Control Edge Rule.** Anything you type into or pick from (text fields, selects) is outlined in the control-line tone, not a hairline, so its boundary is visible at 3:1 on every surface.

**The Inversion Rule.** Transient, floating feedback (the selection bar, the toast) and the selected filter chip invert to text-on-text: a Chalk (or Press Ink) fill with background-colored type. Inversion means "this is the active state", not amber.

## Typography

**Display Font:** the platform UI sans stack (`ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica Neue, Arial`)
**Body Font:** the same stack
**Label/Mono Font:** the platform mono stack (`ui-monospace, SF Mono, Cascadia Code, JetBrains Mono, Menlo, Consolas`)

**Character:** one native sans at every level, so the site reads like part of the user's own tooling; weight and tracking do the work that a second family would elsewhere.

### Hierarchy
- **Display** (800, clamp 30px to 52px, line-height 1.2, tracking -0.03em): the home hero headline only, capped at 16ch, with key words picked out in amber.
- **Headline** (700, clamp 26px to 38px, line-height 1.2, tracking -0.01em): plugin detail titles; page headers use the same treatment capped at 36px.
- **Title** (700, 18px): section headings and dialog titles; panel headings drop to 15px.
- **Card Title** (650, 16px): plugin names on cards; wraps anywhere rather than truncating.
- **Lede** (400, 17px, Fog Grey): hero subcopy (max 58ch) and the detail page summary; page-head intros run to 70ch.
- **Body** (400, 15px, line-height 1.55): base text and README prose.
- **Body Small** (13px to 14px): nav links, chips, buttons, card descriptions (14px, clamped to three lines), metadata values.
- **Label** (400, 11px, uppercase, tracking 0.06em, Dust Grey): term labels in metadata grids and table column headers (600 there). These label data that follows them directly; they are not section kickers.
- **Tag** (550, 11.5px, 20px line box): tag pills.
- **Mono** (0.86em of context, line-height 1.6 in blocks; 12px for hashes and source paths): code, snippets, URLs, hashes, `kbd`.

### Named Rules
**The Real-Code Rule.** Mono is for strings a user will paste, compare or verify (snippets, URLs, SHA-256 hashes, key hints). Never set labels, numbers or headings in mono for flavor.

**The Tabular Numbers Rule.** Counts, dates and stats use `font-variant-numeric: tabular-nums` so columns of figures do not jitter as filters change.

## Layout

A single centered column capped at 1240px, with 16px side padding below 720px and 28px above. Content pages narrow the column (780px for the guide, 900px for review, 640px for the not-found page). The home page stacks a centered hero (56px top padding), a 680px search field, a hairline-bottomed toolbar (filter chips left, selects and toggles right, wrapping freely), a result count, then an auto-fill card grid (`minmax(290px, 1fr)`, 14px gap).

The plugin detail page is one column below 980px and a two-column grid above it (fluid main plus a 420px aside that sticks 80px from the top, clearing the 60px sticky header). Facts render as an auto-fill grid of 150px cells separated by inset hairlines.

Spacing has no token scale; it runs on a tight, mostly even rhythm of 4, 6, 8, 10, 12, 14, 16, 18, 20 and 28px, with 6 to 10px gaps inside controls and 14 to 28px between blocks. Large jumps (40px, 56px, 60px) occur only at page heads, the hero and the footer.

Below 560px the "How to install" nav link and the search `kbd` hint are hidden and the header tightens (8px gap, 8px link padding) so the brand, three links and the theme toggle fit one line at 360px. On coarse pointers, small controls (icon buttons, small buttons, chips, nav links, copy buttons, card pick boxes, toggles) grow invisible hit areas to about 44px without moving layout, and selects and form inputs step up to 16px text. Headings balance their line breaks; paragraphs and list items use pretty wrapping; README prose blocks cap at 72ch. Wide tables and tab tracks scroll horizontally inside their containers rather than reflowing.

## Elevation & Depth

The system is flat by default and builds depth through tone: Sunken Ink wells sit below the Workbench Ink page, which sits below Raised Slate surfaces, each edged with a 1px hairline. Shadows are reserved for three things that float or invite input: the search field, the install dialog and the floating selection bar. The selected tab gets a tiny lift so it reads as a pressed key in its track.

### Shadow Vocabulary
- **Field shadow** (`--shadow`; dark: `0 1px 0 rgb(255 255 255 / 0.03) inset, 0 8px 24px -12px rgb(0 0 0 / 0.6)`; light: `0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -16px rgb(0 0 0 / 0.18)`): the hero search field at rest.
- **Focus halo** (`0 0 0 4px` Amber Wash): replaces the field shadow when the search field is focused.
- **Dialog shadow** (`0 30px 80px -20px rgb(0 0 0 / 0.6)`, over a `rgb(5 6 10 / 0.6)` backdrop with 3px blur): the install dialog.
- **Floating bar shadow** (`0 16px 40px -10px rgb(0 0 0 / 0.5)`): the selection bar pinned 18px above the viewport bottom.
- **Tab lift** (`0 1px 2px rgb(0 0 0 / 0.25), 0 0 0 1px` hairline): the selected tab in the install panel.

### Named Rules
**The Flat-By-Default Rule.** Cards, panels, tables and fields sit flat with a hairline. A shadow means the element floats above the page or is the primary input; nothing else earns one.

**The Hairline-Not-Shadow Rule.** Card hover strengthens the border (Hairline to Edge); card selection is an amber border plus a 1px inset amber ring. Neither adds a drop shadow.

## Shapes

Gently rounded, never sharp and never blobby. Containers (cards, panels, facts grids, table wrappers) use the 12px radius; controls (buttons, nav links, selects, fields, code wells) use 8px; small fittings (copy buttons, `kbd`) use 6px and inline code 4px. Pills (999px) are reserved for filter chips, tags, person badges, the selection bar and the toast. A few one-offs scale with their element: the search field at 14px, the dialog at 16px, the tab track at 10px with 7px tabs inside. Avatars and status dots are circles.

Borders are always 1px solid hairlines, with three deliberate exceptions: `kbd` keys take a 2px bottom border to read as physical keys, review boxes take a 3px colored left rail, and duplicate-source tags take a dashed border.

The brand mark is an amber line-drawn isometric package (2.4 stroke, rounded joins) on a dark 8px-rounded tile.

## Components

### Buttons
Utilitarian and compact.
- **Shape:** 8px radius, 36px tall (30px small), 1px Edge border.
- **Default:** Raised Slate fill, Chalk text, 500 weight, 14px; hover moves to Hover Slate.
- **Primary:** Signal Amber fill and border, Amber Ink text, 600 weight; hover mixes 12% white into the amber. One primary per card or panel.
- **Ghost:** used on the inverted selection bar: transparent with a 30% background-colored border.
- **Icon button:** 30px square, transparent with no visible border at rest, Fog Grey icon; hover shows Hover Slate fill and a hairline. Icons are inline SVG at 16 to 18px.
- **Focus:** a 2px amber outline at 2px offset on everything focusable.

### Chips
- **Style:** 32px pill, hairline border, transparent fill, Fog Grey 13px text, with a tabular count in Dust Grey.
- **State:** hover strengthens the border and text; pressed (`aria-pressed`) inverts to a Chalk fill with Workbench Ink text, the count at 75% opacity.

### Tags
- **Style:** 20px-tall pills on Sunken Ink with a hairline and Fog Grey 11.5px text.
- **Variants:** plugin-type tags color text and a 35% border; verified tags add a 10% mint tint; changed tags use `--accent-text` with an amber border; revoked tags use coral; duplicate-source tags go Dust Grey with a dashed border.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Raised Slate.
- **Shadow Strategy:** none (see Elevation).
- **Border:** hairline; Edge on hover; amber plus inset amber ring when picked for batch install. The whole card is a link target via a stretched pseudo-element, so the focus ring moves to the card.
- **Internal Padding:** 16px sides and top, 12px bottom, 10px gaps. The metadata strip is a two-column definition grid under a hairline; the source path sits at the foot in 12px mono, truncated with an ellipsis.
- **Panels** (detail aside, README) use 18px padding; **review boxes** use 8px radius with a 3px status rail.

### Inputs / Fields
- **Search:** 56px tall, 14px radius, Raised Slate, control-line border, field shadow, 17px text, magnifier icon inset 18px left and a `kbd` hint right.
- **Focus:** border turns amber and the shadow becomes a 4px Amber Wash halo; no outline.
- **Select:** 32px, 8px radius, control-line border, custom chevron, 13px.
- **Checkboxes and toggles:** native, tinted with `accent-color` amber. The text caret and text selection (amber at 32%) are amber too.
- **Target form inputs:** 34px, Sunken Ink, control-line border, 13px mono (they hold URLs and API keys).

### Navigation
Sticky 60px header on an 82% Workbench Ink mix with a 12px saturating blur and a bottom hairline. Wordmark left ("Stash" in text color, "Plugins" in amber, 700). Nav links right: 14px Fog Grey, 6px by 10px padding, 8px radius; hover and current page get Chalk text on Hover Slate. The theme toggle is an icon button at the end.

### Install Panel (signature)
The core task surface, shared by the dialog and the detail aside.
- **Tabs:** a segmented control: Sunken Ink track with 3px padding, equal-width 32px tabs, selected tab raised to Raised Slate with the tab lift.
- **Copy fields:** a three-column row (86px label, scrolling mono value, copy button) in a Sunken Ink well.
- **Code blocks:** Sunken Ink wells, 14px by 16px padding, mono at 1.6 line-height, a copy button pinned 8px from the top right.
- **Copy button:** 28px (26px small), 6px radius, 12px 550 text with a 14px inline SVG; turns mint with a mint border once copied.

### Selection Bar
A pill pinned bottom-center, inverted (Chalk fill, Workbench Ink text, 14px 550), holding a count, a ghost Clear and a primary "Install selected". It is the only element besides the toast that floats over content.

## Do's and Don'ts

### Do:
- **Do** keep Signal Amber (Burnt Amber in light) to primary actions, focus, selection and the brand mark.
- **Do** build depth with the bg, bg-raised and bg-sunken tones plus 1px hairlines before reaching for a shadow.
- **Do** put code, URLs and hashes in wells (Sunken Ink, 8px radius) with a copy button.
- **Do** use `tabular-nums` for every count, date and stat.
- **Do** define both themes for any new color token; components read only the CSS custom properties, never literal hex.
- **Do** use inline SVG icons drawn with `currentColor`.
- **Do** keep touch targets at about 44px on coarse pointers by growing the hit area, not the visual control.

### Don't:
- **Don't** introduce a second accent hue or use status and plugin-type colors outside tags, dots and rails.
- **Don't** add drop shadows to cards, panels or tables; hover and selection are border changes.
- **Don't** set non-code text in mono.
- **Don't** pill-shape buttons in page content; pills are for chips, tags, people and floating feedback.
- **Don't** border text fields or selects with the hairline; use the control-line tone.
- **Don't** set small amber text with `--accent`; use `--accent-text` so it holds contrast in the light theme.
