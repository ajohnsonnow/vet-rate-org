# Affiliation Palettes — color spec & accessible-accent derivation

> **Status:** Sprint 0 deliverable (the approved plan:
> `~/.claude/plans/let-s-have-different-color-delightful-puppy.md`).
> This document is the single source of truth for the affiliation theming feature.
> Sprint 3 (Haiku) transcribes the **Verified accent table** below into
> `tokens/source/palettes.json`. Sprint 1 (Sonnet) implements the **Technical
> contract**. Sprint 5 (Haiku) re-verifies every value with the automated test.

---

## 1. What an affiliation palette is

A palette re-points the app's two **brand-accent** CSS variables — and nothing that
governs page background or body text. Those stay owned by the accessibility *mode*
(light / dark / TBI / AAA) and colorblind classes. This is the orthogonal-axes design
from the plan: any affiliation works in any mode because a palette only touches accents.

| Variable | Role | Required contrast | Where it shows |
|---|---|---|---|
| `--va-blue` | **Anchor** — AA-grade accent usable as text | **≥ 4.5:1** vs its surface | heading accents, primary button/header fills (with opposite-color text), active nav, links |
| `--va-gold` | **Brand accent** — vivid identity color, non-text UI | **≥ 3:1** vs its surface | badges, borders, focus glow, gradient stops, large/decorative marks |

Both are already consumed app-wide via `.text-va-blue` / `.bg-va-blue` /
`.text-va-gold` / `.bg-va-gold` in [src/index.css](../src/index.css#L1770-L1785) and the
Tailwind `brand` colors in [tailwind.config.js](../tailwind.config.js#L11-L20). Palettes
add no new consumption surface — they only change the values.

### Why two tiers (and why official colors get darkened in light mode)
Many official service colors are *bright* (Army gold `#FFCB05`, Coast Guard orange
`#F57E20`). Bright warm colors fail even the 3:1 UI threshold on white — `#FFCB05` on
white is ~1.5:1. So a palette records the **raw** brand color for fidelity but ships a
**derived** accent tuned to the threshold *per surface*: darkened for light mode,
lightened for dark mode. The true vivid color typically appears in **dark mode**, where
it passes comfortably (Army gold on a dark card = 10.3:1).

---

## 2. Layering precedence (accessibility over branding)

When more than one axis is active, the more accessibility-critical layer wins:

```
AAA-High-Contrast  >  Colorblind mode  >  Affiliation palette  >  Light/Dark mode
```

- **Light & Dark** — the palette fully expresses; both variants are WCAG-AA verified
  (this is each palette's "body of WCAG-compliant sub-versions").
- **TBI-Comfort** — keeps its purpose-built warm amber accents; palette hue is suppressed
  (warm-comfort medical mode must not be re-tinted). Anchor falls back to parchment
  `#e8d5b5`, accent to service gold `#c5a059`.
- **Colorblind (prot/deut/trit/high-contrast)** — keeps the existing safe-spectrum
  accents in [index.css](../src/index.css#L544-L688); palette hue is suppressed so the
  colorblind guarantee is never weakened.
- **AAA** — snaps to the AAA token set (anchor `#ffffff`/`#000000`, accent `#ffff00`,
  focus `#00ffff`); branding yields entirely to 7:1 contrast.

**Consequence for implementation:** per-palette data is only needed for **Light and
Dark**. The specialized modes are uniform across palettes, so Sprint 1's generator does
*not* emit per-palette colorblind/AAA/TBI rules — it emits two blocks per palette
(`html.light.palette-X`, `html.dark.palette-X`) and relies on existing higher-specificity
mode rules to win. *(Future enhancement, out of scope: per-palette colorblind-safe tints
so a veteran keeps a hint of branch identity under colorblind modes.)*

---

## 3. Verified accent table

> **Source of truth is `tokens/source/palettes.json`, gated by
> `src/__tests__/a11y/palette-contrast.test.js`.** The table below is the original
> Sprint 0 derivation. Phase 8 re-tuned some values against *real rendered usage*
> discovered by the e2e axe pass: dark `--va-blue` now equals the light (dark,
> white-text-fill-safe) value because `.bg-va-blue` is a fill with white text; and
> `flag` / `juneteenth` / `women-veterans` `--va-gold` were brightened so the dark
> text the app places on `.bg-va-gold` clears 4.5:1 (vs `--text-primary` `#1a1f16`).
> See also the **Brand channel** section for the `--brand-*` ramp that recolors the
> whole blue/accent surface.

All values below were computed against a conservative light surface (`#ffffff`) and dark
card surface (`#1a2620`) and **verified** to meet their threshold (anchor ≥4.5:1, accent
≥3:1). Ratios in parentheses. These are starting committed values; Sprint 5's test is the
permanent gate. Bright official colors are reproduced faithfully in the **Dark gold**
column (where they pass) and darkened in **Light gold**.

| Palette `id` | Group | Raw brand (cite §6) | Light `--va-blue` | Light `--va-gold` | Dark `--va-blue` | Dark `--va-gold` |
|---|---|---|---|---|---|---|
| `default` | Default | green/gold (existing) | **no class — unchanged** | | | |
| `army` | Branch | `#000000` + `#FFCB05` | `#000000` (21.0) | `#b59004` (3.0) | `#bdbdbd` (8.6) | `#ffcb05` (10.3) |
| `navy` | Branch | `#00205B` + `#C5B783` | `#00205b` (15.5) | `#a0946a` (3.0) | `#7a8baa` (4.6) | `#c5b783` (7.8) |
| `air-force` | Branch | `#00308F` + `#A7A8AA` | `#00308f` (11.5) | `#949596` (3.0) | `#6e8abf` (4.5) | `#a7a8aa` (6.6) |
| `marines` | Branch | `#AB0520` + `#C5A572` | `#ab0520` (7.6) | `#ac9064` (3.0) | `#ce6c7c` (4.5) | `#c5a572` (6.7) |
| `coast-guard` | Branch | `#003B71` + `#F57E20` | `#003b71` (11.3) | `#e6761e` (3.0) | `#6c8ead` (4.6) | `#f57e20` (5.9) |
| `space-force` | Branch | `#1B2A4A` + `#A7A8AA` | `#1b2a4a` (14.2) | `#949596` (3.0) | `#828a9b` (4.5) | `#a7a8aa` (6.6) |
| `national-guard` | Branch | `#00205B` + `#FFC72C` | `#00205b` (15.5) | `#b88f20` (3.0) | `#7a8baa` (4.6) | `#ffc72c` (10.0) |
| `reserves` | Branch | `#0A4D2E` + `#C5B783` | `#0a4d2e` (9.9) | `#a0946a` (3.0) | `#6a9380` (4.5) | `#c5b783` (7.8) |
| `pride` | Inclusive | `#6D2380` + `#FF8C00` | `#6d2380` (9.5) | `#df7b00` (3.0) | `#a77ab2` (4.5) | `#ff8c00` (6.7) |
| `flag` | Inclusive | `#3C3B6E` + `#B22234` | `#3c3b6e` (10.3) | `#b22234` (6.6) | `#8887a6` (4.5) | `#bd4150` (3.0) |
| `pow-mia` | Remembrance | `#1a1a1a` + grayscale | `#1a1a1a` (17.4) | `#8a8a8a` (3.5) | `#bdbdbd` (8.6) | `#9a9a9a` (5.4) |
| `gold-star` | Remembrance | `#3C3B6E` + `#FFB81C` | `#3c3b6e` (10.3) | `#c18b15` (3.0) | `#8887a6` (4.5) | `#ffb81c` (9.0) |
| `purple-heart` | Remembrance | `#5D2A6E` + `#C5A572` | `#5d2a6e` (10.4) | `#ac9064` (3.0) | `#9e7fa8` (4.5) | `#c5a572` (6.7) |
| `women-veterans` | Remembrance | `#6A1B4D` + `#0F8B8D` | `#6a1b4d` (11.2) | `#0f8b8d` (4.1) | `#aa7c99` (4.5) | `#19a6a8` (4.6) |
| `juneteenth` | Remembrance | `#C8102E` + `#0A6B3B` | `#c8102e` (5.9) | `#0a6b3b` (6.6) | `#db6377` (4.5) | `#2e8f63` (3.8) |
| `native-code-talker` | Remembrance | `#9A3324` + `#E8A33D` | `#9a3324` (7.3) | `#c38933` (3.0) | `#bc786e` (4.5) | `#e8a33d` (7.3) |

> A few dark-mode accent values above were nudged brighter than the bare-minimum
> threshold for legibility (e.g. `pow-mia` dark gold `#9a9a9a`, `women-veterans` dark gold
> `#19a6a8`); the automated test only enforces the floor, so headroom is fine.

`--focus-ring` follows `--va-gold` per palette unless a mode overrides it.

---

## 4. Cultural-sensitivity notes (require Sprint 7 human review)

These are not just color choices; they carry meaning. Flagging the judgment calls:

- **`pride`** — based on the **Intersex-Inclusive Progress Pride** flag (Quasar 2018 +
  Vecchietti 2021). The full multi-stripe flag is *informational/decorative only* and may
  appear as a non-interactive header motif. All **interactive** accents use a single
  high-contrast solid (purple anchor `#6D2380` + orange `#FF8C00`) so meaning never rides
  on color alone (WCAG 1.4.1). Do not chop or reorder the flag's stripes in any rendered
  motif.
- **`pow-mia`** — somber by intent: black + grayscale, no vivid accent. Avoid celebratory
  styling. Pairs with the "You Are Not Forgotten" ethos; keep it austere.
- **`gold-star`** — references the Gold Star service banner (gold star = a fallen family
  member). Respectful, not decorative. Confirm copy/labeling treats it as honoring loss.
- **`juneteenth`** — colors drawn from the Juneteenth flag / Pan-African family. Verify
  with the intended community framing; do not conflate symbols.
- **`native-code-talker`** — honors Native American code talkers. The four-directions /
  medicine-wheel colors are **sacred** in many nations. The earth-tone palette here
  (red/ochre) deliberately *evokes* without reproducing a specific sacred arrangement.
  **Sprint 7 must confirm** this framing is respectful, or replace with a
  Code-Talker-specific commemorative palette. When unsure, prefer restraint.
- **`women-veterans`** — no single official flag exists; plum + teal is a designed,
  non-appropriative choice. Open to revision.

Naming, labels, and short descriptions for each live in `src/config/affiliations.js`
(Sprint 2) and must be reviewed alongside colors.

---

## 5. Technical contract (for Sprint 1 — Sonnet)

**Class axis.** `ThemeContext` adds one class to `<html>`: `palette-<id>` (e.g.
`palette-army`), applied in the existing class-application effect
([ThemeContext.jsx:59-103](../src/contexts/ThemeContext.jsx#L59-L103)) alongside the mode
and colorblind classes. `default` applies no palette class (zero-risk no-op).

**Generated CSS.** Extend the Style Dictionary pipeline
([style-dictionary.config.mjs](../style-dictionary.config.mjs),
[scripts/build-tokens.mjs](../scripts/build-tokens.mjs)) to read
`tokens/source/palettes.json` and emit `src/generated/palette-themes.css` containing, per
palette, exactly two blocks:

```css
html.light.palette-army { --va-blue:#000000; --va-gold:#b59004; --focus-ring:#b59004; }
html.dark.palette-army  { --va-blue:#bdbdbd; --va-gold:#ffcb05; --focus-ring:#ffcb05; }
```

**Precedence — enforced in JS, not CSS specificity.** The generated palette rules use
2-class selectors (`html.light.palette-X`) and would otherwise out-rank the 1-class
colorblind blocks (`html.cb-*`). Rather than fight the cascade, precedence lives in
`ThemeContext`: the `palette-<id>` class is only added when **no colorblind mode is
active** (and the palette selectors themselves require `.light`/`.dark`, so TBI/AAA are
no-ops). This keeps the colorblind/AAA `--va-blue`/`--va-gold` overrides byte-identical
to their pre-feature form. Sprint 5 must assert: with a palette selected **and** a
colorblind mode active, `document.documentElement` carries **no** `palette-*` class
(so computed `--va-blue` is the colorblind value, e.g. deuteranopia `#003f88`).

**Import.** Add `@import` for the generated file near the existing token import in
[src/index.css](../src/index.css), after the mode `:root`/`html.dark` blocks and before
the colorblind section, so source order reinforces precedence.

**No visual change for `default`.** With palette `default` (no class), every existing
value is untouched. This must hold — it's the safety property for shipping.

---

## 5a. Brand channel — recoloring the blue/accent surface

The two-tier `--va-blue` / `--va-gold` accents (§1) only cover heading accents, primary
fills, focus rings and a handful of decorative marks. Much of the app's surface is still
painted with Tailwind's **blue family** directly (`bg-blue-600`, `text-blue-500`,
`bg-blue-900/30`, etc.) plus the adjacent **indigo / sky / cyan** families. The *brand
channel* lets an affiliation palette recolor that entire blue/accent surface at once,
without touching any component class.

### The channel-var mechanism (why channels, not hex)

`tailwind.config.js` remaps `blue`, `indigo`, `sky`, and `cyan` to CSS custom properties:

```js
blue: { 600: "rgb(var(--brand-600) / <alpha-value>)", /* …50–950 */ },
```

The app uses **opacity modifiers** on these utilities — `bg-blue-600/10`,
`@apply bg-blue-900/30`, `@apply bg-indigo-800/50` (see [src/index.css](../src/index.css)).
Tailwind can only synthesize the `/<alpha>` variant when the color is written as
`rgb(var(--brand-N) / <alpha-value>)`, which in turn requires the variable to hold
**space-separated RGB channels** — `--brand-600: 37 99 235;` — *not* a hex string. A hex
value such as `var(--brand-600, #2563eb)` cannot be slotted into `rgb(… / <alpha>)` and
**breaks the CSS build**. So every `--brand-*` value is emitted as bare channels.

### One ramp, four families

`blue`, `indigo`, `sky`, and `cyan` all point at the **same** `--brand-*` ramp. They
collapse into a single brand hue so a palette only has to define one 11-step scale. The
baseline lives in `:root` and is the **verbatim Tailwind v3 default blue scale**, so the
`default` palette (no `palette-*` class) is byte-for-byte the original blue and is visually
unchanged.

### Semantics are intentionally preserved

Only the blue-adjacent families are remapped. `green` / `emerald` / `teal` (success),
`red` / `rose` (error/danger), `amber` / `yellow` / `orange` (warning), `purple` /
`violet`, and `gray` / `slate` (neutral chrome) are **left alone**. Meaning that rides on
those hues — a green success toast, a red destructive button — keeps its semantic color
under every affiliation. Re-tinting them would let branding override safety signals.

### How the ramp is derived from the brand base

Each palette carries a single `brand` hex in
[tokens/source/palettes.json](../tokens/source/palettes.json), sitting at the **600/700**
weight. `scripts/build-tokens.mjs` (`deriveBrandRamp`) expands it into 11 channel stops and
writes `html.palette-<id> { --brand-50 … --brand-950: <channels>; }` into
[src/generated/palette-themes.css](../src/generated/palette-themes.css):

- **Light shades (50–500)** mix the base toward white (50 = 5% base, … 500 = 85% base).
- **Dark shades (800–950)** mix the base toward black (800 = 70% base … 950 = 35% base).
- **600 = base**, **700 = base darkened ~12%**.
- **Contrast guard:** after computing 600 and 700, each is checked for ≥ 4.5:1 contrast
  vs white (WCAG relative-luminance formula) and progressively darkened toward black until
  it passes. This matters for light/warm bases — Army gold `#9a7a00` and Gold-Star
  `#8a6a00` are auto-darkened so `bg-blue-600`-style text/fills stay legible on white.
- All channels are rounded to integers and clamped 0–255.

The [palette-contrast test](../src/__tests__/a11y/palette-contrast.test.js) parses the
generated CSS and asserts `--brand-600` and `--brand-700` clear 4.5:1 for every palette, so
the build is the permanent gate. Run `npm run build:tokens` after editing a `brand` base.

> **Usage caveat:** because *informational* blue now reads as the branch color, a few
> spots that used blue purely to mean "info" (not brand) will take on the affiliation hue —
> e.g. the "Roadmap" nav button and info panels. This is intended (blue = brand surface),
> but if a future element needs a fixed, non-brand info-blue, give it an explicit semantic
> color rather than `blue-*`.

---

## 6. Sources (raw brand color references)

- US Army brand (black + Philippine gold `#FFCB05`): Army brand portal / palette card —
  https://www.mwrbrandcentral.com/application/files/3616/7942/8646/US_Army_Guidelines_09FEB_FINAL_1.pdf
- US Navy design guide (navy + gold): https://usnavy.github.io/Navy-Design-Guide/brand-colors.html
- US Air Force / Space Force palette (TIOH): https://www.dvidshub.net/image/9471524/us-air-force-and-space-force-color-palette
- USMC scarlet & gold: https://en.wikipedia.org/wiki/Flag_of_the_United_States_Marine_Corps
- Coast Guard blue + racing-stripe orange: http://www.paulnoll.com/Colors/gov-07-CG.html
- Intersex-Inclusive Progress Pride flag colors:
  https://www.flagcolorcodes.com/intersex-inclusive-progress-pride
- US flag (Old Glory red `#B22234` / blue `#3C3B6E`): standard PMS-derived web values.
- WCAG contrast thresholds (4.5:1 text, 3:1 large/UI): https://webaim.org/articles/contrast/

> Brand colors are reproduced for veteran identification, used non-commercially. Official
> service marks/logos are **not** bundled — this feature is color only.
