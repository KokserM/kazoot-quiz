# Kazoot — implementation brief: Direction 1 "Stage Lights"

Written 24 Nov 2026 for the engineer implementing it in `frontend/` (React 19, Vite 7, styled-components 6). Sources: `design-review/review.md`, `design-review/direction-1.html`, every file under `frontend/src`, `frontend/index.html`, the backend payload shapes in `backend/src/game/gameService.js` and `backend/src/validation`, the CSP in `backend/src/http/createApp.js`, and a short measuring pass on the live solo demo at 360×640.

Conventions used below:

- "Existing string" means the text is already in the codebase and is reused verbatim. Every string that does not exist yet is listed in section 13 and nowhere else introduced.
- Sizes are CSS px unless a unit is given. `cqw` / `cqh` are container query units of the game stage (section 8.1).
- "Phone" = viewport width ≤ 560. "Tablet" = 561–1023. "Desktop" = ≥ 1024. Existing breakpoints in the code (760, 800, 860, 900, 1100) are kept where a component already uses them; new rules use 560 / 760 / 1024.

---

## 0. Decisions in one screen

| Question | Decision |
|---|---|
| Theme | **Dark ("stage") is the default for the whole site, for everyone, regardless of `prefers-color-scheme`. A light theme stays as an opt-in switch in the footer.** The game stage is always dark. Details and reasons in section 3. |
| No-scroll gameplay | Every game state renders inside one fixed, viewport-filling `GameShell` (top bar, body, pinned dock). Sizes come from container query units of that shell; a small measuring hook shrinks text to floors when content is long; clamping plus a "Full text" sheet is the last resort. Long lists (full standings, review editor, all players) open in sheets. Section 8. |
| Host action | Always in the pinned dock: last grid row of the shell, inside the safe area, never below the fold. Section 8.3. |
| Big screen | Host-only "Big screen" toggle: fullscreen, larger caps, room code and join address stay on screen, host's own pick is not highlighted. Section 8.10. |
| Social proof | Omitted. No section, no placeholder, no reserved space. |
| Home page | Direction 1 mockup, with six changes listed in section 6.1. |
| Pricing | One switch (packs / monthly), one preferred card per group (visual emphasis only, no "popular" label), per-game price promoted, compact rows on phones, a quiet pay line with Stripe and the seller identity under the buttons. Section 6.2. |
| Seller identity | "Sold by {LEGAL.sellerName}, reg. code {LEGAL.registryCode}" next to every purchase action; "Operated by …" in the footer. Rendered from `LEGAL`, hidden when `hasSellerIdentity` is false, address never shown. Section 5.6. |
| Effects | Fourteen effects, CSS only, animating transform and opacity (one small documented exception), each with a reduced-motion fallback and a budget. Section 10. |
| New UI strings | Ten. Section 13. |

---

## 1. Goals and non-goals

### Goals

1. The marketing site looks like the product at showtime: stage palette, spotlight glows, tile colours as the accent system, a hero that shows a host screen and a phone playing the same question live.
2. All eight quick wins from the review are done:
   1. Final screen after a demo: "Create a quiz" first and primary; a celebration moment.
   2. "Next question" pinned on phones; rank and points are the hero of the reveal.
   3. Real share image (1200×630, absolute URL).
   4. One-tap solo demo; no unexplained disabled buttons.
   5. Hero: duplicate logo lockup removed, host screen plus phone, animated timer.
   6. Pricing: one switch, one preferred option per group, per-game price promoted, compact phone rows.
   7. Dark mode: outline on the logo tile.
   8. The three school/work FAQ answers surfaced as visible content.
3. No game state requires scrolling, for host or player, on any viewport in the matrix in section 2.2.
4. Premium feel without cost: no effect may drop frames on a low-end phone, hide content, or reduce any text pair below WCAG AA.
5. Buyers can see who they are paying, at the point of paying.

### Non-goals

- No new marketing copy, no testimonials, no social-proof section or placeholder.
- No backend changes. In particular: no spectator/display seat, no rank-change data, no new socket events. (A true second-screen display needs a backend role; see section 14.)
- No change to quiz logic, scoring, billing flow, consent step, or auth.
- No new fonts. No illustration, photos or video.
- No Estonian site translation (still a gap; out of scope here).
- No animated leaderboard reordering (FLIP). Rows update in place.
- The business address is not shown anywhere new. `VITE_LEGAL_ADDRESS` stays empty by owner decision.

---

## 2. Acceptance criteria

### 2.1 Site

| # | Criterion | How to check |
|---|---|---|
| S1 | With no stored preference, every site page renders in the dark palette on a device set to light mode and on one set to dark mode. | DevTools → emulate `prefers-color-scheme: light`; `getComputedStyle(document.documentElement).getPropertyValue('--paper')` is `#100A1C`. |
| S2 | Choosing "Light" in the footer switches all non-game pages, survives reload, and causes no flash of the dark theme on reload. | Reload with throttled CPU; first paint is light. |
| S3 | `/session/*` game states are dark in both themes. | Toggle to light, start a demo. |
| S4 | Home page contains no social-proof section, placeholder, or empty reserved block. | Visual; existing test "landing page makes no unsupported claims" still passes. |
| S5 | No horizontal scroll at 320, 360, 393, 412, 430, 768, 1024, 1280, 1920 wide on any page. | `document.documentElement.scrollWidth === innerWidth`. |
| S6 | Every link and button has a hit area ≥ 44×44 on touch devices (footer links, header links, small buttons, FAQ rows, theme switch, menu button). | Inspect box sizes at 360 wide. |
| S7 | On a phone, the home page dock ("Join a game", "Try a free demo") is visible whenever neither the hero buttons nor the finale buttons are in the viewport, and never covers footer content at the end of the page. | Scroll test at 360×640. |
| S8 | Header logo tile is visibly separated from the page in dark: a 1 px ring at ≥ 3:1 against `--paper`. | Ring colour `#7A6FA3` on `#100A1C` = 4.28:1. |
| S9 | `/demo`: a first-time visitor reaches the first question with exactly one tap on the page. | Count taps from page load. |
| S10 | No primary button is ever shown at reduced opacity. Buttons that need input stay enabled and explain on press; buttons that are truly unavailable use the disabled style from 5.1 and have a visible reason next to them. | `/demo`, `/join`, `/create`, `/account`. |
| S11 | `/join`: pasting `abcde-23456`, `ABCDE 23456`, `https://www.kazoot.app/join/ABCDE23456` or `abcde23456` all produce the field value `ABCDE 23456` and a valid form. | Manual + unit test for the helper. |
| S12 | `/create` signed out shows the topic field and the six idea chips; pressing the submit button starts Google sign-in; after returning, the typed topic is still in the field. | Manual with a test account. |
| S13 | Pricing shows either packs or monthly plans, never both; one card per group is visually preferred; each card shows the per-game price at ≥ 0.95rem in `--ink` (not grey); at 360 wide the pricing section is ≤ 1000 px tall. | Measure section height. |
| S14 | Wherever a "Buy …" or "Subscribe to …" control or "Continue to secure payment" is visible, the seller line is visible in the same card/section without scrolling past other content, when `hasSellerIdentity` is true. When it is false, no label, separator or empty row is rendered. | Build once with and once without `VITE_LEGAL_SELLER_NAME`. |
| S15 | Sharing `https://www.kazoot.app/` and `https://www.kazoot.app/join/ABCDE23456` in WhatsApp, iMessage, Slack, Discord and Messenger shows the 1200×630 image. | Manual; plus `curl -sI` on the image URL returns 200 and `image/png`. |
| S16 | Lighthouse mobile on `/`: Performance ≥ 90, Accessibility 100, CLS ≤ 0.02, LCP element is the H1 text. | Lighthouse, Moto G Power preset. |
| S17 | With `prefers-reduced-motion: reduce`, nothing on any page moves except native scrolling and the countdown number/bar in a live game. | Emulate in DevTools. |
| S18 | All contrast pairs in section 11.2 pass; the token contrast test in `App.test.jsx` is extended with the new pairs and passes. | `npm test`. |

### 2.2 Game: viewport matrix

Set these exact viewport sizes in DevTools responsive mode (they are viewport sizes, i.e. what is left after browser bars; the first number of each "with bars" row is my estimate of the visible area and is a test value, not a device spec).

**Portrait phones**

| ID | Viewport | Stands for |
|---|---|---|
| P1 | 320×454 | 320×568 phone (iPhone SE 1st gen class) with browser bars. Worst case. |
| P2 | 320×568 | same, no bars (installed / fullscreen) |
| P3 | 360×560 | 360×640 Android with browser bars. Worst common case. |
| P4 | 360×640 | same, no bars |
| P5 | 375×553 | 375×667 iPhone SE 2/3 with Safari bars |
| P6 | 393×659 | 393×852 with Safari bars |
| P7 | 393×730 | Xiaomi 15 class (393×852) with Chrome bar |
| P8 | 393×852 | same, no bars |
| P9 | 412×780 | Galaxy S-Ultra class (412×915) with Chrome bar |
| P10 | 412×915 | same, no bars |
| P11 | 430×739 | iPhone Pro Max (430×932) with Safari bars |
| P12 | 430×932 | same, no bars |

**Landscape phones**

| ID | Viewport | Stands for |
|---|---|---|
| L1 | 568×270 | 320×568 phone, landscape, with bars. Worst case. |
| L2 | 640×300 | 360×640, landscape, with bars |
| L3 | 667×331 | 375×667, landscape |
| L4 | 852×340 | 393×852, landscape, with bars |
| L5 | 915×360 | 412×915, landscape, with bars |
| L6 | 932×380 | 430×932, landscape, with bars |

**Tablets, laptops, projectors**

| ID | Viewport | Stands for |
|---|---|---|
| T1 | 768×1024 | tablet portrait |
| T2 | 1024×768 | tablet landscape, XGA projector |
| T3 | 820×1180 | tablet portrait |
| T4 | 1180×820 | tablet landscape |
| D1 | 1280×720 | small laptop / 720p TV |
| D2 | 1366×650 | 1366×768 laptop with browser bars |
| D3 | 1280×800 | WXGA projector |
| D4 | 1440×900 | laptop |
| D5 | 1920×1080 | TV / projector, fullscreen |
| D6 | 3840×2160 | 4K TV, fullscreen |

**Content fixtures** (add as `frontend/src/components/game/fixtures.js`; see section 12 step A2)

| ID | Question | Answers | Notes |
|---|---|---|---|
| F-short | 28 chars | 4–10 chars each | e.g. the live demo's first question |
| F-typical | 90 chars | 20–40 chars each | |
| F-long | 240 chars | 4 × 120 chars | schema maximum |
| F-word | 60 chars containing one 28-letter word | one answer is a single 24-letter word | tests wrapping/hyphenation |
| Players | 1, 2, 3, 9 and 150 players; names of 24 chars; topic of 80 chars | | |

**States to test at every viewport × fixture**

1. Lobby, host (with invite panel) and lobby, host in review mode.
2. Lobby, player.
3. Question, unanswered.
4. Question, answer sending, answer locked ("Locked in…"), time up, answer failed.
5. Reveal, host (with "Next question" / "Show final results"), for correct / wrong / no answer.
6. Reveal, player (waiting for host), and with host away / reconnecting.
7. Final, with 1, 2, 3, 9 and 150 players, as demo host signed out, as signed-in host, as player.
8. Each of the above with the connection banner visible (offline / reconnecting).
9. Host states 1, 3, 5, 7 with "Big screen" on at T2, D1–D6.

**What "fits" means** (all must hold, with the page scrolled to 0,0 and no sheet open):

- G1. `document.scrollingElement.scrollHeight <= window.innerHeight` and `scrollWidth <= innerWidth`. The page cannot be scrolled or rubber-banded.
- G2. No element inside the shell has `scrollHeight > clientHeight + 1` unless it is a text element with `data-clamped` (G6).
- G3. Question state: the full boxes of all four answer tiles and the countdown are inside the viewport; each tile is ≥ 44 px tall and ≥ 44 px wide.
- G4. Reveal and lobby, host: the primary button ("Next question", "Show final results", "Start game") is entirely inside the viewport and inside the safe area, ≥ 48 px tall, and is not covered by a toast.
- G5. Text sizes never go below the floors: question 15 px, answers 13 px, status and captions 13 px, leaderboard rows 13 px, tags and badges 12 px.
- G6. Clamped text (`data-clamped`) appears only with fixture F-long (and F-word at P1/L1). When any text is clamped, the "Full text" button is visible in the top bar and opens the complete question and answers.
- G7. Reveal, in every viewport: the outcome block (verdict, points, rank) and the correct answer are fully visible. The leaderboard shows at least the leader and the viewer's own row at every size. Only while the connection banner is showing at P1 may it shrink to the viewer's row alone.
- G8. Final: headline, podium (or the single pedestal) and the dock actions are fully visible. Further standings are behind the existing label "Full standings".
- G9. Rotating the device or showing/hiding the browser bars re-fits within one frame after the resize, without a reload.
- G10. In browsers without container-size queries (`@supports not (container-type: size)`), the game falls back to the current scrolling layout and stays playable.

**Baseline measured on the live site today (360×640, dark, solo demo, short question)**: question screen document height 736 px, fourth answer tile at y = 635–696 (below the fold); reveal screen document height 1,064 px, "Next question" at y = 968–1,024. These are the numbers the shell replaces.

---

## 3. Theme decision

**Decision: dark by default for everyone; light as an explicit, remembered choice; the game stage always dark.**

| Surface | Default | When the visitor picks "Light" |
|---|---|---|
| Home, pricing, demo, join, create | Stage palette with effects | Light palette (today's `LIGHT_COLORS`), same layout, reduced effects (5.7) |
| Account, legal, contact, 404 | Stage palette, no glows or grain (reading surfaces) | Light palette |
| Hero device stage, finale panel | Stage palette (`data-stage-scope`) | Stays stage palette, as today |
| `/session/*` name form, joining, errors | Stage palette | Stage palette (unchanged: `data-stage='true'`) |
| Game states (lobby → final) | Stage palette | Stage palette |
| Print (any page) | Light palette, no backgrounds | Light palette |
| Stripe Checkout / billing portal | Stripe's own pages | Unchanged |

Why not follow `prefers-color-scheme` as today:

1. The point of Direction 1 is that site and game are one look. If the site follows the OS, every visitor on a light-mode device sees the old lavender site, the share image and the game do not match the page they land on, and the identity work is invisible to them.
2. One default means one set of screenshots, one share image, one look to keep polished. A solo founder should not maintain two first-class marketing designs.
3. Dark-only would be cheaper still, but it removes a real accessibility choice (some people read light-on-dark badly, and phones in sunlight favour light). The light tokens already exist and are contrast-tested, so keeping them as an option costs little as long as light is treated as a plain variant (no grain, softer glows) rather than a second design.
4. Legal and account pages follow the same theme as the rest so navigation never flashes between palettes. Their text is `--ink-2` on `--paper` (13.2:1 in dark), body size stays 17 px, line length is capped, and print forces light.

Mechanics:

- `<html data-theme="dark|light">`. `:root` carries the stage tokens; `:root[data-theme='light']` carries the light tokens. Remove the `@media (prefers-color-scheme: dark)` block from `GlobalStyle.js`. Keep `:root[data-stage='true'], [data-stage-scope]`.
- Preference in `localStorage` under `kazoot:theme` (`'light'` or absent).
- The CSP is `script-src 'self'`, so an inline script is blocked. Add `frontend/public/theme-init.js` (≤ 400 bytes, no dependencies) and load it with a plain blocking `<script src="/theme-init.js"></script>` in `<head>` before the module script. It reads `kazoot:theme`, sets `data-theme`, and updates `<meta name="theme-color">`. It also sets `data-lite` (section 10.2).
- `index.html`: replace the two media-scoped `theme-color` metas with one `<meta name="theme-color" content="#100A1C">` (updated to `#F8F7FC` by the script/toggle in light). `manifest.json`: `background_color` and `theme_color` → `#100A1C`.
- `color-scheme: dark` on `:root`, `light` on `[data-theme='light']`, so form controls and scrollbars match.
- `forced-colors: active`: no overrides beyond the existing gradient-text fallback; glows, grain and gradients are decorative backgrounds and disappear on their own.

---

## 4. Design tokens

Token names are the existing CSS variable names from `styles/tokens.js` / `styles/GlobalStyle.js`. "New" marks additions.

### 4.1 Colour

`STAGE_COLORS` is now the site default; `LIGHT_COLORS` is the opt-in. Values are unchanged from the code and identical to the Direction 1 palette.

| Token | Dark (default) | Light | Role |
|---|---|---|---|
| `--paper` | `#100A1C` | `#F8F7FC` | page background |
| `--band` | `#150E23` | `#F1EEF8` | alternating section background |
| `--surface` | `#1A1229` | `#FFFFFF` | cards, inputs, sheets |
| `--surface-sunk` | `#251B3A` | `#F1EEF8` | wells, outlined tiles, segmented track, disabled fill |
| `--line` | `#34294D` | `#E2DDEE` | hairlines (decorative only: 1.45:1 in dark) |
| `--line-strong` | `#7A6FA3` | `#857C9C` | input borders, secondary button border, logo ring (≥ 3:1) |
| `--ink` | `#FAF7FF` | `#140E22` | headings, primary text |
| `--ink-2` | `#D9D1EB` | `#3D3553` | body text |
| `--ink-3` | `#A99FC4` | `#5E5673` | captions, eyebrows, hints |
| `--accent` | `#7C3AED` | same | button gradient start, radio accent |
| `--accent-2` | `#C026D3` | same | button gradient end |
| `--accent-hover` / `--accent-2-hover` | `#6D28D9` / `#A21CAF` | same | hover gradient |
| `--accent-ink` | `#FFFFFF` | same | text on the gradient |
| `--accent-soft` | `#2C1F50` | `#F1EAFF` | tonal button fill, "me" row, selected row |
| `--accent-text` | `#C9B8FF` | `#6D28D9` | links, tonal button text, calm timer |
| `--brand-a` / `--brand-b` | `#B79CFF` / `#FF7AB6` | `#7C3AED` / `#D01F6E` | gradient headline ends |
| `--success` / `--success-soft` | `#4ADE80` / `#0F2A1C` | `#15803D` / `#DCFCE7` | correct, ticks |
| `--danger` / `--danger-soft` | `#FDA4AF` / `#3A1426` | `#BE123C` / `#FFE4E9` | wrong, errors, urgent timer |
| `--warning` / `--warning-soft` | `#FCD34D` / `#2E2410` | `#92400E` / `#FEF3C7` | connection notices, "soon" timer |
| `--focus` | `#F5F0FF` | `#6D28D9` | focus ring |
| `--answer-a` … `--answer-d` | `#22D3EE`, `#FF7AB6`, `#FFC53D`, `#8FB0FF` | same | answer tiles A–D, accent system on the site |
| `--answer-ink` | `#140E22` | same | text on tiles |
| `--correct-ring` | `#4ADE80` | `#16A34A` | ring and tag on the correct tile |
| `--glow-a` (new) | `rgba(124, 58, 237, 0.30)` | `rgba(124, 58, 237, 0.10)` | violet spotlight |
| `--glow-b` (new) | `rgba(192, 38, 211, 0.24)` | `rgba(192, 38, 211, 0.08)` | magenta spotlight |
| `--glow-c` (new) | `rgba(34, 211, 238, 0.10)` | `rgba(34, 211, 238, 0.06)` | cyan floor light |
| `--ring` (new) | `rgba(201, 184, 255, 0.35)` | `rgba(20, 14, 34, 0.12)` | hairline on device frames and cards on the stage |
| `--scrim` (new) | `rgba(16, 10, 28, 0.96)` | `rgba(248, 247, 252, 0.96)` | mobile dock, phone header, sheet handle area |
| `--device-body` / `--device-edge` / `--device-line` (new) | `#0E0819` / `#1D1430` / `#4A3D69` | same (stage-scoped) | phone frame in the hero |
| `--podium-1` / `--podium-2` / `--podium-3` (new) | `var(--answer-c)` / `var(--answer-d)` / `var(--answer-b)` | same | pedestals and confetti |
| `--disabled-bg` / `--disabled-ink` / `--disabled-line` (new) | `var(--surface-sunk)` / `var(--ink-3)` / `var(--line)` | same mapping | unavailable buttons (6.51:1 dark, 6.0:1 light) |

Rules for the glow tokens (they exist to keep text at AA):

- The alphas above are maximums. The mockup's 0.42 / 0.34 are too strong: where both peaks overlap, `--ink-3` drops to 3.7:1. With 0.30 / 0.24, the worst overlap gives `--ink-3` ≈ 4.7:1, `--ink-2` ≈ 8:1, `--brand-b` ≈ 4.9:1.
- Never place `--ink-3` text inside a glow. Eyebrows and captions that sit on a glow use `--ink-2`.
- In light, glows sit behind headings and body text only; gradient headline text on a light glow is large text (≥ 3:1 required, 4.15:1 measured for `--brand-b`).

### 4.2 Typography

Fonts stay: Bricolage Grotesque Variable (display), Atkinson Hyperlegible (body). To use the width axis, change the import in `GlobalStyle.js` from `@fontsource-variable/bricolage-grotesque` to `@fontsource-variable/bricolage-grotesque/wdth.css` (weight 200–800, `font-stretch` 75–100 %). Cost: the latin file goes from 41 KB to 78 KB.

Width is set with `font-stretch` (not `font-variation-settings`, so it inherits and animates predictably).

| Token (new unless noted) | Used for | `font-size` | Weight | `font-stretch` | Line height | Tracking |
|---|---|---|---|---|---|---|
| `--type-hero` | Home H1 | `clamp(2.7rem, 7.4vw, 5.4rem)` | 800 | 82% | 0.94 | -0.035em |
| `--type-display` | "The organiser doesn’t have to sit out", finale H2 | `clamp(2rem, 6vw, 4.2rem)` | 800 | 84% | 1.0 | -0.03em |
| `--type-h2` | "Ready in about a minute", "Pricing", "Questions" | `clamp(1.7rem, 4vw, 2.75rem)` | 800 | 88% | 1.05 | -0.02em |
| `--type-page` | `PageTitle` (existing component, same size) | `clamp(1.9rem, 4.5vw, 2.8rem)` | 800 | 88% | 1.05 | -0.02em |
| `--type-h3` | step titles, group titles | `1.5rem` (steps), `1.3rem` (groups) | 700 | 100% | 1.1 | -0.02em |
| `--type-h4` | plan names, card titles | `1.1rem` | 700 | 100% | 1.15 | -0.01em |
| `--type-price` | prices, big numerals | `clamp(2rem, 3.2vw, 2.4rem)` | 800 | 92% | 1 | -0.03em, `tabular-nums` |
| `--type-lead` | hero and organiser paragraphs | `clamp(1.1rem, 1.8vw, 1.25rem)` | 400 | body | 1.5 | 0 |
| `--type-body` (existing body rule) | default | `1.0625rem` | 400 | body | 1.55 | 0 |
| `--type-small` | hints, `Muted $small` | `0.92rem` | 400 | body | 1.45 | 0 |
| `--type-caption` | captions, seller line, pay line | `0.875rem` | 400 | body | 1.4 | 0 |
| `--type-eyebrow` | `Eyebrow` | `0.8rem` | 700 | body | 1.2 | 0.12em, uppercase (was 0.08em) |

Rules:

- All numerals in prices, per-game prices, counts in pricing, room codes, timers, ranks and scores are set in `--font-display` with `font-variant-numeric: tabular-nums` (fixes Atkinson's slashed zero in "€0.20", "150").
- Nothing on the site is smaller than 0.8rem (12.8 px), and only eyebrows and tags use that size.
- Game type is defined separately in section 8.4 (it scales with the stage, not the page).

### 4.3 Spacing, widths, radii

| Token | Value | Notes |
|---|---|---|
| `--space-1` … `--space-6` (new) | 4, 8, 12, 16, 20, 24 px | |
| `--space-8`, `-10`, `-12`, `-16`, `-24` (new) | 32, 40, 48, 64, 96 px | |
| `--section-y` (new) | `clamp(48px, 8vw, 104px)` | vertical padding of home sections (was `clamp(40px, 7vw, 80px)`) |
| `--gutter` (existing) | `clamp(16px, 4vw, 32px)` | unchanged |
| `--max` (existing) | `1120px` | unchanged |
| `--max-stage` (new) | `980px` | hero device composition |
| `--max-prose` (new) | `760px` | legal, contact |
| narrow container (existing `$narrow`) | `680px` | demo, join, create, account signed-out |
| `--header-h` (existing) | 64 px; 56 px at ≤ 560 | unchanged |
| `--dock-h` (new) | `68px` + `env(safe-area-inset-bottom)` | home mobile dock |
| `--radius-sm` (new) | 8 px | tags, badges, per-game pill |
| `--radius` (existing) | 12 px | inputs, buttons |
| `--radius-md` (new) | 16 px | answer tiles, step vignettes |
| `--radius-lg` (existing) | 18 px | cards |
| `--radius-xl` (new) | 24 px | hero screen, finale, sheets (top corners) |

### 4.4 Shadows and glows

| Token | Value | Use |
|---|---|---|
| `--shadow` (existing, dark value) | `0 1px 2px rgba(0,0,0,0.4)` | cards |
| `--shadow-raised` (existing) | `0 0 0 1px rgba(201,184,255,0.12), 0 24px 44px -20px rgba(0,0,0,0.8)` | hovered / preferred plan card |
| `--shadow-action` (existing, strengthen in dark) | `0 1px 0 rgba(255,255,255,0.22) inset, 0 14px 34px -12px rgba(192,38,211,0.9)` | primary button |
| `--shadow-device` (new) | desktop: `0 0 0 1px rgba(201,184,255,0.10), 0 60px 120px -40px rgba(124,58,237,0.75), 0 30px 60px -30px rgba(0,0,0,0.9)`; phone widths: `0 0 0 1px rgba(201,184,255,0.10), 0 30px 60px -30px rgba(0,0,0,0.9)` | hero host screen |
| `--shadow-phone` (new) | `0 40px 70px -24px rgba(0,0,0,0.95), 0 0 0 6px var(--device-edge)` | hero phone |
| `--glow-logo` (new) | `0 0 0 1px var(--line-strong), 0 0 18px -4px rgba(124,58,237,0.6)` | logo tile in the header (dark); light: `none` |
| `--shadow-dock` (new) | `0 -12px 32px -16px rgba(0,0,0,0.8)` | mobile dock, game dock |

Large-blur shadows are static only. Nothing with a shadow blur above 24 px is animated or scroll-linked.

### 4.5 Motion

| Token | Value | Use |
|---|---|---|
| `--dur-press` (new) | 90 ms | tile and button press |
| `--dur-fast` (new) | 160 ms | hover, colour, menu open |
| `--dur-base` (new) | 240 ms | dock slide, sheet, chip pop, correct-tile pop |
| `--dur-slow` (new) | 420 ms | scroll-reveal, tile settle-in, podium rise (per bar 520 ms) |
| `--dur-hero` (new) | 780 ms | hero entrance |
| sheen | 900 ms | button sheen |
| sweep | 1600 ms | one-time spotlight sweep |
| confetti | 2400 ms | final screen |
| count-up | 600 ms | points on reveal |
| stagger | 60 ms between siblings, max 6 siblings | settle-in, reveal |
| `--ease-out` (existing) | `cubic-bezier(0.2, 0.8, 0.2, 1)` | entrances |
| `--ease-spring` (existing) | `cubic-bezier(0.34, 1.45, 0.5, 1)` | pops, podium |
| `--ease-in-out` (new) | `cubic-bezier(0.65, 0, 0.35, 1)` | sweep, sheen |
| linear | — | countdown bar only |

The global reduced-motion rule in `GlobalStyle.js` (durations forced to 0.01 ms) stays. Section 10 lists the per-effect fallbacks that go beyond it.

### 4.6 Z-index layers

| Token (new) | Value | What |
|---|---|---|
| decorative | `-1` inside an `isolation: isolate` section | glows, grain |
| `--z-raised` | 10 | hovered cards, phone over host screen |
| `--z-dock` | 30 | home mobile dock |
| `--z-header` | 40 | sticky header (existing value) |
| `--z-menu` | 45 | mobile menu panel under the header |
| `--z-toast` | 50 | toasts (existing value) |
| `--z-confetti` | 60 | confetti layer in the game shell (`pointer-events: none`) |
| top layer | — | every sheet and dialog uses native `<dialog>.showModal()` |

---

## 5. Shared components and site chrome

### 5.1 Buttons (`components/ui.jsx`)

| Size | Min height | Padding-x | Font | Radius | Change |
|---|---|---|---|---|---|
| `lg` | 56 | 28 | 1.1rem / 700 | 14 | radius 12 → 14 |
| default | 48 | 20 | 1rem / 700 | 12 | none |
| `sm` | **44** | 14 | 0.92rem / 700 | 10 | 40 → 44 (tap target) |

Variants keep their names (`primary`, `secondary`, `tonal`, `ghost`, `danger`). Changes:

- **Primary sheen** (effect E6): `position: relative; overflow: hidden; isolation: isolate` on primary buttons, with `::after` as the light band. See section 10.
- **Secondary on the stage**: `background: rgba(255,255,255,0.03)` instead of `var(--surface)` when the button sits directly on `--paper` or a glow (hero, finale, dock). Add a `$onStage` prop or style it from the parent.
- **Disabled style** replaces `opacity: 0.5` for every variant:

  ```css
  &:disabled, &[aria-disabled='true'] {
    background: var(--disabled-bg);
    color: var(--disabled-ink);
    border-color: var(--disabled-line);
    box-shadow: none;
    cursor: not-allowed;
  }
  ```
  The `busy` state is not styled as disabled: it keeps the variant's colours and shows the spinner.

- **Validation pattern (the disabled-button fix).** A submit button is never disabled because a field is empty. It stays enabled; on press with a missing or invalid field, focus moves to the first such field and its error appears through `Field`'s existing `error` prop (`role="alert"`). Buttons are disabled only while `busy` or when the action is unavailable for a reason the user cannot fix in the form; in that case the reason is visible next to the button and linked with `aria-describedby`. Applies to `DemoPage`, `JoinPage`, `SessionPage` (name form), `CreatePage`, `FinalScreen` (play-again form).

### 5.2 Fields

No visual change except: input background on dark is `var(--paper)` when the input is inside a `--surface` card (so it reads as a well), border stays 2 px `--line-strong`. Error and hint styles unchanged.

### 5.3 Header (`components/SiteChrome.jsx`)

Not rendered while the game shell is mounted (section 8.1). On `/session/*` before the game starts (name form, joining, errors) the existing minimal header stays.

**Desktop and tablet (≥ 761):** unchanged structure: logo, "How it works", "Pricing", "Join a game", then "Account" link or "Sign in" button. Changes:

- Every `a.nav-link`: `display: inline-flex; align-items: center; min-height: 44px; padding: 0 12px`.
- Logo tile (the dark-mode fix): wrap the `<img>` in a `span` with `border-radius: 30%` (the icon's own corner radius, measured from `favicon-192.png`), `box-shadow: var(--glow-logo)`. In light: no shadow. Keep 32×32. Result in dark: a 1 px `#7A6FA3` ring (4.28:1 on the page) plus a soft violet halo.
- Header background: translucent with `backdrop-filter` only at `(min-width: 761px) and (hover: hover)`. On phones and touch devices the header is solid `var(--scrim)` with no backdrop filter (a blurred sticky bar repaints on every scroll frame on low-end phones).

**Phone (≤ 760):** `[logo] ……… [Join a game] [menu button]`.

- "Join a game": text link, min-height 44, padding 0 10.
- Menu button: 44×44, `ghost` style, icon only (add `menu` to `Icon.jsx`: `M4 7h16M4 12h16M4 17h16`), `aria-label` = new string "Menu", `aria-expanded`, `aria-controls="site-menu"`. When open the icon becomes the existing `x`.
- Menu panel `#site-menu`: `position: absolute; top: 100%; left: 0; right: 0; z-index: var(--z-menu)`; background `var(--surface)`; bottom border `1px solid var(--line)`; `box-shadow: 0 24px 40px -24px rgba(0,0,0,0.8)`; padding `8px var(--gutter) 16px`. A list of rows, each 52 px high, 1.05rem / 700, `--ink`, hairline between rows. Rows, all existing strings: "How it works" (`/#how-it-works`), "Pricing" (`/#pricing`), "Try a free demo" (`/demo`), "Create a quiz" (`/create`), then "Account" (`/account`) when signed in or the "Sign in" button (secondary, full width, 48) when not.
- Behaviour: opens on press; closes on a second press, on `Escape` (focus returns to the button), on a press outside, and on route change. On open, focus moves to the first row. It is a disclosure, not a modal: no focus trap, page stays scrollable.
- Motion: `opacity 0 → 1` and `translateY(-8px) → 0` in `--dur-fast`. Reduced motion: no transition.

### 5.4 Footer (`components/SiteChrome.jsx`)

Layout unchanged (two columns ≥ 701, one column below). Changes:

- **Links**: each `nav a` is `display: inline-flex; align-items: center; min-height: 44px; padding: 0 6px`. Below 701 the nav becomes a two-column grid (`grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px`) so rows do not wrap raggedly. Link order unchanged: Pricing, Terms, Privacy, Refunds & cancellation, Contact.
- **Left column**, three lines, top to bottom:
  1. existing: "**Kazoot** — live quizzes for friends, classes and teams."
  2. existing: "Questions or problems? {SUPPORT_EMAIL}" (the mailto link gets `min-height: 44px; display: inline-flex; align-items: center`).
  3. the company line: `<SellerLine label="Operated by" withLink />` (section 5.6). It replaces the current `{LEGAL.sellerName}, reg. code …` paragraph, including that paragraph's address branch.
- **Theme switch**, under the nav on the right (under the left column on phones): the existing `SegmentedControl` with legend "Theme" (new string, shown as a normal small legend) and two options "Dark" and "Light" (new strings). Width `max-content`, each segment min 44 high, min 72 wide. Default "Dark". Changing it sets `data-theme`, writes/removes `kazoot:theme`, updates the `theme-color` meta. No transition between themes.
- Bottom padding: 40 px; on the home page at ≤ 760, `calc(40px + var(--dock-h))` so the dock never covers the last footer row.

### 5.5 Home mobile dock (new `components/home/MobileDock.jsx`)

Home page only, viewport ≤ 760.

- `position: fixed; left: 0; right: 0; bottom: 0; z-index: var(--z-dock)`.
- `display: flex; gap: 10px; padding: 10px var(--gutter) max(10px, env(safe-area-inset-bottom))`.
- Background `var(--scrim)`, top border `1px solid var(--line)`, `box-shadow: var(--shadow-dock)`. No backdrop filter.
- Buttons, both 48 high, 1rem: "Join a game" (`secondary`, `flex: 1`) → `/join`; "Try a free demo" (`primary`, `flex: 1.4`) → `/demo`. Existing strings.
- Visibility: one `IntersectionObserver` watches the hero action row and the finale action row. The dock is shown when neither intersects the viewport. Hidden state: `transform: translateY(100%); visibility: hidden` and the `inert` attribute (not focusable, not announced). Transition `transform var(--dur-base) var(--ease-out)`; `visibility` switches at the end of the hide. Reduced motion: no transition.
- Markup: a plain `<div>`, not a second `<nav>` landmark (both links already exist in the header and its menu, so no new landmark label is needed).

### 5.6 Seller identity (new `components/SellerLine.jsx`)

Kazoot is operated by the owner's company; the name and registry code arrive at build time through `VITE_LEGAL_SELLER_NAME` and `VITE_LEGAL_REGISTRY_CODE` and are exposed as `LEGAL` and `hasSellerIdentity` in `lib/legal.js`. This brief never hard-codes them and neither may the implementation.

```jsx
// components/SellerLine.jsx
export function SellerLine({ label, withLink = false }) {
  if (!hasSellerIdentity) return null;
  return (
    <Line>
      <span className="label">{label}</span>{' '}
      <span className="name">{LEGAL.sellerName}</span>
      {LEGAL.registryCode ? <span className="reg">, reg. code {LEGAL.registryCode}</span> : null}
      {withLink ? <> · <Link to="/contact">Company details</Link></> : null}
    </Line>
  );
}
```

- `label` is one of the two new strings: "Sold by" (purchase contexts) or "Operated by" (footer). ", reg. code" and "Company details" are existing strings (footer and contact page).
- The component reads only `sellerName` and `registryCode`. It never renders `LEGAL.address` or `LEGAL.vatNumber`, whatever the environment contains. The legal and contact pages keep their existing `Seller()` block unchanged.
- When `hasSellerIdentity` is false it renders nothing, and its parents must not render a separator, bullet or empty row for it (use `gap` on a flex/grid parent, not literal " · " characters outside the component).

**Look: quiet and factual, not a banner.**

```css
font-size: 0.875rem; line-height: 1.4; color: var(--ink-3);
.name { color: var(--ink-2); font-weight: 700; white-space: nowrap; }
.reg  { color: var(--ink-2); white-space: nowrap; }
a     { color: var(--ink-2); font-weight: 700; }   /* footer variant: min-height 44px inline-flex */
```
No icon, no background, no border, no badge. Contrast: `--ink-3` 7.8:1 and `--ink-2` 13.2:1 on `--paper`; 7.3:1 and 12.3:1 on `--surface`.

**Where it appears**

| # | Place | Component | Exact position |
|---|---|---|---|
| 1 | Pricing section on home, `/pricing`, and "Get more AI games" on `/account` | `PayLine` (6.2) containing `<SellerLine label="Sold by" />` | Directly under the plan cards of the visible group, above the explainer paragraph. On phones it is the row immediately after the last plan row. |
| 2 | Consent dialog "Before you pay" (`AccountPage.jsx`, `ConsentDialog`) | `<SellerLine label="Sold by" />` | Between the consent checkbox and the button row, 14 px gap above and below. |
| 3 | `/account` signed out with a chosen plan ("Sign in to buy {plan}") | `<SellerLine label="Sold by" />` | Under the button row. |
| 4 | `/account` → Billing card | `<SellerLine label="Sold by" />` | Last line of the card, after "Opens Stripe’s secure billing page, …". |
| 5 | Footer, every site page | `<SellerLine label="Operated by" withLink />` | Third line of the left column (5.4). |

Not shown: in the header, in the hero, inside plan cards, on game screens, in the share image.

### 5.7 Light-theme rules (the opt-in)

Light is the current look with the new layout. To keep it cheap:

- Glows use the light alphas from 4.1. Grain is off. The spotlight sweep is off.
- The hero device stage, the step vignettes, and the finale panel keep `data-stage-scope` (dark islands on a light page, as the hero preview is today).
- The mobile dock, header and sheets use the light `--scrim` / `--surface`.
- The Free band uses `background: var(--accent-soft)` with `1px solid color-mix(in srgb, var(--accent) 35%, transparent)` instead of the dark gradient.
- Everything else is the same components reading the light tokens. No light-only layouts.

### 5.8 Sheet (new `components/Sheet.jsx`)

One component for every overlay that is allowed to scroll internally: Full text, Full standings, players list, review editor, play-again form.

- Native `<dialog>` opened with `showModal()` (top layer, focus trap, `Escape`).
- Phone (≤ 760): bottom sheet. `margin: auto 0 0; width: 100%; max-width: none; max-height: 88dvh; border: 0; border-radius: var(--radius-xl) var(--radius-xl) 0 0; background: var(--surface); padding: 16px var(--gutter) max(16px, env(safe-area-inset-bottom)); overflow-y: auto; overscroll-behavior: contain`.
- Wider: centred, `max-width: 560px` (review editor: 760), `max-height: 86dvh`, `border-radius: var(--radius-xl)`, `border: 1px solid var(--line)`.
- Header row inside: title (`h2`, 1.2rem) on the left, close button on the right: `ghost`, 44×44, icon `x`, visible label "Close" (new string) at ≥ 400 wide, `aria-label="Close"` below that.
- Backdrop: `rgba(16,10,28,0.6)`. Remove the existing `backdrop-filter: blur(2px)` on `dialog::backdrop` for `(pointer: coarse)`.
- Motion: `translateY(100%) → 0` (phone) or `opacity 0 → 1; scale(0.98) → 1` (wide), `--dur-base`. Reduced motion: none.
- Closing returns focus to the control that opened it. Inside the game, a sheet closes automatically when the phase changes (a new question must never be hidden behind a sheet).

---

## 6. Pages

### 6.1 Home (`pages/HomePage.jsx`)

Differences from `direction-1.html`:

1. No social-proof block (the dashed placeholder is gone, nothing replaces it).
2. Three FAQ answers become visible cards in the organiser band (quick win 8); the accordion keeps the other five.
3. "Good to know" moves from the organiser band to the left column of the Questions band.
4. Glow strength reduced to the token values (contrast).
5. H1 is two lines at ≥ 1000 wide so the device stage starts above the fold on a laptop.
6. The dock appears after the hero buttons leave the screen instead of always.
7. Pricing uses the switch from 6.2. The Free band button is `secondary`.

Section order: Hero → How it works → Organiser → Pricing → Questions → Finale → Footer.

#### Hero

Structure (centred, as the mockup): eyebrow, H1, lead, actions, reassurance, device stage. The `Lockup` with `HeroMark` is removed (delete `HeroMark` usage; `components/BrandMark.jsx` becomes unused and can be deleted).

| Element | Content (existing strings) | Style |
|---|---|---|
| Eyebrow | "Live quiz game for groups" | `--type-eyebrow`, colour `--ink-2` (it sits on a glow) |
| H1 | "Pick a topic." / "Everyone plays —" / "including you." (three `.line` spans; third is the `<em>`) | `--type-hero`; `max-width: 13ch` below 1000; at ≥ 1000: `max-width: none`, the first two spans `display: inline`, the `<em>` `display: block` (two lines). Gradient on the `<em>`: `linear-gradient(100deg, var(--brand-a) 10%, var(--brand-b) 90%)` as today. `margin-top: 14px`. |
| Lead | existing paragraph | `--type-lead`, `--ink-2`, `max-width: 36em`, `margin-top: 18px` |
| Actions | "Try a free demo" + arrow (`primary lg`) → `/demo`; "Create a quiz" (`secondary lg`, on-stage style) → `/create` | `margin-top: 24px; gap: 12px; justify-content: center`; at ≤ 480 each button is full width, demo first |
| Reassurance | "Demo: no account, no card" · "Your own topics: {n} free quizzes a month" | 0.95rem, `--ink-2`, check icons `--success`, `margin-top: 16px`, centred, wraps |
| Device stage | see below | `margin-top: clamp(32px, 4vw, 44px)` |

Hero padding: `clamp(28px, 4.5vw, 52px)` top, 0 bottom (the stage's own bottom padding closes the section). At `(min-width: 1000px) and (max-height: 820px)`: H1 `font-size: 4.2rem`, top padding 28 px, so that at 1280×720 the top of the host screen (status row, question, timer) is above the fold.

Background (effect E1): `::before` on the hero, `inset: 0; z-index: -1`, three radial gradients:

```css
background:
  radial-gradient(48% 42% at 18% 0%, var(--glow-a), transparent 70%),
  radial-gradient(44% 40% at 84% 6%, var(--glow-b), transparent 70%),
  radial-gradient(60% 40% at 50% 100%, var(--glow-c), transparent 70%);
```
Grain (E2) as a second pseudo-element on the hero only.

**Device stage** (new `components/home/DeviceStage.jsx`): a `<figure aria-label="Preview of the question screen">` (existing label) with `max-width: var(--max-stage)`, containing an `aria-hidden`, `inert` wrapper with two frames and the existing `<figcaption>` "The real question screen, shown with a question from the free demo."

| Part | Desktop / tablet (≥ 561) | Phone (≤ 560) |
|---|---|---|
| Host screen frame | `width: 100%; aspect-ratio: 16 / 10; border-radius: 22px 22px 6px 6px; border: 1px solid var(--line); background: linear-gradient(180deg, #191128, #120B1F); box-shadow: var(--shadow-device); overflow: hidden` | `aspect-ratio: 4 / 3`, phone-width shadow |
| Screen foot | `height: 14px; margin: 0 8%; border-radius: 0 0 18px 18px; background: linear-gradient(180deg, #2B2140, #1A1229)` | `height: 10px` |
| Phone frame | `position: absolute; right: 0; bottom: 0; width: clamp(150px, 26vw, 250px); aspect-ratio: 9 / 17; border-radius: 28px; border: 1px solid var(--device-line); background: var(--device-body); padding: 10px 8px; box-shadow: var(--shadow-phone); transform: rotate(3deg); z-index: var(--z-raised)` | `position: relative; width: min(56%, 210px); aspect-ratio: 9 / 16; margin: -34px 8px 0 auto` |
| Stage bottom padding | `clamp(24px, 5vw, 56px)` (the phone hangs below the screen) | 0 |
| Caption | centred, 0.88rem, `--ink-3`, `margin-top: 16px` | left-aligned |

Inside each frame: the real game question view in preview mode (`<GameShell preview>`, section 8.1), fed by one shared demo loop so both devices show the same moment. Content, all existing: "Question 3 of 10", "7 of 9 answered", "Which spice comes from the dried stigmas of a crocus flower?", answers Turmeric / Saffron / Cardamom / Paprika, "Locked in", "Locked in. The answer appears when time is up.", "Correct".

Demo loop (effect E3, new `lib/useDemoLoop.js`), 16 s, then repeats:

| Time | Host screen | Phone |
|---|---|---|
| 0.0 s | tiles settle in (E5), timer 12 | same, nothing selected |
| 3.0 s | "8 of 9 answered" | taps B: "Sending…" for 300 ms, then "Locked in" and the status line |
| 6.0 s | "9 of 9 answered" | — |
| 2.0 s and 7.0 s | timer reaches 10 and then 5: turns "soon", then "urgent" (existing thresholds and colours) | same |
| 12.0 s | reveal: B gets the correct ring and "Correct" tag | reveal: B "Correct · yours" |
| 16.0 s | 300 ms cross-fade, restart | restart |

The host screen never shows a chosen tile (it is the shared screen). The loop runs on a single 250 ms interval, only while the figure intersects the viewport and the tab is visible. Reduced motion or `data-lite`: a static frame, timer at 13, phone locked on B (what the page shows today).

Fallback if preview mode proves too fragile at miniature sizes (risk R3 in section 12): hand-built markup as in the mockup, with only the timer animated.

#### How it works (`id="how-it-works"`)

- Background `--paper`, padding `var(--section-y) 0`.
- Title "Ready in about a minute": `--type-h2`.
- Three step cards (`<ol>`, each `<li>`): `border-radius: 22px; border: 1px solid var(--line); background: var(--surface); overflow: hidden`. Grid: 3 columns ≥ 901 with `gap: clamp(14px, 2vw, 22px)`; 1 column below. `margin-top: clamp(24px, 4vw, 44px)`.
- Each card = vignette on top, text below.
  - Vignette: `min-height: 190px; padding: 20px; background: var(--surface-sunk); display: flex; flex-direction: column; justify-content: center; gap: 10px`, `aria-hidden="true"`, and `box-shadow: inset 0 4px 0 var(--answer-a | --answer-b | --answer-c)` for steps 1 / 2 / 3. At 561–900 (single column, wide cards) the card becomes a two-column grid: vignette left (42 %), text right.
  - Text: `padding: 20px 22px 24px`; `h3` with the number chip in front (38×38, radius 11, `background: var(--ink); color: var(--paper)`, display 800 1.1rem), `--type-h3` 1.5rem; paragraph `--ink-2`, 1rem. Existing step titles and paragraphs, unchanged (step 2 keeps `{window.location.host}/join`).
- Vignette contents (new `components/home/StepVignettes.jsx`; real UI pieces, existing strings only):
  1. A static topic field: label "Topic", value "Nordic mythology" in a read-only box styled like `Input`; under it "Ideas:" and three chips from `EXAMPLES` in `CreatePage.jsx`: "Famous bridges", "1990s pop music", "Volcanoes" (export `EXAMPLES` and import it; do not retype).
  2. Eyebrow "Invite players"; a row with a 76×76 white QR tile (a real `QRCodeSVG` of `https://www.kazoot.app/join`, lazy-loaded as in `Lobby.jsx`) and the code "ABCDE 23456" (the example from the join hint) in display 700, `clamp(1.25rem, 2vw, 1.6rem)`, letter-spacing 0.05em.
  3. Eyebrow "Leaderboard"; three leaderboard rows with rank chips 1–3 (rank 1 in `--answer-c`), the first row in the "me" style; names and scores are grey bars (`height: 9px; border-radius: 5px; background: var(--line-strong); opacity: 0.7`), widths 62 % / 48 % / 70 % plus a 38 px score bar. No invented names.

#### Organiser band

- Background `--band`, hairline top and bottom, padding `var(--section-y) 0`.
- Split grid: `minmax(0, 1.25fr) minmax(0, 0.75fr)`, `gap: clamp(24px, 5vw, 64px)`, `align-items: end`; one column at ≤ 900.
  - Left: H2 "The organiser doesn’t have to sit out" in `--type-display`; paragraph (existing) in `--type-lead`, `--ink-2`, `max-width: 34em`, `margin-top: 18px`.
  - Right: note card: `padding: 22px; border-radius: 20px; border: 1px solid var(--line); background: var(--surface)`; existing text "**Teaching or running a work session?** Choose “Let me check first” …" at 1rem, `--ink-2`, the bold part `--ink`.
- **Surfaced answers** (quick win 8), `margin-top: clamp(28px, 4vw, 44px)`: three cards in a row (3 columns ≥ 901, 1 column below, `gap: clamp(14px, 2vw, 22px)`). Each card: `padding: 22px; border-radius: var(--radius-lg); border: 1px solid var(--line); background: var(--surface)`; `box-shadow: inset 0 3px 0 var(--answer-d | --answer-c | --answer-a)`.
  - `h3`: the FAQ question, display 700, 1.2rem, `--ink`.
  - `p`: the FAQ answer, 1rem, `--ink-2`, `margin-top: 8px`.
  - Cards, in order, text taken from the `FAQ` array verbatim: "Is it OK for schools and children?", "Can the questions be wrong?", "Can I show it on a big screen?".
  - Implementation: split the `FAQ` array into `SURFACED` (these three) and `FAQ` (the other five) so nothing is duplicated on the page.

#### Pricing (`id="pricing"`)

- Background `--paper`. Title "Pricing" (`--type-h2`), sub-line "Start free. Pay only if you host often." (`--ink-2`, `margin-top: 10px`).
- `<PlanGrid>` with the switch layout (6.2), then `<PricingExplainer />`.
- The `pricing_viewed` observer stays.

#### Questions

- Background `--band`. Grid `minmax(0, 0.8fr) minmax(0, 1.6fr)`, `gap: clamp(20px, 5vw, 64px)`; one column at ≤ 800. Use the wide `Container`, not `$narrow`.
- Left column: H2 "Questions" (`--type-h2`); under it (desktop: `margin-top: 28px`; phone: moved after the accordion with `order`) the quiet "Good to know" block: eyebrow "Good to know", then the four existing items as a plain list, each `padding: 14px 0; border-top: 1px solid var(--line)`, bold lead-in `--ink` 1rem, sentence `--ink-2` 0.95rem. No card, no accent border. (The existing test looks for "AI can be wrong": still present.)
- Right column: the accordion with the five remaining questions, in the current order minus the three surfaced ones: account/app, demo vs real quiz, topics, disconnects, refunds. Markup and styles as today, with: `summary` min-height 56, toggle 32×32, answer padding `0 48px 20px 0`. Then "Something else? Email {SUPPORT_EMAIL}."

#### Finale

- Full-bleed section (not a card), `border-top: 1px solid var(--line)`, padding `clamp(56px, 9vw, 120px) 0`, centred text, `isolation: isolate`.
- Background glow:

  ```css
  background:
    radial-gradient(50% 70% at 50% 100%, var(--glow-b), transparent 70%),
    radial-gradient(40% 50% at 20% 100%, var(--glow-a), transparent 70%);
  ```
  plus grain.
- H2 "See how it feels — the demo takes two minutes." in `--type-display`, `max-width: 16ch`, centred.
- Paragraph "No account, no card. Play solo or with whoever is in the room." 1.15rem, `--ink-2`, `margin-top: 14px`.
- Actions: "Try a free demo" + arrow (`primary lg`), "Join a game" (`secondary lg`), `margin-top: 24px`, same phone stacking as the hero.
- In light theme this section keeps `data-stage-scope` (a dark closing band).

#### Home at three widths

| Section | Phone (≤ 560) | Tablet (561–1023) | Desktop (≥ 1024) |
|---|---|---|---|
| Hero text | centred, H1 3 lines, buttons stacked full width | centred, H1 3 lines, buttons inline | centred, H1 2 lines |
| Device stage | host screen 4:3, phone below-right overlapping by 34 px | host screen 16:10, phone absolute bottom-right | same, max 980 wide |
| Steps | 1 column, vignette above text | 1 column, vignette left / text right | 3 columns |
| Organiser | 1 column; note card under the paragraph; 3 answer cards stacked | same until 900, then split | split 1.25 / 0.75; 3 cards in a row |
| Pricing | free band stacked; switch full width; plan rows | switch centred; cards in a row | same |
| Questions | title, accordion, email line, Good to know | same | two columns, Good to know under the title |
| Finale | centred, buttons stacked | centred, buttons inline | same |
| Dock | shown after hero buttons scroll away | shown ≤ 760 only | none |

### 6.2 Pricing (`components/Pricing.jsx`, used by home, `/pricing`, `/account`)

**Structure, top to bottom**

1. **Free band** (when `includeFree`): always visible, above the switch.
2. **Switch**: only when both packs and subscriptions exist in `plans`.
3. **Plan cards** of the selected group.
4. **Pay line.**
5. **Explainer** (rendered by the page, as today).

**Free band**

- `display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 18px 32px; align-items: center; padding: 22px 26px; border-radius: 20px`.
- Dark: `background: linear-gradient(115deg, rgba(124,58,237,0.28), rgba(192,38,211,0.18)); border: 1px solid rgba(183,156,255,0.35)`. Text contrast on it: `--ink-2` ≥ 10:1, `--ink-3` ≥ 6.1:1.
- Left: "Free" (`--type-h4`) and "€0" (`--type-price`). Middle: the four existing ticks in two columns (one column ≤ 700), 0.95rem, `--ink-2`, tick icon `--brand-a`. Right: "Start free" (`secondary`, on-stage style, 48) and the link "or try the demo, no account" (min-height 44).
- ≤ 700: one column, actions left-aligned, button full width.

**Switch**

- The existing `SegmentedControl` with a visually hidden legend "Pricing" (existing word; add a `hideLegend` prop that applies `.visually-hidden` to the `<legend>`).
- Options, existing strings: "Game packs" with hint "Pay once"; "Monthly plans" with hint "For regular hosts". These replace the two group headings.
- Default selection: "Game packs" (a one-time purchase is the smaller commitment and matches "Pay only if you host often"). Exception: when the URL carries `?buy=<subscription id>` on `/account`, start on that plan's group.
- Width: `min(100%, 440px)`, centred ≥ 561, full width on phones. Segment min-height 56.
- Under the switch, one line with the group's shared terms (what `splitTerms().shared` produces today), centred ≥ 561, 0.95rem, `--ink-2`: e.g. "One-time payment, no subscription · Use them within 12 months".
- Only the selected group's cards are in the DOM. The other group is not rendered (so tests and screen readers see one set of buy buttons). Selection is local state; it is not persisted.
- If only one group exists (for example subscriptions filtered out on `/account` for an active subscriber): no switch; show that group's title as an `h3` as today.

**Plan card, ≥ 561**

- Row of cards: `display: grid; grid-template-columns: repeat(var(--count), minmax(0, 340px)); justify-content: center; gap: 14px`.
- Card: `padding: 22px 20px 20px; border-radius: var(--radius-lg); background: var(--surface); border: 1px solid var(--line)`; flex column, `gap: 12px`. Order:
  1. Name: `h4`, `--type-h4`.
  2. Price: `--type-price`; "/ month" in body 0.95rem / 700, `--ink-3`.
  3. Games: "{credits} AI games" or "{credits} AI games every month", 1.05rem / 700, `--ink`.
  4. **Per-game price** (promoted): a pill `display: inline-flex; align-self: flex-start; padding: 4px 10px; border-radius: var(--radius-sm); background: var(--surface-sunk); color: var(--ink); font: 700 0.95rem var(--font-display); font-variant-numeric: tabular-nums`. Text as today: "{price} per game".
  5. Plan-specific terms, if any (the existing `TermList`).
  6. Button, full width, pushed to the bottom (`margin-top: auto`).
- The monthly cards keep the 4 px gradient top edge.
- Hover lift and pointer tilt stay as implemented (fine pointers only).

**Preferred card (one per group)**

- Which: a constant in `Pricing.jsx`, `PREFERRED_PLAN = { payment: 'credits_60', subscription: 'plus_monthly' }`. If the id is not in the visible plans, fall back to the middle card (packs) or the first card (monthly). Reasoning: Pack 60 is the middle pack and the first step down in per-game price (€0.25 → €0.20); Plus is the entry subscription. The owner can change the constant (section 14).
- Look: gradient border and raised shadow, primary button. No ribbon, no "popular" or "best value" label (there is no data behind such a claim).

  ```css
  border: 1.5px solid transparent;
  background: linear-gradient(var(--surface), var(--surface)) padding-box, var(--brand-gradient) border-box;
  box-shadow: var(--shadow-raised);
  ```
- Buttons: preferred card `primary`; other cards `tonal` (as today, including the hover-to-gradient behaviour).

**Plan row, ≤ 560 (compact)**

- Each plan is one row card: `display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 16px; align-items: center; padding: 14px 16px`.
  - Row 1: name (left), price (right, 1.75rem).
  - Row 2: left: games line 0.95rem / 700 and the per-game pill on one line (`display: flex; flex-wrap: wrap; gap: 6px 8px`); right: the button, `sm` height 44, auto width, label unchanged ("Buy Pack 60", "Subscribe to Plus").
  - Plan-specific terms, if any: full-width third row, 0.88rem.
- Row height ≈ 104 px. Rows stacked with 10 px gap. Preferred row keeps the gradient border and the primary button.
- Target: free band + switch + three rows + pay line ≤ 1,000 px at 360 wide (today about 1,800).

**Pay line** (new `PayLine` in `Pricing.jsx`)

- Position: directly under the cards/rows, `margin-top: 14px`.
- Content, left to right, all existing sentences moved out of `PricingExplainer`:
  1. lock icon (existing `lock`, `--ink-3`, 1em) + "Payments are handled by Stripe."
  2. "Prices include any VAT that applies."
  3. `<SellerLine label="Sold by" />`
- Layout: `display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 18px; font-size: 0.875rem; color: var(--ink-3)`; left-aligned and stacked on phones.
- `PricingExplainer` keeps the first three sentences only: "One AI game = one 10-question quiz on a topic you choose. Playing, joining and demo quizzes are always free. If creating a quiz fails, the AI game is given back."
- Card-brand and wallet marks: a slot exists (`PAYMENT_MARKS = []`, rendered after the Stripe sentence as 24 px-high monochrome SVGs in `--ink-3`), left empty until the owner confirms which methods are enabled in Stripe (section 14). Do not ship marks for methods that are not switched on.

**`/pricing` page** (`PricingPage` in `LegalPages.jsx`): title "Pricing" (`PageTitle`), existing sub-line, `PlanGrid`, explainer, then the existing two buttons ("Try a free demo" primary, "Buy AI games" secondary). No glow, no grain.

### 6.3 Demo (`pages/DemoPage.jsx`)

Goal: one tap to the first question.

Layout (narrow container, 680):

1. Header block, unchanged strings: eyebrow "Free demo · no account needed", title "Try a real game", the existing paragraph.
2. **Quiz picker**, compact: legend "Pick a quiz" (existing). A 2×2 grid of radio cards (1 column at ≤ 360): each `min-height: 56px; padding: 10px 14px; border-radius: 14px; border: 2px solid var(--line)`; selected: `border-color: var(--accent); background: var(--accent-soft)`. Content: title in bold; the language suffix for non-English quizzes as today; the description on a second line at 0.9rem `--ink-2`, hidden at ≤ 560 to keep the start button above the fold. Default: the first quiz in `config.demoQuizzes`.
3. **Two mode panels**, side by side ≥ 701 (equal columns, 16 px gap), stacked below with solo first:

| | Solo panel (first, emphasised) | Group panel |
|---|---|---|
| Card | `border: 1.5px solid transparent` with the gradient border from 6.2 | plain `Card` |
| Title | "Solo preview" (`h2`, 1.3rem) + hint "Just you, right now" | "With others" + hint "They join on their phones" |
| Text | existing solo description | existing group description with `{maxDemoPlayers}` |
| Field | none | "Your name", hint "Shown on the scoreboard" |
| Button | "Start solo preview" (`primary lg`, full width) | "Create demo room" (`secondary lg`, full width) |

Behaviour:

- **Solo is one tap.** No name is asked. The name sent is, in order: the last name this browser used (`localStorage` `kazoot:last-name`, written whenever a name is submitted on `/demo`, `/join`, `/create` or the session name form), else the signed-in user's first name (same derivation as `CreatePage`), else the new string "Player".
- **Group**: the button is always enabled. Pressed with an empty name → focus the field and show the error "Enter a name." (the server's existing validation message, reused).
- Both buttons show `busy` with the spinner while the room is created; the other button is disabled during that time.
- The `SegmentedControl` "How do you want to play?" is removed (the two panels replace it).
- Phone check at 360×560: header block (~170) + picker (~150) puts "Start solo preview" at about y = 430–486, above the fold.

### 6.4 Join (`pages/JoinPage.jsx`, new `components/RoomCodeInput.jsx`)

- Title "Join a game", sub-line "Enter the code on the host’s screen. No account needed." (existing).
- **Room code field**: one `<input>` (not ten boxes: one field pastes, autofills and reads better).
  - Label "Room code", hint "10 letters and numbers, like ABCDE 23456" (existing).
  - `height: 72px; text-align: center; font-family: var(--font-display); font-weight: 700; font-size: clamp(1.6rem, 8.4vw, 2.5rem); letter-spacing: 0.08em; text-transform: uppercase; font-variant-numeric: tabular-nums; border-radius: 14px`.
  - Attributes: `inputMode="text"`, `autoCapitalize="characters"`, `autoCorrect="off"`, `autoComplete="off"`, `spellCheck={false}`, `enterKeyHint="next"`, `aria-describedby` hint and error.
  - **Grouping**: the displayed value is `formatRoomCodeInput(code)` (new helper in `lib/gameUi.js`): the normalised code with one space after the fifth character when there are more than five (`ABCDE 23456`; a legacy 6- or 8-character code shows as `ABCDE 2`, `ABCDE 234`). State keeps the normalised code (`normalizeRoomCode`, existing).
  - **Caret**: after each change, restore the caret to the position after the same number of code characters as before formatting (count `[A-Z0-9]` left of the caret, then map through the formatted string). Do not transform during IME composition (`event.nativeEvent.isComposing`); normalise on `compositionend`. This avoids duplicated characters on Android keyboards.
  - **Paste-tolerant**: `onPaste` takes the clipboard text; if it contains `/join/` or `code=`, use the segment after it; then `normalizeRoomCode`. Dashes, spaces, lower case and full invite links all work.
  - When the code becomes valid (`isValidRoomCode`) through typing the tenth character or pasting, focus moves to the name field.
  - Fits: at 320 wide the field is 26.9 px type and needs about 200 of 224 available px; at 393, 33 px type.
- Name field: unchanged.
- Button "Join game" (`primary lg`, full width on phones): always enabled. On press: invalid code → focus the code field, error "Room codes have 10 letters and numbers." (existing); empty name → focus the name field, error "Enter a name.".
- The same `RoomCodeInput` is not needed in `SessionPage`'s name form (the code is in the URL there); apply only the button rule and the "Enter a name." error.

### 6.5 Create (`pages/CreatePage.jsx`)

Signed-out visitors see the start of the real form, not a wall.

- Header unchanged: eyebrow "New quiz", title "What should the quiz be about?".
- **Signed out**:
  1. Card with the topic `Field` (label "Topic", existing hint) and the "Ideas:" chip row (all six `EXAMPLES`; chips are `secondary sm` buttons, now 44 high; pressing one fills the field). Same markup as signed in.
  2. Under the card: the existing `h2` "Sign in to create a quiz on a topic you choose" at 1.2rem, the existing paragraph ("Creating a quiz uses AI, so it needs an account. …"), then the button row: "Continue with Google" (`primary lg`) and "Try the free demo first" (`secondary lg`). `ErrorNotice` for `authError` above the buttons. The "Sign-in isn’t configured" notice stays for that case and is the visible reason for the disabled button.
  3. On "Continue with Google": save `{ topic }` to `sessionStorage` under `kazoot:create-draft`, then call `signIn()`. An empty topic is allowed (no error; they can type it after signing in).
  - The name, language, difficulty, timer, reveal and review controls are not shown before sign-in (they add length without adding investment).
- **After sign-in** (page reloads on `/create`): read and delete `kazoot:create-draft`; prefill the topic; focus the topic field if it is empty, otherwise the name field.
- **Signed in**: form as today, plus:
  - "Create quiz" follows the validation pattern: enabled; empty or 1-character topic → focus + "Topic must be at least 2 characters." (the server's existing message); empty name → "Enter a name.".
  - It is disabled only when `allowance.empty` or `!config.aiAvailable`; the existing notices at the top of the form are the reason, linked with `aria-describedby`. (The existing test expecting a disabled button with no AI games left still holds.)
  - The row "Uses 1 AI game. If creation fails, you’re not charged." stays next to the button.

### 6.6 Account (`pages/AccountPage.jsx`)

**Signed out** (narrow container): a card instead of bare text.

1. Title: "Your account", or "Sign in to buy {plan}" with a chosen plan (existing).
2. Existing sentence for each case.
3. Buttons: "Continue with Google" (`primary lg`), "See pricing" (`secondary lg`).
4. With a chosen plan: `<SellerLine label="Sold by" />`.
5. A quiet list of what an account gives, with tick icons, reusing strings that already exist in `FreePlanCard`: "{n} AI games a month with a Google account", "Demo quizzes any time, no account", "Players never pay or sign up". (Export the three as constants from `Pricing.jsx` so they are not retyped.)
6. What Google data is used, reusing the privacy page's own words, 0.92rem, `--ink-2`: "Google account email, name and profile picture (hosts who sign in)" on one line and "Your account, AI game balance and purchases" on the next (the first two cells of that row of the privacy table), followed by a link "Privacy" → `/privacy`. Export those cell strings from `LegalPages.jsx` (or a small `lib/copy.js`) and use them in both places.

**Signed in**: structure unchanged. Changes:

- "Get more AI games" uses the switch layout of `PlanGrid` (6.2) with `includeFree={false}`, the pay line, and the seller line inside it.
- Billing card: seller line as the last row (5.6, place 4).
- Consent dialog: seller line between the checkbox and the buttons (5.6, place 2); dialog `border-radius` → `var(--radius-xl)`; the checkbox label row gets `min-height: 44px`. Wording and flow unchanged.
- The "AI games left" numeral: display face, `--type-price` at 2.6rem (already close; make it tabular).
- Grant and recent-quiz tables at ≤ 560: wrap each in `overflow-x: auto` with `min-width: 480px` on the table (page content may scroll here; this is not a game screen).

### 6.7 Legal and contact (`pages/LegalPages.jsx`)

- `LegalShell`: use a centred container of `--max-prose` (760) instead of the wide container (fixes the left-aligned column).
- `Prose`: `max-width: none` (the container sets the measure); body `--ink-2`, 1.0625rem, line-height 1.65; `h2` 1.35rem `--ink` with `margin: 36px 0 10px`; links `--accent-text`.
- The privacy table at ≤ 640: each row becomes a block card (`display: block` on `tr`, `td`; each cell prefixed by its column header through `data-label` and `::before`, 0.8rem / 700 `--ink-3`); `thead` visually hidden. Wider: table as today.
- No glows, no grain, no scroll-reveal on these pages.
- Print: `@media print { :root { /* light tokens */ } header, footer, .dock { display: none } }`.
- The existing `Seller()` block (which can include VAT number and address if those variables are set) is unchanged. This brief adds no address anywhere.

### 6.8 Session pre-game states and 404

`SessionPage`'s name form, "Joining the room…" and error states stay normal scrolling pages with the minimal header, in the stage palette. Apply the button rule (5.1) to "Join game". `NotFoundPage`: no change beyond tokens.

---

## 7. Share image and meta tags

### 7.1 Image

- File: `frontend/public/og/kazoot-og-v1.png`, 1200×630, sRGB PNG, ≤ 300 KB. The version suffix is there because chat apps cache previews by URL; bump it when the image changes.
- Build it from an HTML template rendered once in a headless browser at 1200×630 (keep the template in `design-review/og-template.html`; it is not shipped). Fonts: the same two families.

Composition (coordinates from the top-left corner):

| Element | Position / size | Style |
|---|---|---|
| Background | full | `#100A1C` |
| Glows | — | `radial-gradient(560px 420px at 12% 0%, rgba(124,58,237,0.42), transparent 70%)`, `radial-gradient(520px 400px at 88% 8%, rgba(192,38,211,0.34), transparent 70%)`, `radial-gradient(700px 300px at 50% 100%, rgba(34,211,238,0.10), transparent 70%)` (the stronger mockup alphas are fine here: only large text sits on them) |
| Logo tile | x 64, y 64, 72×72 | `brand/kazoot-mark.webp`, 1 px ring `rgba(201,184,255,0.35)` |
| Wordmark | x 152, vertically centred on the tile | "Kazoot", Bricolage 700, 40 px, `#FAF7FF` |
| Eyebrow | x 64, y 200 | "LIVE QUIZ GAME FOR GROUPS" (existing eyebrow, uppercased by CSS), Atkinson 700, 22 px, tracking 0.12em, `#D9D1EB` |
| Headline | x 64, top y 236, max width 640 | three lines "Pick a topic." / "Everyone plays —" / "including you." (existing H1), Bricolage 800, `font-stretch: 82%`, 92 px, line-height 0.94, tracking -0.035em, `#FAF7FF`; third line gradient `#B79CFF → #FF7AB6` |
| Address | x 64, baseline y 566 | "www.kazoot.app", Atkinson 700, 28 px, `#D9D1EB` |
| Timer | x 760, y 96 | seconds chip "13": 3 px border `#C9B8FF`, radius 18, Bricolage 700 44 px `#C9B8FF`, padding 8×20; bar to its right: 250×14, radius 7, track `#251B3A`, fill `#C9B8FF` at 62 % |
| Tile block | x 740–1136, y 190–470, rotated -4° | 2×2 tiles, each 190×132, gap 16, radius 20: A `#22D3EE`, B `#FF7AB6`, C `#FFC53D`, D `#8FB0FF`. Each has a 56×56 chip (radius 14, `#140E22`) with its letter in the tile colour, Bricolage 700 32 px, at the tile's top-left (16 px inset). Tile B carries the chosen ring: `box-shadow: 0 0 0 5px #100A1C, 0 0 0 10px #FAF7FF`. No words on the tiles. |
| Block shadow | — | `0 60px 120px -40px rgba(124,58,237,0.75)` |

Rules: 64 px safe margin on all sides; no text smaller than 22 px (previews are often shown 300 px wide); no company name, no prices, no claims.

### 7.2 Meta tags (`frontend/index.html`)

Replace `<meta property="og:image" content="/favicon-512.png" />` and add the rest. Titles and descriptions are the existing ones.

```html
<link rel="canonical" href="https://www.kazoot.app/" />
<meta name="theme-color" content="#100A1C" />
<meta property="og:site_name" content="Kazoot" />
<meta property="og:url" content="https://www.kazoot.app/" />
<meta property="og:title" content="Kazoot — live quizzes where the host plays too" />
<meta property="og:description" content="Pick a topic, share a code, and everyone plays — including you." />
<meta property="og:type" content="website" />
<meta property="og:image" content="https://www.kazoot.app/og/kazoot-og-v1.png" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Kazoot — live quizzes where the host plays too" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://www.kazoot.app/og/kazoot-og-v1.png" />
<script src="/theme-init.js"></script>
```

Notes: the app is a single-page app, so every route (including `/join/CODE` invite links) serves these tags; that is the wanted behaviour. `RouteEffects` in `App.jsx` should also keep `link[rel=canonical]` at `https://www.kazoot.app` + the current path for the public pages. The bare domain must keep redirecting to `www` (see `DEPLOYMENT.md`), otherwise previews of bare-domain links have no image.

---

## 8. Game screens

Applies to the four live phases rendered by `SessionPage.jsx`: `waiting` (lobby), `question`, `results` (reveal), `ended` (final). Colours do not change. Layout, sizing and hierarchy do.

### 8.1 The shell (new `components/game/GameShell.jsx`)

One component wraps every live phase. It fills the visible viewport, never scrolls, and is the size reference for everything inside it.

```jsx
<Shell data-phase="lobby|question|reveal|final" data-role="host|player"
       data-display="device|big" data-preview={preview || undefined}>
  <Frame data-qlen data-alen data-cols data-clamped>
    <Top>   {/* status row, plus the connection notice as a second line */} </Top>
    <Body>  {/* phase content */} </Body>
    <Dock>  {/* pinned action or status */} </Dock>
  </Frame>
  <ConfettiLayer aria-hidden="true" />
</Shell>
```

```css
/* Outer: the size container. No padding here: an element cannot use its own cq units. */
.shell {
  position: fixed; inset: 0;            /* the visible viewport; follows browser bars and rotation */
  container: game / size;
  background: var(--paper);
  overflow: hidden;
  overscroll-behavior: none;
  touch-action: manipulation;           /* no double-tap zoom delay; pinch zoom still works */
}
.shell[data-preview] {                  /* hero device frames on the home page */
  position: relative; inset: auto; width: 100%; height: 100%;
  --floor: 0.55;                        /* lets type go below the px floors inside miniatures */
}
.shell[data-display='big'] { --cap: 1.6; --boost: 1.2; }

/* Inner: grid + padding + all size variables. */
.frame {
  --pad-x: clamp(10px, 3.2cqw, 48px);
  --gap:   clamp(6px, 1.6cqh, 20px);
  height: 100%;
  display: grid;
  grid-template: "top" auto "body" minmax(0, 1fr) "dock" auto / minmax(0, 1fr);
  gap: var(--gap);
  padding:
    max(6px, env(safe-area-inset-top))
    max(var(--pad-x), env(safe-area-inset-right))
    max(8px, env(safe-area-inset-bottom))
    max(var(--pad-x), env(safe-area-inset-left));
}
.frame[data-dock='none'] { grid-template: "top" auto "body" minmax(0, 1fr) / minmax(0, 1fr); }
.top  { grid-area: top; }
.body { grid-area: body; min-height: 0; min-width: 0; }
.dock { grid-area: dock; }
```

Layout modes are container queries on `game`, so the same rules work on a phone, in a resized laptop window, on a projector and inside the hero miniatures:

| Mode | Query | Typical viewports |
|---|---|---|
| **P** (portrait / near-square) | default | P1–P12, T1, T3 |
| **L** (short landscape) | `@container game (max-height: 420px) and (min-aspect-ratio: 5/4)` | L1–L6 |
| **W** (wide) | `@container game (min-height: 421px) and (min-aspect-ratio: 5/4)` | T2, T4, D1–D6 |

Height classes inside P, also container queries: **P-small** `(max-height: 499px)`, **P-regular** 500–699, **P-tall** `(min-height: 700px)`.

Mode L changes the frame grid so the dock shares the top row and costs no height:

```css
@container game (max-height: 420px) and (min-aspect-ratio: 5/4) {
  .frame { grid-template: "top dock" auto "body body" minmax(0, 1fr) / minmax(0, 1fr) auto; }
}
```

Mounting rules:

- `SessionPage` renders `<GameShell>` only when `session`, `seat` and a live phase exist. While it is mounted, `App.jsx`'s `Layout` renders no `SiteHeader` and no `SiteFooter`, and `<html>` gets `data-game-shell="true"`:

  ```css
  html[data-game-shell='true'], html[data-game-shell='true'] body { height: 100%; overflow: hidden; overscroll-behavior: none; }
  ```
  (A separate attribute from `data-stage`, because the name form on the same route must still scroll with the keyboard open.)
- `AnswerGrid` must stop declaring its own container (`container-type: inline-size` on `Wrap`): inside the shell every cq unit has to resolve against `game`.
- Fallback: wrap the fixed positioning and the no-scroll rules in `@supports (container-type: size)`. Without support the shell is a normal block and the page scrolls as it does today (criterion G10).
- Screen wake lock: while the shell is mounted, hold `navigator.wakeLock.request('screen')` when available and re-acquire it on `visibilitychange`. Phones otherwise dim and lock in the lobby and between questions.
- Text language: set `lang="et"` on question and answer text when `session.language === 'Estonian'` (else `en`), so `hyphens: auto` and screen readers use the right language.
- Preview mode (`data-preview`, used by the home hero) is presentation only: no `data-game-shell`, no wake lock, no toasts, no focus management, no sheets, and the whole subtree is `inert`.

### 8.2 Top bar

`display: flex; align-items: center; gap: clamp(8px, 2cqw, 24px); min-height: clamp(36px, 6.5cqh, 76px)`. Text: body 700, `clamp(13px, 2.1cqh, 1.4rem)`, `--ink-3`. Mode L: `min-height: 44px`.

| Phase | Left | Middle (flex 1) | Right |
|---|---|---|---|
| Lobby | logo tile 28×28 (not a link) + existing eyebrow "Your room is ready" / "You’re in" | — | host, shell ≥ 700 wide: "Big screen" toggle. Everyone: "Leave" (host) / "Leave room" (player), `ghost`, 44 high |
| Question | progress | countdown: seconds chip + bar | answered count; "Full text" button when clamped |
| Reveal | progress | — | "Full text" when clamped |
| Final | logo tile + "Final results · {topic}" (existing eyebrow, one line, ellipsis) | — | "Back to home" (`ghost`, 44 high) |
| Any, Big screen on | … | … | join strip before the right-hand items (8.10) |

- **Progress**: shell width < 600: "3/10" (display 700, tabular), with the existing sentence "Question 3 of 10" as a visually hidden label. Width ≥ 600: the existing text plus the step dots.
- **Countdown** (`Countdown.jsx`): chip `font: 700 clamp(1.15rem, 4.6cqh, 4rem) var(--font-display)`, `min-width: 3.2ch`, 2 px border, radius `clamp(10px, 1.8cqh, 16px)`, padding `0.12em 0.45em`; the clock icon is hidden below 600 wide. Bar: `height: clamp(6px, 1.2cqh, 18px)`, `min-width: 32px` (hidden if less is available), radius half its height. The fill animates with `transform: scaleX(ratio)` and `transform-origin: left`, not `width`. Colours, thresholds, pulse and announcements are unchanged.
- **Answered count**: width < 600: users icon + "7/9"; ≥ 600: "7 of 9 answered". The `aria-live="polite"` element always contains the full sentence. In a solo preview this slot shows a neutral chip "Solo preview" (existing words) instead; the three-line solo notice is no longer rendered in the game.
- **Connection notice** (`ConnectionBanner.jsx`): rendered inside `.top` as a second line under the status row, so it takes space from the body and the fit logic re-runs. Compact notice: `font-size: clamp(13px, 2cqh, 1rem)`, padding `6px 10px`, at most three lines; the "Retry now" button is `sm` (44). Texts unchanged.
- **Toasts** inside the shell move to the top: `top: calc(env(safe-area-inset-top) + clamp(36px, 6.5cqh, 76px) + 12px); bottom: auto`, so they never cover the dock.

### 8.3 Dock: how the host's action stays reachable

The dock is the last row of the frame grid. It is in normal flow, not `position: fixed`, so it cannot overlap content, cannot be pushed off-screen, and needs no z-index. The frame's bottom padding is `max(8px, env(safe-area-inset-bottom))`, so the button always clears the home indicator; `viewport-fit=cover` is already set in `index.html`.

| Phase | Host | Player |
|---|---|---|
| Lobby | existing hint line (hidden in P-small and L) + "Start game" (`primary`) | status: "Playing as **{name}**. The first question appears here when the host starts. Keep this page open." (existing; in P-small and L only the first sentence is visible, the rest stays for screen readers) |
| Question | status slot | status slot |
| Reveal | "Next question" / "Show final results" (`primary`, existing labels, arrow icon); above it, when standing in: "You’re standing in while the host is away." | status: "Waiting for the host to continue…" / host-away / reconnecting lines (existing) |
| Final | final actions panel (8.9) | final actions panel (8.9) |

Sizes:

- Host button: `width: 100%` in P; `height: clamp(48px, 8cqh, 76px)`; `font-size: clamp(1rem, 2.6cqh, 1.6rem)`; radius 14. In W: right-aligned, `min-width: min(100%, 320px)`, with the status text to its left. In L: it sits in the top row's right cell, `height: 44px; padding: 0 18px`, auto width.
- Status slot: `min-height: clamp(34px, 5.5cqh, 56px)`; text body 700, `clamp(13px, 2.2cqh, 1.25rem)`, `--ink-2`, at most two lines, with the existing icon. The slot is reserved in the question phase even when empty, so locking an answer never shifts the layout.
- Question phase in mode L: the status text is visually hidden (the chosen tile already carries "Locked in"); it is still in the `role="status"` element.
- Other status texts in mode L sit in the top row's right cell: `max-width: 60cqw`, up to two lines, right-aligned.
- A failed answer (danger notice, existing text) uses the same slot in P and W; in L it appears as the second line of the top bar.

### 8.4 Type and size formulas

All values are for elements inside `.frame`. `--floor`, `--cap` and `--boost` default to 1.

| Element | Formula |
|---|---|
| Question text | display 700, `font-stretch: 90%`, line-height 1.12, tracking -0.02em. `font-size: clamp(calc(15px * var(--floor, 1)), calc(var(--q-tier) * var(--boost, 1) * var(--fit-q, 1)), calc(5.5rem * var(--cap, 1)))` |
| `--q-tier`, modes P and W | by question length (`data-qlen`): **xs** ≤ 60 chars `min(7.4cqw, 6.2cqh)`; **s** 61–120 `min(6.2cqw, 5.0cqh)`; **m** 121–180 `min(5.3cqw, 4.2cqh)`; **l** 181–240 `min(4.7cqw, 3.6cqh)` |
| `--q-tier`, mode L | xs `min(3.6cqw, 9cqh)`; s `min(3.1cqw, 7.6cqh)`; m `min(2.7cqw, 6.6cqh)`; l `min(2.4cqw, 5.8cqh)` |
| Answer text | body 700, line-height 1.22. `font-size: clamp(calc(13px * var(--floor, 1)), calc(var(--a-tier) * var(--boost, 1) * var(--fit-a, 1)), calc(2.6rem * var(--cap, 1)))` |
| `--a-tier`, modes P and W | by the longest answer (`data-alen`): **s** ≤ 24 chars `min(5.2cqw, 3.4cqh)`; **m** 25–60 `min(4.8cqw, 3.1cqh)`; **l** 61–120 `min(4.1cqw, 2.5cqh)` |
| `--a-tier`, mode L | s `min(2.6cqw, 6.4cqh)`; m `min(2.3cqw, 5.4cqh)`; l `min(2.0cqw, 4.6cqh)` |
| Letter chip | `width`/`height: clamp(22px, 1.9em, 60px)`; radius `0.32em` min 7 px; display 700, 0.9em |
| Tile | padding `clamp(6px, 1.3cqh, 20px) clamp(10px, 2.2cqw, 28px)`; radius `clamp(12px, 2.4cqh, 20px)`; 2 px border; `min-height: 44px` when it is a button |
| Tile gap | `clamp(6px, 1.3cqh, 18px)` |
| Leaderboard row | height `clamp(30px, 5cqh, 60px)`; text `clamp(13px, 2.3cqh, 1.4rem)`; rank chip `1.9em` |
| Room code (lobby) | display 700, tracking 0.06em, tabular. P: `clamp(1.75rem, 10cqw, 3.2rem)`; W: `clamp(3rem, min(9cqw, 14cqh), 9rem)` |

Worked checks (shell = viewport):

| Viewport, fixture | Question | Answers |
|---|---|---|
| P3 360×560, F-typical (90 / 40 chars) | tier s = 22.3 px, 3–4 lines, 75–100 px | stacked, tier m = 17.3 px, 2 lines; tiles ≈ 80 px high |
| P3 360×560, F-short | tier xs = 26.6 px, 2 lines | 2×2, 18.7 px; tiles ≈ 190 px high |
| P1 320×454, F-typical | tier s = 19.8 px, 3–4 lines, 67–90 px | stacked, 14.1 px, 2–3 lines; tiles ≈ 60 px high |
| P7 393×730, F-typical | 24.4 px, 3–4 lines | stacked, 18.9 px; tiles ≈ 110 px |
| D1 1280×720, F-typical | 36 px, 2 lines | 2×2, 22.3 px; tiles ≈ 245 px |
| D5 1920×1080, Big screen, F-short | 80 px | 2×2, 44 px |
| P3 360×560, F-long | fit hook takes the question to 15 px (6 lines) and the answers to 13 px (4 lines). By my arithmetic this is within a few px of fitting; expect either a fit or a one-line clamp. Verify with the fixture. | |
| P1 320×454, F-long | does not fit at the floors: clamped, "Full text" shown | |

### 8.5 Text fitting

Three layers. The first two are CSS and cover almost all real content; the third is a guarantee.

**Layer 1: length tiers.** `lib/gameUi.js` gets pure helpers (unit-tested): `questionTier(text)` → `xs|s|m|l`, `answerTier(choices)` → `s|m|l` (by the longest choice), `longestWord(choices)`. `QuestionScreen` writes `data-qlen`, `data-alen` on the frame.

**Layer 2: grid shape.** `data-cols` on the frame, decided once per question:

- `2` (a 2×2 grid) when the shell is in mode L or W; or `data-alen='s'` and the longest word is ≤ 11 characters; or the shell is ≥ 600 wide and `data-alen` is `s` or `m`.
- `1` (four stacked tiles) otherwise: portrait phones with medium or long answers.

```css
.answers { display: grid; grid-auto-rows: minmax(0, 1fr); grid-template-columns: minmax(0, 1fr); height: 100%; }
.frame[data-cols='2'] .answers { grid-template-columns: repeat(2, minmax(0, 1fr)); }
```
In a portrait 2×2 grid the letter chip sits above the text (tile is a column) so a tile keeps about 15 characters per line at 360 wide. Everywhere else the chip is left of the text.

Wrapping: `overflow-wrap: anywhere; hyphens: auto` on question and answers (with the right `lang`, 8.1).

**Layer 3: the fit hook** (new `lib/fitStage.js`, `useFitStage(frameRef, deps)`). Runs in `useLayoutEffect` when the question or results change, on shell resize (`ResizeObserver`, one `requestAnimationFrame` per burst) and once after `document.fonts.ready`.

```js
// q = [data-fit='question'], tiles = [data-fit='answer'] text boxes; both have overflow: hidden and a bounded height.
const over = () => q.scrollHeight > q.clientHeight + 1 || tiles.some(t => t.scrollHeight > t.clientHeight + 1);
reset(--fit-q: 1, --fit-a: 1, data-clamped: off);
if (!over()) return;
binarySearch('--fit-a', 0.6, 1, 5 steps);      // shrink answers first; CSS clamp() stops at the 13 px floor
if (over()) binarySearch('--fit-q', 0.6, 1, 5); // then the question (its row is auto-height, so this frees space)
if (over()) {                                    // last resort
  frame.dataset.clamped = 'true';
  set('--q-lines', floor(q.clientHeight / lineHeight(q)));
  tiles.forEach(t => t.style.setProperty('--a-lines', max(1, floor(t.clientHeight / lineHeight(t)))));
}
```
Cost: at most about 12 forced layouts, once per question or resize, never per frame.

**When clamped** (`data-clamped='true'`):

- Question: `max-height: 30cqh; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: var(--q-lines); overflow: hidden`. Answers: the same with `--a-lines`.
- The top bar shows the button "Full text" (new string; `secondary sm`, 44 high).
- It opens a `Sheet` (5.8). Title: "Question {n} of {total}" (existing). Content: a compact countdown pinned at the top of the sheet (`position: sticky; top: 0`), the full question at 1.25rem display 700, then the four answers at 1.0625rem as full-width tile buttons with auto height. While answering is open they are live: pressing one submits the answer and closes the sheet. In the reveal phase the same sheet shows the reveal-mode list.
- The sheet closes on time-up and on any phase change.

### 8.6 Lobby (`components/game/Lobby.jsx`)

**Host, mode P** (body is a flex column, `gap: var(--gap)`):

| # | Block | Spec |
|---|---|---|
| 1 | Topic | `h1`, display 800, stretch 88%, `clamp(1.25rem, min(6cqw, 4cqh), 3rem)`, max 2 lines (ellipsis; the host typed it) |
| 2 | Badges (`RoomBadges`) | one row; `flex-wrap: wrap; max-height: 1 row; overflow: hidden`. Order changed so the important one survives: review/surprise badge, question count, seconds, language, demo/AI. P-tall and W: up to two rows. |
| 3 | Room code | existing `Code` element and `aria-label`; centred; size from 8.4 |
| 4 | QR + how to join | grid `auto minmax(0, 1fr)`, gap 12. QR box: white, padding 8, radius 12; side `min(34cqw, 26cqh, 320px)`; P-small with review mode: `min(28cqw, 20cqh)`. Render `QRCodeSVG` at `size={256}` and scale with CSS (`width: 100%; height: auto`). Right cell: existing sentence "Players go to **{host}/join** and enter this code, or scan the QR code." at `clamp(13px, 2.2cqh, 1.1rem)` (P-small: only the bold address is visible), then "Copy invite link" (`secondary sm`, 44) |
| 5 | Review (only `reviewMode` and owner) | one button row: `secondary`, 44 high, full width, label "Review mode" (existing eyebrow text) with the arrow icon. Opens a `Sheet` titled "Review mode" containing the existing explanation and the existing "Review questions and answers" button, then the existing editor. Width 760 on desktop. Nothing in the lobby itself scrolls. |
| 6 | Players | header row: "{n} players connected" (left), "Up to {max}" (right). Then the chip area: `flex: 1 1 0; min-height: 0; overflow: hidden`. New hook `useItemsThatFit` renders as many name chips as fit in whole rows and ends with a "+{n}" chip (digits only). The header is a button when chips are hidden: it opens a `Sheet` titled "{n} players connected" with the full list. Chip: padding `6px 12px`, radius 10, 700, `clamp(13px, 2.2cqh, 1.15rem)`; "me", offline and role styles unchanged. |
| Dock | | hint (existing two variants) + "Start game" |

Solo demo: the lobby is skipped by the existing auto-start; if it flashes, it shows blocks 1, 2, 6 only.

**Player, mode P**: blocks 1, 2, a waiting indicator (three 10 px dots in `--answer-a/b/c`, opacity pulse 1.2 s, staggered 200 ms; static under reduced motion), host-away / reconnecting notices (existing), block 6. Dock: the "Playing as …" status.

**Mode L**: body is two columns (`minmax(0, 1.1fr) minmax(0, 1fr)`): left code + QR (QR side `min(46cqh, 22cqw)`), right topic (1 line), players. Badges hidden. "Start game" is in the top row.

**Mode W**: two columns (`minmax(0, 1.15fr) minmax(0, 1fr)`, gap `4cqw`). Left: eyebrow "Invite players", the join address `{host}/join` at `clamp(1.25rem, 4cqh, 3rem)` display 700, the room code (W formula), the QR at `min(34cqh, 28cqw, 420px)`, "Copy invite link". Right: topic, badges, players (chips at the upper size). Dock: hint left, "Start game" right.

### 8.7 Question (`QuestionScreen` in `RoundScreens.jsx`, `AnswerGrid.jsx`)

Body:

| Mode | Layout |
|---|---|
| P | rows: question `auto` with `max-height: 38cqh`; answers `minmax(0, 1fr)` |
| L | columns `minmax(0, 0.42fr) minmax(0, 0.58fr)`, gap `2.4cqw`: question left, vertically centred, `max-height: 100%`; answers right, 2×2 |
| W | rows: question `auto`, `max-height: 34cqh`, centred text, `max-width: 30em` centred; answers `minmax(0, 1fr)`, 2×2 |

The timer, progress and answered count are in the top bar (8.2). The body contains only the question and the answers.

Tile states are unchanged (available, chosen, other, and the dashed focus ring). Two changes:

1. The "Sending…" / "Locked in" tag is a badge on the tile's top-right corner (`position: absolute; top: -9px; right: 10px; height: 22px; padding: 0 9px; font-size: clamp(12px, 1.7cqh, 0.9rem)`, existing colours), not a row inside the tile. Selecting an answer changes no tile's size.
2. Tiles fill the answers area (`grid-auto-rows: minmax(0, 1fr)`); text is vertically centred.

Sub-states:

| Sub-state | What changes |
|---|---|
| Unanswered | tiles filled; dock slot empty (reserved) |
| Sending | chosen tile ring + "Sending…" badge; other tiles outlined; all disabled |
| Locked in / waiting | "Locked in" badge; dock: "Locked in. The answer appears when time is up." or "… when everyone has answered." (existing) |
| Time up | tiles disabled; dock: "Time’s up — revealing the answer…" |
| Failed | tiles re-enabled; dock (or top bar second line in L): existing danger text |

Host and player see the same screen. In Big screen mode the host's chosen tile is not ringed (8.10).

Focus: on a new question, focus moves to the question heading as today (`tabIndex={-1}`).

### 8.8 Reveal (`ResultsScreen` in `RoundScreens.jsx`, new `components/game/OutcomeHero.jsx`)

Hierarchy, in reading order and in size: (1) how I did: verdict, points, rank; (2) the correct answer; (3) the leaderboard; (4) the other answers and the question recap; (5) the pinned host action or waiting status.

**Outcome block** (replaces the small `RoundOutcome` chip and the "You’re 1st" text in the top line):

- Container: grid `minmax(0, 1fr) auto`, gap 12, padding `clamp(8px, 1.6cqh, 20px) clamp(12px, 3cqw, 28px)`, radius 16, `min-height: clamp(60px, 13cqh, 150px)`. Tone: correct `background: var(--success-soft)`, wrong `var(--danger-soft)`, no answer `var(--surface-sunk)`; border `1px solid color-mix(in srgb, <tone colour> 35%, transparent)`.
- Left cell, correct: label = check icon + "Correct" (body 700, `clamp(0.875rem, 2.3cqh, 1.5rem)`, `--success`); value = "+{formatPoints(points)}" e.g. "+776 pts" (display 800, stretch 88%, `clamp(1.6rem, min(9cqw, 6.2cqh), 5rem)`, `--ink`, tabular). Both pieces come from the existing "Correct · +776 pts".
- Left cell, wrong: x icon + "Not this time"; no answer: dash icon + "No answer this round". These take the large size: display 800, `clamp(1.25rem, min(6.5cqw, 4.6cqh), 3.5rem)`, colour `--danger` / `--ink-2`.
- Right cell (when the viewer has a rank): small label "You’re" (`clamp(0.8rem, 1.9cqh, 1.1rem)`, `--ink-2`) above the ordinal, e.g. "1st", at the same size and face as the points. The pair is the existing sentence "You’re {ordinal}"; the element's accessible text is that sentence.
- This block is the `h1` of the reveal and receives focus when the results arrive. Its accessible name: verdict, points, rank, in that order.
- Motion: points count up from 0 (effect E10); the block scales in from 0.96.
- Mode L: one line, `min-height: 44px`: verdict · points · rank inline, value size `clamp(1.1rem, 7cqh, 1.75rem)`.

**Question recap**: the question text as a single reference line, body 700, `clamp(0.875rem, 2.2cqh, 1.5rem)`, `--ink-2`. P-small and L: hidden (still present for screen readers). P-regular: 1 line. P-tall: 2 lines. W: up to 3 lines at the upper size. This is the one place where truncation is by design: the question was shown in full a moment earlier and the "Full text" sheet has it.

**Answers, modes P and L: compact rows** (`AnswerGrid mode="reveal" compact`):

- Each row: grid `auto minmax(0, 1fr) auto` (chip, text, trailing), `min-height: clamp(26px, 5.2cqh, 64px)`, padding `2px clamp(8px, 2.2cqw, 16px)`, radius 12, text `clamp(13px, min(4.2cqw, 2.4cqh), 1.4rem)` / 700. Rows are auto-height and take only the lines they need.
- Correct row: filled with its tile colour, `box-shadow: 0 0 0 2px var(--paper), 0 0 0 4px var(--correct-ring)`, trailing tag "Correct" or "Correct · yours" (existing). Up to 3 lines.
- The viewer's wrong pick: outlined, trailing tag "Your answer" (existing). Up to 2 lines.
- Other rows: outlined, text `--ink-2`, up to 2 lines.
- If any row still overflows, the fit hook shrinks to 13 px and then clamps, which shows "Full text" (only expected with F-long).
- **Counts, zero noise removed**: a count is shown only when it is greater than 0 and the room has more than one player. Compact form: users icon + the number (display 700, 0.85em, tabular) in the trailing cell before the tag, with the existing words as the accessible label ("3 players", "1 player"), and a 3 px bar along the row's bottom edge (`transform: scaleX(share)`, origin left, `currentColor` at 60 %). Rows with 0 show no number and no bar. When nobody answered, no row shows a count. Solo: never.

**Answers, mode W: tiles.** 2×2 tiles as in the question phase, correct tile filled with the ring and tag, others outlined. Under the text, only where the count is above 0: the existing line "{n} players · {percent}%" with a 6 px bar.

**Leaderboard** (`Leaderboard.jsx`): fills what is left (`flex: 1 1 0; min-height: 0; overflow: hidden`). New hook `useRowsThatFit(ref, rowHeight, gap)` → N. Render:

- N ≥ 2: the top N rows; if the viewer is not among them, the top N−1 and then the viewer's row.
- N = 1: the viewer's row only (the leader only, for a viewer without a seat).
- N = 0: nothing; the rank is already in the outcome block.
- Upper limits: P 5, L 6, W 8, Big screen 10.
- The eyebrow "Leaderboard" is shown in P-tall and W only. No surrounding card in P and L (rows sit on the stage); a `Card` in W.

**Body layout**

| Mode | Layout |
|---|---|
| P | column: outcome, recap, answers (auto), leaderboard (flex 1) |
| L | two columns `minmax(0, 1.35fr) minmax(0, 1fr)`: left outcome + answers (rows share the height equally); right leaderboard. Host button in the top row. |
| W | two columns `minmax(0, 1.5fr) minmax(0, 1fr)`, gap `3cqw`: left outcome, recap, 2×2 tiles (flex 1); right leaderboard card, full height |

Budget checks (host, the tighter case, F-typical). P1 320×454: top 36, dock 48, padding and gaps 29 → body ≈ 340; outcome 60, four two-line rows ≈ 166, gaps 14 → about 100 left: 3 leaderboard rows of 30. P7 393×730: body ≈ 588; outcome 95, recap 36, answers ≈ 205, eyebrow and gaps 55 → about 197: 4 rows of 36. L3 667×331: body ≈ 267; left outcome 44 + four rows of 50; right 6 rows.

### 8.9 Final (`components/game/FinalScreen.jsx`, new `Podium.jsx`, `Confetti.jsx`)

Fixes: the conversion card is first and primary for demo players, a real podium for 1, 2 and 3+ players, one statement of each fact instead of three, a celebration, and no scrolling.

**Headline block**: `h1` with the existing texts ("You won!", "You finished {ordinal}", "Quiz complete", "Game over"), display 800, stretch 84%, `clamp(1.6rem, min(9cqw, 6cqh), 5rem)`; receives focus. Under it, only when there are 2+ players and the viewer has a seat: the existing line "{points} · {x} of {y} correct" (`clamp(0.875rem, 2.2cqh, 1.4rem)`, `--ink-2`). With one player this line is omitted because the pedestal shows the same numbers.

**Podium** (`<ol aria-label="Top three">`, DOM order 1st, 2nd, 3rd; visual order by CSS `order`):

| Players | Layout |
|---|---|
| 3 or more | three columns, visual order 2nd · 1st · 3rd, `gap: 2cqw`, total width `min(100%, 720px)`, centred |
| 2 | two columns, 1st · 2nd, total width `min(100%, 480px)`, centred. No empty third slot. |
| 1 | one column, width `min(56cqw, 320px)`, centred |

Each column is a flex column aligned to the bottom:

- Crown icon (existing `crown`, `--podium-1`, `1.4em`) above the 1st-place name only.
- Name: display 700, `clamp(0.95rem, 2.6cqh, 2rem)`, max 2 lines, `overflow-wrap: anywhere`, centred. The viewer's own column adds the existing " (you)".
- Pedestal: a block with radius `14px 14px 0 0`, background `--podium-1` / `-2` / `-3`, text `--answer-ink`, height 100 % / 72 % / 52 % of the pedestal track (the track is what remains of the podium area after the tallest name block; a single pedestal uses 100 %). Inside, top-aligned: the rank numeral ("1", "2", "3"), display 800, `clamp(1.5rem, 5cqh, 4.5rem)`; under it the score from `formatPoints`, 700, `clamp(0.8125rem, 2cqh, 1.25rem)`. With one player, also "{x} of {y} correct".
- Minimum pedestal height 44 px (the 3rd place must still hold its numeral); if the track is shorter than 85 px the score line is hidden on 2nd and 3rd.

**Standings**: only with 4+ players. Rows from rank 4 using `useRowsThatFit`, with the viewer's row guaranteed (same rule as the reveal). Under the rows, when not everyone is shown: the button "Full standings" (existing eyebrow text; `ghost sm`, 44) opening a `Sheet` with the complete `Leaderboard` (`showCorrect`, limit 50 plus the viewer, as today). With 1–3 players this region does not exist and the podium takes the space.

**Final actions panel** (the dock in this phase): `background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: clamp(10px, 2cqh, 20px)`. Content: optional title and text (existing strings from the current card), then the buttons. "Back to home" is in the top bar.

| Viewer | Title / text (shown when shell height ≥ 700, or in W) | Primary button | Secondary button |
|---|---|---|---|
| Owner-host of a demo, signed out (the conversion moment) | "Create a quiz on your own topic" + "That was a hand-written demo. Pick a topic you like and Kazoot writes fresh questions — then you play along with everyone else." | "Create your own quiz" → `/create` (keep the `end_cta_clicked` tracking) | "Play another" (1 player) / "Play again with this group" (2+) → opens the play-again sheet |
| Owner-host, signed in, or after an AI quiz | title per `session.isDemo` as today | "Play another" / "Play again with this group" → sheet | "Create your own quiz" → `/create` |
| Player (not owner) | "Your turn to host?" eyebrow + title/text per `session.isDemo` as today | "Create your own quiz" → `/create` | none. Caption under the button (2 lines, 13 px+): "If the host starts another game, you’ll move to it automatically — just keep this page open." |

- Buttons: side by side in P (`primary` `flex: 1.4`, `secondary` `flex: 1`), height `clamp(48px, 8cqh, 64px)`. At shell width < 340 they stack.
- In P-small and L only the buttons are shown (title and text are dropped; the text is not needed to act).
- The play-again sheet contains the existing `PlayAgainPanel` form unchanged (its eyebrow becomes the sheet title; the small "Want your own topic next time? …" line stays inside it for signed-out hosts). "Start next game" follows the validation pattern (5.1).

**Body layout**

| Mode | Layout |
|---|---|
| P | column: headline block (auto), podium (`flex: 1.4 1 0; min-height: 0`), standings (`flex: 1 1 0`, only 4+ players) |
| L | two columns `minmax(0, 1.2fr) minmax(0, 1fr)`: left podium (names one line); right headline, then standings or nothing. Actions in the top row (buttons only). |
| W | two columns `minmax(0, 1.4fr) minmax(0, 1fr)`: left headline + podium; right standings (`Card`, rows that fit, "Full standings") above the actions panel with title and text |

**Celebration** (effects E11, E12): pedestals rise in the order 3rd, 2nd, 1st (delays 0 / 180 / 360 ms, 520 ms each, `--ease-spring`, `transform: scaleY(0) → 1` with origin bottom; contents fade in after their pedestal). At 900 ms, one confetti burst from the top of the podium. Everyone sees it once per final screen; it does not replay on reconnect (`sessionStorage` flag per room). Reduced motion: podium shown complete, no confetti.

### 8.10 Big screen (host display / projector mode)

What it is: a display setting on the host's own device. No backend change, no second seat.

- **Control**: a toggle button in the top bar, host only, shown when the shell is ≥ 700 wide. Label "Big screen" (new string), icon `expand` (add to `Icon.jsx`: `M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5`), `aria-pressed`. 44 high.
- **On**: sets `data-display="big"`, calls `document.documentElement.requestFullscreen()` (ignore rejection; the layout already fills the window), stores `kazoot:display:{sessionId}` = `big` in `sessionStorage`. **Off**: by the same button, or when fullscreen is left with `Escape` (`fullscreenchange`).
- **Scale**: `--cap: 1.6` and `--boost: 1.2` (8.1), so type keeps growing with the screen: at 1920×1080 a short question is 80 px and short answers 44 px; at 3840×2160 the caps allow twice that. The countdown bar reaches its 18 px maximum; the chip 64 px.
- **Join strip**, always visible in the top bar in lobby, question and reveal: `{window.location.host}/join` in `--ink-2` followed by the room code in a chip (`background: var(--surface-sunk); padding: 0.15em 0.6em; border-radius: 10px`), both display 700, `clamp(1rem, 3.4cqh, 2.5rem)`, tracking 0.06em. No added words. Latecomers can always join, as the lobby text promises.
- **Lobby**: mode W layout; QR up to 420 px; the room code up to 9rem × `--cap`.
- **Leaderboard**: up to 10 rows.
- **The host's pick stays private**: with Big screen on, after the host answers, no tile gets the chosen ring; all four go to the outlined "other" state and the dock shows the existing "Locked in. …" line. In the reveal, the host's row tags ("Correct · yours", "Your answer") are replaced by the neutral "Correct" tag only, and the outcome block is replaced by the correct answer shown large (the outcome is personal; the room wants the answer). The host's own result is still in the leaderboard row.
- Players never see this control. Their layout fills their viewport anyway; a player on a laptop simply gets mode W.

### 8.11 Small cross-cutting rules

- No element inside the shell uses `vh`, `vw`, `rem`-only sizes for layout heights, or fixed pixel heights above 76 px. Heights come from the grid, `cqh`, or content.
- `user-select: none` on tiles and buttons in the shell; text in the Full text sheet is selectable.
- Rotation and browser-bar changes need no JavaScript for layout (container queries); only the fit hook re-runs.
- The existing focus management (heading focus on screen change), live regions and toasts stay; see section 11.

---

## 9. Summary: what is shown, by size and role

| Element | P-small (< 500 high) | P-regular (500–699) | P-tall (≥ 700) | L | W | Big screen |
|---|---|---|---|---|---|---|
| Progress | "3/10" | "3/10" | "3/10" (full text ≥ 600 wide) | full text ≥ 600 wide | full text + dots | full text + dots |
| Clock icon in chip | hidden | hidden | hidden < 600 wide | shown ≥ 600 | shown | shown |
| Answered count | icon + "7/9" | icon + "7/9" | icon + "7/9" | full sentence ≥ 600 | full sentence | full sentence |
| Lobby badges | 1 row | 1 row | 2 rows | hidden | all | all |
| Lobby join sentence | address only | full | full | address only | full, large | full, large |
| Lobby host hint | hidden | shown | shown | hidden | shown | shown |
| Lobby player chips | rows that fit, may be 0 ("+n") | rows that fit | rows that fit | rows that fit | rows that fit | rows that fit |
| Question status line | 2 lines max | 2 lines | 2 lines | visually hidden (tile badge) | 1 line | 1 line |
| Answer grid | 1×4, or 2×2 for short answers | same | same | 2×2 | 2×2 | 2×2 |
| Reveal question recap | hidden | 1 line | 2 lines | hidden | up to 3 lines | up to 3 lines |
| Reveal answers | compact rows | compact rows | compact rows | compact rows | 2×2 tiles with counts | 2×2 tiles with counts |
| Reveal leaderboard | rows that fit (≥ 2 at P1) | rows that fit, max 5 | max 5 + eyebrow | max 6 | max 8, card | max 10 |
| Final title + text in actions | hidden | hidden | shown | hidden | shown | shown |
| Final standings rows | rows that fit (may be 0) + "Full standings" | same | same | same | same | same |
| Host action position | bottom dock | bottom dock | bottom dock | top row, right | bottom dock, right-aligned | bottom dock, right-aligned |

Host and player differences:

| State | Host | Player |
|---|---|---|
| Lobby | code, QR, copy link, review button (review mode), "Start game", "Leave", Big screen toggle | waiting indicator, "Playing as …", "Leave room" |
| Question | identical | identical |
| Reveal | pinned "Next question" / "Show final results"; standing-in note when applicable | waiting / host-away / reconnecting status line |
| Final | play-again entry (owner), order of buttons by sign-in state | "Create your own quiz", auto-move caption |
| Big screen | available | not available |

---

## 10. Effects catalogue

### 10.1 The effects

Every effect animates only `transform` and `opacity` unless the row says otherwise. "RM" = behaviour under `prefers-reduced-motion: reduce`. "Lite" = behaviour when `<html data-lite>` is set (10.2).

| # | Effect | Where | How to build | RM fallback | Cost and contrast |
|---|---|---|---|---|---|
| E1 | **Spotlight glows** | Home hero and finale (`::before`); the Free band (its gradient fill); game lobby and final: one glow, `radial-gradient(60% 40% at 50% 0%, var(--glow-a), transparent 70%)` on the shell | Static `radial-gradient` layers on a pseudo-element at `z-index: -1` inside `isolation: isolate`. No `filter`, no `backdrop-filter`, no animation. | Unchanged (static) | Painted once. Contrast: alphas capped by the tokens (4.1); `--ink-3` never sits on a glow. |
| E2 | **Grain** | Hero and finale only | `::after`: `background: url('/brand/grain-128.png') repeat; opacity: 0.05; pointer-events: none`. A 128×128 PNG of white noise with per-pixel alpha 0–0.08, ≤ 8 KB. Not `position: fixed`, no `mix-blend-mode`, no SVG filter. | Unchanged (static) | One small tiled image. Off in light theme, Lite, `prefers-contrast: more`, forced colours. Raises background luminance by well under 1 %, so text ratios are unaffected. |
| E3 | **Live countdown in the hero** | Device stage (6.1) | `useDemoLoop`: one 250 ms interval drives the real `Countdown` and `AnswerGrid` in both frames. Timer bar is `transform: scaleX()`. Runs only while the figure is in view (`IntersectionObserver`) and the tab is visible. | Static frame: timer 13, phone locked on B | Four small re-renders per second of two subtrees; zero when off-screen. Lite: static. |
| E4 | **Device stage composition** | Hero | CSS frames (6.1); phone rotated 3°. On fine pointers the phone follows the pointer by up to 2° using the existing `usePointerTilt` (`max: 2, smoothing: 0.14`, area = the figure). | No tilt | Static shadows; one transform on pointer move, already rAF-throttled. Phones: no tilt, smaller shadow. |
| E5 | **Tile settle-in** | Hero tiles at each loop start; step vignettes when revealed; the four answer tiles at the start of each real question | `@keyframes settle { from { opacity: 0; transform: translateY(12px) scale(0.97); } }` with `animation: settle var(--dur-slow) var(--ease-out) backwards; animation-delay: calc(var(--i) * 60ms)`. In the real game: 240 ms and 50 ms stagger (done within 400 ms). Tiles are tappable from the first frame. | None (tiles simply appear) | Four elements, under half a second. |
| E6 | **Button sheen** | Primary buttons | An edge highlight, not a sweep across the fill: white text on the magenta end of the gradient is 4.71:1, so the fill under the label must not get lighter. `::after { inset: 0; padding: 1.5px; border-radius: inherit; background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.85) 50%, transparent 65%) 130% 0 / 260% 100% no-repeat; mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); }` (with the `-webkit-mask-composite: xor` form for Safari). On `:hover` (only `@media (hover: hover)`) animate `background-position` from `130% 0` to `-30% 0` in 900 ms, once per hover. One automatic pass on the hero's primary button 1.2 s after load. | None | Animates `background-position` on a ring the size of one button, for 0.9 s, on hover. The only non-transform animation in the catalogue; it is small and never runs during scroll. Label contrast unchanged. |
| E7 | **Scroll-reveal** | Home: step cards, organiser split, the three answer cards, pricing block, FAQ column, finale text. Nothing above the fold, nothing on other pages, nothing in the game. | `useReveal()` (new `lib/useReveal.js`): one shared `IntersectionObserver` (`rootMargin: '0px 0px -10% 0px'`, once) sets `data-in`. CSS, inside `@media (prefers-reduced-motion: no-preference)`: `[data-reveal] { opacity: 0; transform: translateY(16px); } [data-reveal][data-in] { opacity: 1; transform: none; transition: opacity var(--dur-slow) var(--ease-out), transform var(--dur-slow) var(--ease-out); transition-delay: calc(var(--i, 0) * 60ms); }` | Content visible from the start (the hiding rule is inside the no-preference query) | At most 12 observed elements, each animated once. If the observer is unavailable, set `data-in` immediately. |
| E8 | **Spotlight sweep** | Hero host screen, once per page load | `::after` inside the screen frame (which has `overflow: hidden`): `background: linear-gradient(100deg, transparent 35%, rgba(255,255,255,0.07) 50%, transparent 65%); transform: translateX(-130%)`, animated to `translateX(130%)` in 1600 ms, `--ease-in-out`, delay 600 ms, `forwards`. | None | One element, once. Lite and light theme: none. Lightens the mock UI by at most 7 % for a moment; dark-on-bright tile text gains contrast, light-on-dark text stays above 6:1. |
| E9 | **Logo ring and halo** | Header logo tile | Static `box-shadow: var(--glow-logo)` | Unchanged | None. |
| E10 | **Reveal moment** | Reveal screen | Outcome block: `opacity 0 → 1; scale(0.96) → 1`, `--dur-base`, `--ease-spring`. Correct row or tile: `scale(1) → 1.03 → 1`, `--dur-base`. Points count up from 0 in 600 ms (rAF, writes an `aria-hidden` span; the real value is in visually hidden text from the start). | Final values shown at once | Three short animations, once per round. |
| E11 | **Podium rise** | Final screen | Pedestals `transform: scaleY(0) → 1`, origin bottom, 520 ms, `--ease-spring`, delays 0 / 180 / 360 ms for 3rd / 2nd / 1st; pedestal contents and names fade in (`opacity`, 200 ms) when their pedestal lands. | Podium shown complete | Three elements. |
| E12 | **Confetti** | Final screen, once, at 900 ms | `ConfettiLayer`: `position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: var(--z-confetti)`. 24 `<i>` pieces (14 when the shell is under 600 wide, 10 in Lite), each 8×14 px or 8×8 round, coloured from `--answer-a/b/c/d` and `--ink`, with per-piece variables from a fixed table (`--x` start 4–96 %, `--dx` drift ±12cqw, `--r` 180–900°, `--d` 0–400 ms, `--t` 1800–2400 ms). `@keyframes fall { from { transform: translate3d(0, -12%, 0) rotate(0); opacity: 1; } 85% { opacity: 1; } to { transform: translate3d(var(--dx), 105cqh, 0) rotate(var(--r)); opacity: 0; } }`. The layer is removed from the DOM after the last `animationend`. No canvas, no library. | Not rendered | At most 24 small composited layers for 2.4 s, on a screen with nothing else moving. |
| E13 | **Micro-transitions** | Pricing card lift and tilt (existing); dock slide; menu and sheet open; FAQ toggle (existing); theme switch (none, instant) | As specified in sections 5 and 6 | No transitions | Existing or trivial. |
| E14 | **Lobby life** | Player chip pop-in when someone joins (`scale(0.9) → 1`, `opacity`, 200 ms, `--ease-spring`); waiting dots for players (opacity pulse); the existing urgent-timer pulse | CSS keyframes | Chips appear; dots static; no pulse | One chip at a time. The dots are the only looping animation in the game besides the timer. |

Not included on purpose: parallax on scroll, animated gradient backgrounds, blur or glass panels, cursor trails, sound, leaderboard reordering animation.

### 10.2 Performance budget and rules

1. **Properties**: animate `transform` and `opacity` only (single exception: E6). Never animate `width`, `height`, `top`, `box-shadow`, `filter` or `background` colour on anything larger than a button.
2. **No blur while scrolling**: no `backdrop-filter` on phones or touch devices (header, dock and sheets are solid there); no `filter: blur()` anywhere. Large static shadows are allowed only on the hero frames, with the smaller shadow at phone widths.
3. **Concurrency**: after the first second, the home page has at most one continuously running animation (E3), and it stops off-screen. A live game has at most two (timer bar, and the urgent pulse or the lobby dots).
4. **`will-change`**: only on elements while they animate (set by the animation class, removed on `animationend`), never more than 24 at once (confetti).
5. **JavaScript**: the effects add three observers (`useReveal`, the dock, the hero loop) and one interval. No scroll or `touchmove` listeners. Target: under 4 KB gzipped of new effect code, no new dependency.
6. **Assets**: grain ≤ 8 KB; share image not loaded by the page; the display font file grows by about 37 KB (width axis).
7. **Lite mode**: `theme-init.js` sets `data-lite` on `<html>` when `navigator.deviceMemory <= 2` or `navigator.hardwareConcurrency <= 4`. Lite turns off E2, E3 (static frame), E4 tilt, E8, and reduces E12 to 10 pieces. Everything else is cheap enough to keep.
8. **Targets to verify** (section 2 S16, plus): no long task over 50 ms caused by effects on a 4× CPU-throttled profile; tap on an answer tile shows the chosen state within 100 ms; the fit hook completes in under 8 ms per run on the same profile; scrolling the home page on a throttled phone profile shows no dropped-frame warnings in the Performance panel.

---

## 11. Accessibility requirements

### 11.1 Focus and keyboard

- Focus ring: 3 px `--focus` (`#F5F0FF` on dark, 17:1 against the page), offset 2–3 px, on every interactive element. Answer tiles keep the dashed ring so focus is never confused with "chosen".
- Tab order follows the DOM, and the DOM follows the visual order. In the shell: top bar, body, dock. The pinned host button is last, after the content it acts on. In mode L, where the dock is drawn in the top row, it stays last in the DOM.
- The podium's DOM order is 1st, 2nd, 3rd; only the visual order changes.
- Screen changes move focus as today: the question heading on a new question; the outcome block (`h1`, `tabIndex={-1}`) on reveal; the headline on the final screen; `#main-start` on route changes.
- Sheets: native `<dialog>` with `showModal()`: focus trapped, `Escape` closes, focus returns to the opener. The mobile menu is a disclosure with `aria-expanded`, closes on `Escape`.
- The hero device stage is `aria-hidden` and `inert`; the dock is `inert` while hidden.
- All functionality works at 200 % browser zoom and at 320 CSS px width without two-dimensional scrolling (WCAG 1.4.10). In the game, zoom makes the shell see a smaller viewport and the layout re-fits; the "Full text" sheet is the reading route when text is clamped.
- Pinch zoom stays enabled (no `maximum-scale`, no `user-scalable=no`).

### 11.2 Contrast pairs to verify

Ratios computed from the token values (WCAG 2.x). Add the starred pairs to the token test in `App.test.jsx`.

| Foreground | Background | Ratio | Needed |
|---|---|---|---|
| `--ink` `#FAF7FF` | `--paper` `#100A1C` | 18.3 | 4.5 |
| `--ink-2` `#D9D1EB` | `--paper` | 13.2 | 4.5 |
| `--ink-3` `#A99FC4` | `--paper` / `--band` / `--surface` / `--surface-sunk` | 7.8 / 7.6 / 7.3 / 6.5 | 4.5 |
| `--accent-text` `#C9B8FF` | `--paper` / `--surface` / `--accent-soft` | 10.9 / 10.1 / 8.3 | 4.5 |
| `--brand-a` `#B79CFF`, `--brand-b` `#FF7AB6` (gradient headline) | `--paper` | 8.5, 8.1 | 3 (large) |
| `--accent-ink` `#FFFFFF` | `--accent` `#7C3AED` / `--accent-2` `#C026D3` | 5.7 / 4.71 | 4.5 |
| `--accent-ink` | hover ends `#6D28D9` / `#A21CAF` | 7.1 / 6.3 | 4.5 |
| `--answer-ink` `#140E22` | tiles A / B / C / D | 10.4 / 7.8 / 11.9 / 8.8 | 4.5 |
| `--answer-ink` | `--correct-ring` `#4ADE80` (tag) | 10.8 | 4.5 |
| ★ `--answer-ink` | `--podium-1/2/3` (= tiles C / D / B) | 11.9 / 8.8 / 7.8 | 4.5 |
| `--success` / `--danger` / `--warning` | `--paper` | 11.1 / 10.3 / 13.5 | 4.5 |
| `--success` on `--success-soft`; `--danger` on `--danger-soft` (outcome block) | | 8.8; 8.5 | 4.5 |
| ★ `--ink` on `--success-soft` / `--danger-soft` (points, rank); `--ink-2` on the same (the "You’re" label) | | 14.5 / 15.2; 10.4 / 10.9 | 4.5 |
| ★ `--disabled-ink` (`--ink-3`) | `--disabled-bg` (`--surface-sunk`) | 6.5 (light 6.0) | 4.5 |
| ★ `--ink-2` / `--ink` / `--brand-b` | worst glow overlap (`--glow-a` + `--glow-b` over `--paper`, about `#531B78`) | about 8.0 / 11 / 4.9 | 4.5 / 4.5 / 3 |
| ★ `--ink-2` / `--ink-3` | Free band gradient ends (`#2E1757`, `#300F3D`) | 10.4–11.3 / 6.1–6.7 | 4.5 |
| ★ `--line-strong` `#7A6FA3` (logo ring, input border) | `--paper` / `--surface` | 4.28 / 3.98 | 3 (non-text) |
| `--focus` `#F5F0FF` | `--paper` | 17+ | 3 |
| Light theme: `--ink-2`, `--ink-3`, `--accent-text` | light glow (`#ECE4FA`) | 9.3 / 5.6 / 5.8 | 4.5 |
| Light theme: `--brand-a`, `--brand-b` | light glow | 4.6 / 4.15 | 3 (large) |

Rules that keep these true: no `--ink-3` on glows; no text on the hero frames' gradient other than the real game UI; the sheen never lightens a button's fill; grain at 5 %.

### 11.3 Live regions and names

- Countdown: unchanged (progressbar role, announcements at 10 s, 5 s, 0).
- Answered count: the polite live element always holds the full sentence "{n} of {m} answered"; the compact "7/9" is `aria-hidden`.
- Progress: "3/10" is `aria-hidden`; the full "Question 3 of 10" is present as text for assistive tech.
- Status slot (dock): `role="status"`; in mode L it is visually hidden but still updated.
- Outcome block: its accessible text is one sentence built from existing strings, e.g. "Correct · +776 pts. You’re 1st." The counting animation is `aria-hidden`.
- Counts on reveal rows: accessible label "{n} players" / "1 player"; rows with 0 have no count for anyone.
- "+{n}" chip in the lobby: `aria-hidden`; the header button's name is "{n} players connected".
- Lobby players list keeps `aria-live="polite"`.
- Confetti, glows, grain, device frames, vignettes: `aria-hidden`.
- Seller line: plain text; the footer variant's link is a normal link named "Company details".
- Theme switch: a radio group with legend "Theme"; the pricing switch: a radio group with the hidden legend "Pricing".
- Menu button: name "Menu", `aria-expanded`, `aria-controls`.
- Big screen toggle: `aria-pressed`.
- Errors from the validation pattern use `Field`'s `role="alert"` and `aria-invalid`.

### 11.4 Tap targets

- Minimum 44×44 CSS px for every interactive element on touch layouts: buttons (`sm` is now 44), header links, the menu button, footer links, FAQ summaries (56), segmented options (46 → 48), the theme switch, idea chips, plan buttons, "Copy invite link", "Leave", "Full text", "Full standings", "Close", "Back to home".
- Answer tiles: ≥ 44 px in both dimensions at every viewport (criterion G3); the gap between tiles is ≥ 6 px.
- Reveal rows, leaderboard rows and podium columns are not interactive and may be smaller (≥ 26 px rows with ≥ 13 px text).

### 11.5 Motion, transparency, contrast preferences

- `prefers-reduced-motion: reduce`: the global rule stays; additionally the hero loop is static, scroll-reveal content is never hidden, and confetti is not rendered (not merely shortened). The live game timer still updates (it is information, not decoration); its bar changes without easing.
- `prefers-reduced-transparency: reduce`: header and dock solid (already the case on phones).
- `prefers-contrast: more`: glows and grain off; `--line` → `--line-strong`.
- `forced-colors: active`: gradient text falls back to `currentColor` (existing rule); tiles keep a 2 px border and the letter chip; the correct state keeps its text tag and icon.
- No state relies on colour alone: verdicts have icons and words, tiles have letters, the preferred plan differs by border and button style, timer urgency has the number.

---

## 12. Implementation plan

Seven groups. Each can be merged and tested on its own. Order matters only where stated. File paths are under `frontend/` unless noted.

### Group A. Foundations and the standalone quick wins (low risk, ship first)

| Step | Change | Files |
|---|---|---|
| A1 | Token additions (4.1–4.6) as CSS variables; switch the Bricolage import to `wdth.css`; type tokens; `sm` button to 44; disabled style; `Eyebrow` tracking | `src/styles/tokens.js`, `src/styles/GlobalStyle.js`, `src/components/ui.jsx` |
| A2 | Fixtures and a dev-only gallery route `/dev/stage` (registered only when `import.meta.env.DEV`) that renders each game state with each fixture and a role/phase/fixture picker. Every later game step is tested here against the matrix without running a live game. | new `src/components/game/fixtures.js`, new `src/pages/DevStagePage.jsx`, `src/App.jsx` |
| A3 | Share image and meta tags (section 7) | new `public/og/kazoot-og-v1.png`, `index.html`, `src/App.jsx` (`RouteEffects` canonical), new `design-review/og-template.html` |
| A4 | Logo ring; 44 px tap targets in header and footer | `src/components/SiteChrome.jsx` |
| A5 | Validation pattern instead of disabled buttons on demo, join and the session name form; `kazoot:last-name` | `src/pages/DemoPage.jsx`, `src/pages/JoinPage.jsx`, `src/pages/SessionPage.jsx`, `src/lib/storage.js` |
| A6 | Reveal: hide zero counts and all counts in solo rooms (works in the current layout too) | `src/components/game/AnswerGrid.jsx`, `src/components/game/RoundScreens.jsx` |
| A7 | `SellerLine`; footer company line | new `src/components/SellerLine.jsx`, `src/components/SiteChrome.jsx` |

Tests: extend the contrast test with the starred pairs; new unit test "seller line renders name and registry code from `LEGAL`, nothing when the name is empty, never the address" (mock `lib/legal`); update the join and demo tests for enabled buttons and the "Enter a name." error.

### Group B. Game shell and no-scroll states (highest risk, highest value; do before the home page because the hero reuses it)

| Step | Change | Files |
|---|---|---|
| B1 | `GameShell` (shell, frame, top, body, dock, modes), `data-game-shell`, hide site header/footer while mounted, toasts to the top, wake lock, `lang` on quiz text | new `src/components/game/GameShell.jsx`, `src/pages/SessionPage.jsx`, `src/App.jsx`, `src/components/SiteChrome.jsx` (`Toast`), `src/styles/GlobalStyle.js` |
| B2 | Tier helpers and the fit hook; `useRowsThatFit`, `useItemsThatFit` | `src/lib/gameUi.js`, new `src/lib/fitStage.js` |
| B3 | Question: countdown into the top bar (`scaleX` fill, cq sizes), `AnswerGrid` without its own container, tile badge, grid shape, status slot | `src/components/game/RoundScreens.jsx`, `src/components/game/AnswerGrid.jsx`, `src/components/game/Countdown.jsx` |
| B4 | `Sheet`; "Full text" | new `src/components/Sheet.jsx`, `src/components/game/RoundScreens.jsx`, `src/components/Icon.jsx` |
| B5 | Reveal: `OutcomeHero`, compact rows, rows-that-fit leaderboard, pinned host action | new `src/components/game/OutcomeHero.jsx`, `src/components/game/RoundScreens.jsx`, `src/components/game/AnswerGrid.jsx`, `src/components/game/Leaderboard.jsx` |
| B6 | Lobby: layouts per mode, scalable code and QR, chips that fit, review editor and players list in sheets | `src/components/game/Lobby.jsx` |
| B7 | Final: podium, standings sheet, actions panel with the role table, play-again sheet | `src/components/game/FinalScreen.jsx`, new `src/components/game/Podium.jsx` |
| B8 | Connection banner inside the top bar; solo chip | `src/components/game/ConnectionBanner.jsx`, `src/pages/SessionPage.jsx` |
| B9 | Big screen | `src/components/game/GameShell.jsx`, `src/components/game/Lobby.jsx`, `src/components/game/RoundScreens.jsx`, `src/components/Icon.jsx` |

B1–B5 can ship together as "question and reveal fit the screen" (this alone delivers quick win 2); B6–B7 next; B9 last.

Tests: unit tests for `questionTier`, `answerTier`, `formatRoomCodeInput`; component tests that the reveal shows no count for zero and none in solo rooms, that the host button exists in the dock, that the final actions follow the role table; the existing "answer buttons are keyboard-operable" and "reveal mode marks the correct answer" tests must keep passing (names and roles unchanged). Layout itself cannot be tested in jsdom: check the matrix by hand in `/dev/stage`, or add a Playwright script that loops viewports × fixtures and asserts G1–G4 (recommended, about 60 lines; Playwright is not in the repo today).

### Group C. Theme and site chrome

| Step | Change | Files |
|---|---|---|
| C1 | Dark default, `data-theme`, `theme-init.js`, `theme-color`, manifest, print rule | `src/styles/GlobalStyle.js`, new `public/theme-init.js`, `index.html`, `public/manifest.json`, new `src/lib/theme.js` |
| C2 | Footer theme switch | `src/components/SiteChrome.jsx`, `src/components/ui.jsx` (`SegmentedControl` `hideLegend`) |
| C3 | Mobile menu; phone header without backdrop filter | `src/components/SiteChrome.jsx`, `src/components/Icon.jsx` |

Tests: the contrast test already covers both palettes; add "default theme is dark without a stored preference" for `lib/theme.js`; a11y test for the header with the menu open. Update `README.md` and `LAUNCH.md` where they describe the light site theme.

### Group D. Home page

| Step | Change | Files |
|---|---|---|
| D1 | Hero text block, glows, remove the lockup | `src/pages/HomePage.jsx`; delete `src/components/BrandMark.jsx` if unused |
| D2 | Device stage with the preview shell and demo loop | new `src/components/home/DeviceStage.jsx`, new `src/lib/useDemoLoop.js`, `src/components/game/GameShell.jsx` (preview mode) |
| D3 | Step cards with vignettes | new `src/components/home/StepVignettes.jsx`, `src/pages/CreatePage.jsx` (export `EXAMPLES`) |
| D4 | Organiser band, the three surfaced answers, FAQ split, Good to know moved, finale | `src/pages/HomePage.jsx` |
| D5 | Mobile dock | new `src/components/home/MobileDock.jsx`, `src/pages/HomePage.jsx`, `src/components/SiteChrome.jsx` (footer padding) |

Tests: the landing tests keep their assertions on the H1 text, the two calls to action, "AI can be wrong" and the forbidden-claims list (which includes "testimonial"); `getAllByRole('link', { name: 'Try a free demo' })` now also finds the dock link. The axe test for the landing page must pass with the stage `inert`.

### Group E. Pricing and seller identity at the point of purchase

| Step | Change | Files |
|---|---|---|
| E1 | Switch, centred card row, per-game pill, preferred card, compact rows | `src/components/Pricing.jsx` |
| E2 | `PayLine` with the seller line; trim `PricingExplainer` | `src/components/Pricing.jsx` |
| E3 | Account: purchase area, Billing card, consent dialog, signed-out card | `src/pages/AccountPage.jsx` |
| E4 | `/pricing` page | `src/pages/LegalPages.jsx` |

Tests to change: "landing page leads with …" expects "Subscribe to Plus" and "Buy Pack 20" at the same time. With the switch, assert "Buy Pack 20" first, then select the "Monthly plans" radio and assert "Subscribe to Plus". The `article` text assertion for Plus ("€5/ month30 AI games every month") must be re-checked against the new card order. `PricingExplainer` text assertions, if any, move to the pay line.

### Group F. Forms and reading pages

| Step | Change | Files |
|---|---|---|
| F1 | Demo: quiz picker, two panels, one-tap solo | `src/pages/DemoPage.jsx` |
| F2 | Join: `RoomCodeInput`, paste handling, auto-advance | new `src/components/RoomCodeInput.jsx`, `src/pages/JoinPage.jsx`, `src/lib/gameUi.js` |
| F3 | Create: topic before sign-in, draft through the OAuth round trip, validation pattern | `src/pages/CreatePage.jsx` |
| F4 | Legal shell width, table on phones, print | `src/pages/LegalPages.jsx` |

Tests to change: `CreatePage.test.jsx` gains a signed-out case (topic field and six chips visible, "Continue with Google" stores the draft and calls `signIn`); the existing "no AI games left → disabled button" case still holds. `App.test.jsx` join tests: codes typed with spaces or dashes and a pasted invite link.

### Group G. Effects pass

| Step | Change | Files |
|---|---|---|
| G1 | Scroll-reveal, sheen, sweep, grain, tilt on the phone frame, Lite flag | new `src/lib/useReveal.js`, `src/components/ui.jsx`, `src/pages/HomePage.jsx`, new `public/brand/grain-128.png`, `public/theme-init.js` |
| G2 | Game: tile settle-in, reveal moment, podium rise, confetti, lobby chips and dots | `src/components/game/AnswerGrid.jsx`, `OutcomeHero.jsx`, `Podium.jsx`, new `src/components/game/Confetti.jsx`, `Lobby.jsx` |
| G3 | Performance and reduced-motion audit against 10.2 and section 2 | — |

### Risks

| # | Risk | Where | Mitigation |
|---|---|---|---|
| R1 | Fixed full-viewport shell on mobile browsers: bar show/hide, rotation, iOS safe areas, keyboards | B1 | `position: fixed; inset: 0` rather than `100vh`; test on a real iPhone (Safari) and a real Android (Chrome, Samsung Internet) before merging; the name form stays outside the shell. |
| R2 | Container size queries and `cqh`/`cqw` need Safari 16+, Chrome 105+, Firefox 110+ | B1 | `@supports` fallback to the current scrolling layout (G10). |
| R3 | The real game UI inside hero miniatures (floors, tiny containers, two shells on a page) | D2 | `--floor: 0.55` in preview; if it stays fragile, use static markup with only the timer animated. Decide after B3 exists. |
| R4 | The fit hook: a flash of unfitted text, loops with `ResizeObserver`, cost on slow phones | B2 | `useLayoutEffect`, measure-then-write once, ignore resize callbacks caused by its own writes (compare the shell size), 5-step searches. |
| R5 | Uppercasing and regrouping a controlled input on Android keyboards (duplicated characters, jumping caret) | F2 | CSS `text-transform` for display, no rewriting during composition, caret restore; test with Gboard and Samsung Keyboard. |
| R6 | The topic draft across the Google redirect | F3 | `sessionStorage`; the existing test "oauth redirect returns to the page the user started from" covers the return path; add the draft case. |
| R7 | Theme default flips for existing visitors; a flash on first paint | C1 | Blocking same-origin script (CSP allows `'self'`); dark tokens are the CSS default, so there is no flash for the default case. |
| R8 | Pricing switch hides one group: tests, deep links (`?buy=`), and anyone used to seeing both | E1 | Start on the group of the `buy` plan; keep both groups reachable in one tap; update tests as listed. |
| R9 | Fullscreen API differences (no fullscreen on iPhone Safari; exit by `Escape`) | B9 | Big screen works without fullscreen; listen to `fullscreenchange`. |
| R10 | The wider display font file (+37 KB) on slow connections | A1 | `font-display: swap` is already set; preload nothing new; check LCP stays text. |

---

## 13. New UI strings (complete list, for the owner's review)

These ten are the only strings in this brief that do not already exist in the codebase.

| # | String | Where | Kind | Why it is needed |
|---|---|---|---|---|
| 1 | Menu | Phone header, menu button | accessible name (icon button) | Names the button that replaces the hidden "How it works" / "Pricing" links |
| 2 | Close | Close button of every sheet (Full text, Full standings, players, review, play again) | visible label ≥ 400 px, accessible name below | Sheets need a named way out besides `Escape` |
| 3 | Theme | Footer, legend of the theme switch | visible legend | Labels the choice |
| 4 | Dark | Footer, theme switch option | visible | |
| 5 | Light | Footer, theme switch option | visible | |
| 6 | Sold by | Pay line under plan cards; consent dialog; "Sign in to buy" view; Billing card | visible label before the company name | Tells buyers who takes the payment |
| 7 | Operated by | Footer company line | visible label before the company name | A clearer company line than a bare name |
| 8 | Player | Default scoreboard name for a one-tap solo demo when no name is known | visible (as a player name) | One-tap start cannot ask for a name |
| 9 | Full text | Game top bar, only when question or answers are clamped | visible button | The route to the complete text (last resort) |
| 10 | Big screen | Game top bar, host only, ≥ 700 px wide | visible toggle | Turns on the projector layout |

Reused from the server's validation messages, now also shown by the client before submitting (same wording, so not new to users): "Enter a name." and "Topic must be at least 2 characters."

Existing strings used in a new role (wording unchanged):

| String | Was | Becomes |
|---|---|---|
| Game packs / Monthly plans, with "Pay once" / "For regular hosts" | group headings and leads | options of the pricing switch |
| Pricing | section title | also the hidden legend of the switch |
| Payments are handled by Stripe. / Prices include any VAT that applies. | part of the explainer paragraph | the pay line under the buttons |
| Company details | heading on the contact page | also the footer link to `/contact` |
| Full standings | eyebrow | button that opens the full list |
| Review mode | eyebrow | lobby button and sheet title |
| Play another / Play again with this group | eyebrow | button that opens the play-again sheet |
| Solo preview | part of the solo notice | chip in the game top bar |
| You’re {ordinal} | one line of text | split visually into a small "You’re" and a large ordinal; read as one sentence |
| Correct · +{points} | chip | split visually into "Correct" and a large "+{points}" |
| "{n} AI games a month with a Google account", "Demo quizzes any time, no account", "Players never pay or sign up" | Free plan ticks | also the benefits list on the signed-out account page |
| "Google account email, name and profile picture (hosts who sign in)" and "Your account, AI game balance and purchases" | privacy table cells | also the data note on the signed-out account page |
| The three FAQ questions and answers on schools, accuracy and big screens | accordion items | visible cards (removed from the accordion) |

Non-word UI text (no review needed, listed for completeness): "3/10", "7/9", "+12" (compact counts with full-sentence accessible names), and the ordinal and points formats that `ordinal()` and `formatPoints()` already produce.

Strings no longer shown: the legend "How do you want to play?" on `/demo` (replaced by the two panels); in-game, the sentence "— just you, no other players. Invite people any time by hosting the demo for a group." (the chip "Solo preview" remains; the demo page already explains solo play).

---

## 14. Owner decisions to confirm, and what was not verified

### Decisions made here that the owner may want to overrule

1. **Preferred plans**: Pack 60 and Plus (`PREFERRED_PLAN` in `Pricing.jsx`). No label is attached to them.
2. **Default pricing tab**: "Game packs".
3. **Light theme kept as an option.** If the owner prefers dark-only, drop step C2 and the light rows of 4.1 and 5.7; nothing else depends on it.
4. **Big screen hides the host's own pick and personal outcome** on the shared screen.
5. **Solo demo default name** "Player".
6. **Payment marks**: none until the owner confirms which card brands and wallets are enabled in Stripe.
7. **"Good to know" moved** next to the FAQ, and the three surfaced answers placed in the organiser band.
8. **Stripe Checkout and billing portal branding** (colours, logo, and the business name shown there) are set in the Stripe dashboard, outside this codebase. Worth matching to the stage palette and making sure the name shown is the company's, since the seller line now promises it.

### Possible follow-ups outside this brief

- A true second-screen display (TV shows the game, host plays on a phone) needs a spectator seat on the backend.
- Rank movement on the reveal ("up two places") needs the previous rank; it can be kept client-side later.
- Estonian site language.

### Not checked or not verifiable from here

- Nothing was run on a real phone, tablet, TV or projector. Viewport behaviour (browser bars, safe areas, keyboards) is specified from platform knowledge, not observed. The "with bars" viewport heights in 2.2 are my estimates.
- The sizing formulas were checked by arithmetic at the listed viewports, not by rendering. Character-per-line figures assume average glyph widths for the two fonts; treat the worked checks in 8.4 and 8.8 as expectations to confirm in `/dev/stage`.
- Signed-in screens (`/create` form, `/account` with a balance, the consent dialog, checkout) were read in the source only.
- Multi-player states (host lobby with invite panel, waiting after "Locked in", host away, other players' reveal) were read in the source only. The live check covered the solo demo's question and reveal at 360×640.
- The light theme with the new layout, the share image in real chat apps, and all performance targets are untested; the numbers in 10.2 and S16 are targets.
- Which payment methods Stripe offers at checkout.
- Whether `LEGAL.vatNumber` is set in production (it is not shown by the new seller line either way).
- The installed font package has the width-axis file (`wdth.css`, verified in `node_modules`); its rendering at 82–90 % width was not viewed.
