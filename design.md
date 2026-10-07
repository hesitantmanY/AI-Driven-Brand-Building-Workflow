# Design — 中小企业市场分析与品牌布局

Locked design system for the workshop tool. Every page reads this file first
before emitting code. The visual/interaction layer is redesigned in place;
workshop JS modules, IDs, and class names are unchanged.

## Genre

editorial

## Macrostructure family

- App pages: Workbench (5 步骤横向 tabs + sticky masthead + tab-scoped sub-steps)
- Content pages: Long Document (策划书 / 报告汇总)
- Per-page placeholder sections: Marquee Quote (PEST 1×4 quadrant · Hallmark-List 3-col item)

## Theme

A cold-white-paper, ink-on-paper editorial system. Single ink, restrained accent
on functional surfaces only. **Hex (sRGB) is the source of truth in `tokens.css`**
— OKLCH was used during design exploration but caused perceptible colour drift
on certain displays (paper reading as cream rather than white). The hex values
below are the canonical system; OKLCH approximations are listed for design
intent only and should NOT be used in code.

- `--color-paper`   `#ffffff`   (≈ oklch(100% 0 0))         — pure white paper, body background
- `--color-paper-2` `#f6f6f6`   (≈ oklch(96.5% 0 0))         — inset surface (plates, MVO, callout) — barely-there grey
- `--color-ink`     `#1a1a1a`   (≈ oklch(17% 0 0))           — near-black ink, body text & strong rules
- `--color-ink-2`   `#6b6b6b`   (≈ oklch(53% 0 0))           — secondary text, hairlines on paper-2
- `--color-rule`    `#dcdcdc`   (≈ oklch(85% 0 0))           — hairlines on paper — barely-there cool grey
- `--color-accent`  `#6b2e1a`   (≈ oklch(33% 0.085 35))     — burnt-sienna accent (selective: maroon-soft, primary button fill, link)
- `--color-accent-ink` `#ffffff`                                — text on accent surface
- `--color-warn`    `#8b3a1a`   (≈ oklch(43% 0.130 35))     — error / delete
- `--color-focus`   `#2c5fb3`   (≈ oklch(45% 0.150 260))    — focus ring (cool blue, contrasts with warm system)

## Typography

- Display: Playfair Display 700/900 (Latin) · ChillDuanCN 700 (CJK, web font) — display headings roman（全站禁斜体：所有文字一律 font-style: normal，包括 em / 标签 / 图表 SVG 文本）
- Body:    Lora 400/500 (Latin) · ChillDuanCN 400 (CJK) — paragraphs, field labels（同样禁斜体，用字重/颜色区分层级）
- Mono:    JetBrains Mono 400/500 (Latin) · ChillDuanCN 400 (CJK) — eyebrows, tags, table headers, monospaced data
- Display tracking: -0.01em
- Type scale anchor:
  - `text-display`  = clamp(3rem, 5vw + 1rem, 5.25rem)  — masthead / step hero
  - `text-3xl`      = 2.5rem
  - `text-2xl`      = 1.875rem
  - `text-xl`       = 1.375rem
  - `text-md`       = 1.0625rem
  - `text-sm`       = 0.875rem
  - `text-xs`       = 0.75rem

## Spacing

4-point named scale. The values are in `tokens.css`. Pages must use named
tokens (`var(--space-md)`), never raw values.

- `3xs` 0.25rem · `2xs` 0.5rem · `xs` 0.75rem
- `sm`  1.25rem · `md` 2rem    · `lg` 3rem
- `xl`  4.5rem  · `2xl` 6.5rem · `3xl` 9rem

Section padding is generous: `xl` between sub-steps, `2xl` between workshops.

## Motion

- Easings: cubic-bezier(0.16, 1, 0.3, 1) → `--ease-out`
- Reveal pattern: opacity + 8px translateY, 320 ms, no stagger above 3 items
- Bar / progress: GPU-only `transform: scaleX()` from left, 500 ms
- Reduced-motion fallback: opacity crossfade, 150 ms, no transform

## Microinteractions stance

- Silent success: AI run completion swaps button label, no toast
- Hover delay 800 ms · focus delay 0 ms
- Buttons: hover emphasizes the border; pressing adds an inset outline. No movement, scaling or expanding underline.
- Tag chip remove: `color` crossfade 120 ms
- No bounce, no overshoot, no decorative parallax

## CTA voice

- Primary, AI draft and step/workshop CTA: ink fill with paper text, square corners,
  mono typography; draft titles use the established display font.
- Secondary and add: paper fill, ink text and rule border; add labels name the object.
- Delete, clear and overwrite: warning text and border are visible at rest; labels name the object and range.
- Selected: ink fill and paper text with `aria-pressed` or current-item semantics; hover retains the selected state.
- Hover: border emphasis. Focus-visible: blue outline. Press: inset outline, no translate or scale.
- Disabled: semantic disabled state and reduced emphasis, no hover/press action; explain the reason where needed.
- AI: a single call can only be stopped; a multi-call task can pause, then only stop. There is no resume action.
  Other AI controls are disabled while one task runs. Regenerate directly replaces results; pipelines restart the complete group.
- All buttons square (radius 0), no pill, no shadow

## Per-page allowances

- App pages (workshop steps): typography + plates + tables, no decorative imagery
- Demo annotation strip (`demo-note`): allowed everywhere in demo mode
- AI box: uses the same ink primary button and explicit task-state text.

## What pages MUST share

- The masthead (sticky, 2 px ink rule under, 18×32 padding)
- The 5-tab strip (sticky, 1 px ink rule under, tab-num + mono caps)
- The subtab strip (1 px ink rule, ink-2 hover, accent active rule)
- The accent colour, never repainted
- The display + body fonts
- The button voice (square, stable hierarchy, visible keyboard focus and inset press feedback)
- The plate / card style (1 px rule, paper fill, no shadow)
- The table style (mono 12px, ink-2 row heads, no zebra)
- The chip style (1 px rule, paper-2 fill, 5×10 padding)

## What pages MAY differ on

- Section heading rhythm: h2 40 px default, AI box allows 22–24 px italic,
  persona-quote allows 24 px italic, masthead uses 26 px
- Step body padding (default `lg`, sticky sub-steps get `md`)
- Plate label (defaults to mono caps 10 px 0.18em, AI box uses step number variant)

## Desktop interaction boundary

The editing workbench supports widths of at least 1024 CSS px. Narrower windows show the width notice
and retain the full desktop interface with horizontal scrolling. The notice follows the visible viewport;
it does not create a read-only mode. Tables scroll locally at supported desktop widths. Resizing changes
presentation only, preserving input, location and save status.

Delete targets are at least 24×24 CSS px on desktop and 44×44 on touch, with no overlapping hit areas.
Icon actions provide matching object descriptions on hover and keyboard focus. Low-risk deletion offers
an independent 10-second undo per item; hover/focus pauses its timer and navigation retains it. Successful
workspace replacement ends prior undo entries. Confirmation focuses Cancel, traps focus and restores it on exit.

## Exports

### tokens.css (drop-in)

```css
:root {
  --color-paper:        #ffffff;
  --color-paper-2:      #f6f6f6;
  --color-ink:          #1a1a1a;
  --color-ink-2:        #6b6b6b;
  --color-rule:         #dcdcdc;
  --color-accent:       #6b2e1a;
  --color-accent-soft:  #f6f6f6;
  --color-accent-ink:   #ffffff;
  --color-warn:         #8b3a1a;
  --color-focus:        #2c5fb3;

  --font-display: 'Playfair Display', 'ChillDuanCN', Georgia, "Songti SC", serif;
  --font-body:    'Lora', 'ChillDuanCN', Georgia, "Songti SC", serif;
  --font-mono:    'JetBrains Mono', 'ChillDuanCN', ui-monospace, "Microsoft YaHei", monospace;

  --space-3xs: 0.25rem; --space-2xs: 0.5rem; --space-xs: 0.75rem;
  --space-sm:  1.25rem; --space-md:  2rem;   --space-lg: 3rem;
  --space-xl:  4.5rem;  --space-2xl: 6.5rem; --space-3xl: 9rem;

  --text-xs: 0.75rem;    --text-sm: 0.875rem;   --text-md: 1.0625rem;
  --text-lg: 1.375rem;   --text-xl: 1.75rem;    --text-2xl: 1.875rem;
  --text-3xl: 2.5rem;    --text-display: clamp(3rem, 5vw + 1rem, 5.25rem);

  --rule-hair: 1px; --rule-strong: 2px;
  --radius-card: 0; --radius-pill: 0; --radius-input: 0;

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-short: 120ms; --dur-base: 220ms; --dur-reveal: 320ms;
}
```
