# Kazoot — design and marketability review

Reviewed 24 Nov 2026 on the live site (www.kazoot.app), signed out, at 1280×800 and 375×812, light and dark. Pages opened: `/`, `/pricing`, `/demo` (solo preview played through all 10 questions to the final screen), `/join`, `/account`, `/terms`. Design tokens and components read from `frontend/src`. No copy is proposed anywhere in this document; where content is missing I name the kind of content, not the words.

What I could not check is listed at the end.

---

## 1. Review, biggest impact first

### 1.1 The five-second impression is clear, but the picture undersells "live, in a room, together"

**Works.** The home hero is the strongest thing on the site. The headline is short, the gradient on the last line lands on the actual differentiator, the two buttons are clearly ranked, and the two green check lines answer the two obvious objections. The preview is the real `AnswerGrid` component, which is honest and keeps it in sync with the product.

**Problems.**
- The only image on the whole home page is one player's question card. Nothing shows a group: no host screen, no second phone, no room code or QR, no leaderboard, no people. A visitor reads "quiz app", not "live game for a room". This is the single biggest gap between what the copy promises and what the page shows.
- The preview is frozen (timer stuck at 13, bar static). A product whose selling point is "live" has no motion in its hero.
- The hero lockup (logo tile + "Kazoot" + "Live quiz game for groups") repeats the header logo 100 px below it. On a phone it takes about 100 px above the headline for no new information. Keep the category line as a small eyebrow; drop the second logo.
- Below the hero the page is text only. Three numbered squares, a text split, a pricing grid, an accordion. There is no second visual moment anywhere in 4,100 px of desktop scroll (6,100 px on a phone).

### 1.2 The conversion path leaks at three specific points

**Home → demo.** The primary button is right. But `/demo` then asks for three decisions before anything happens (mode, quiz, name), with "With others" preselected. For a page whose promise is a two-minute try, the solo path should be one tap with a default quiz, and the name asked only for the group mode or prefilled. The "Start solo preview" button sits disabled at 50% opacity (white text at roughly 2.2:1 on the faded gradient) with nothing saying why; it reads as a broken primary button rather than "type a name first".

**Demo → sign in.** This is the money moment and it is the weakest screen. After the last question the final screen shows, in order: a flat "Quiz complete" heading, a single podium box, standings, a "Play another" card whose button is the only primary on the screen, and only then, third card down and about 1,100 px deep on a phone, the "Create a quiz on your own topic" card with a secondary (outlined) button. A signed-out demo player's main action should be that card, first and primary; "Start next game" should be the quiet one. There is also no celebration at all (no motion, no colour, nothing shareable) at the one point where the player feels something.

**Create a quiz → sign-in wall.** `/create` signed out shows only a sign-in card. The visitor has not typed anything yet, so nothing is lost by leaving. Showing the topic field and the idea chips first and asking for Google sign-in on submit would let people invest before the wall. `/account` signed out is a heading and two buttons on an empty page; it says nothing about what an account gives or what Google data is used.

**Pricing.** Six offers (Free, three packs, two plans) are shown at equal weight with identical tonal buttons and no recommended option. Pack 20 and Plus both cost €5, Pack 60 and Pro both €12, so the eye cannot tell them apart; the only cue is a 3 px gradient line on the monthly cards. The per-game price, which is the actual comparison metric, is the smallest and greyest text in each card. On a phone the section is five stacked cards plus the free block, roughly 1,800 px. Suggested: one switch between one-time and monthly, one visually preferred option per group, per-game price promoted, compact rows on phones, and payment-method marks next to the buttons.

### 1.3 Game screens: the question screen is good; reveal, final and big-screen need work

**Works.** The question screen is the best-designed screen in the product: large question, clear timer with number plus bar, four tiles with letter chips, bright fills with dark text, and states that differ by shape and label, not only colour. The answer palette (cyan, pink, amber, periwinkle) is distinctive and avoids red/green. The chrome is minimal in-game.

**Problems, phone first.**
- **Reveal on a phone pushes the host's "Next question" button below the fold** (about y=1,000 on an 812 px screen) under four tiles and the leaderboard. The host scrolls every round, ten times a game. Pin that action to the bottom of the screen.
- **The player's own result is the smallest thing on the reveal screen.** "You're 1st" is small grey text in the top line and the points chip is a small pill. Rank and points gained should be the hero of this screen.
- **Top chrome eats a third of the phone.** Header bar, the solo banner (three lines), progress line and "answered" line put the question at y≈280. With a two-line question it just fits on an 812 px phone; on a 667 px phone or with a long question or long answers the fourth tile drops below the fold while the clock runs. Compress the top (one status line, dismissible one-line banner) and let short answers use a 2×2 grid.
- **Every wrong option shows "0 players · 0%" with an empty bar.** In small groups this is four rows of noise. Show the count only where it is non-zero, or as one compact distribution.
- **Desktop and projector.** At 1280×800 the question screen uses the top half of the screen; tiles are about 110 px tall inside the 1120 px site container and the lower half is empty. For a room reading from a TV the question (max 3rem) and tiles are too small. A host display mode should fill the viewport and scale by viewport height, and keep the room code on screen for latecomers (the lobby copy says people can still join after the start, but the code disappears).
- **Final screen.** With one player the podium is a single box, a third of the width, left-aligned in a three-column grid, which looks broken on desktop. Headline, podium and standings repeat the same name and score three times. No motion, no colour from the tile palette, nothing to share.
- **Join.** The room code is 10 characters ("ABCDE 23456") typed into a plain text field. That is long for a phone keyboard. The QR code and invite link cover most cases; for the typed case the field should be large, letter-spaced, auto-grouped 5+5, uppercase, and paste-tolerant. The lobby code (max 3.2rem) and QR (180 px) are sized for a laptop, not a projector.

### 1.4 Visual identity: good parts, generic assembly

**Works.** Bricolage Grotesque for display with Atkinson Hyperlegible for body is a distinctive, defensible pairing (and a real accessibility story for schools). One gradient, reserved for the main action. Sensible radii and shadows. The aubergine "stage" theme with the tile colours has real character.

**Problems.**
- The light site theme is pale lavender paper, slightly darker lavender bands, white cards, violet buttons. It is tidy and it looks like many SaaS templates. All the personality is in the dark stage, which appears twice on the home page (hero card, closing panel). The tile colours, the most ownable asset, appear only inside the preview.
- Type scale collapses after the hero: h1 up to 4.1rem, every h2 at 1.4–2rem, all the same weight. Sections have no rhythm; "The organiser doesn't have to sit out", the core idea, is set at the same size as "Questions".
- The "Good to know" card is the highest-contrast element between hero and pricing, and it leads with "AI can be wrong". The honesty is a strength; the placement makes the limitations louder than the benefits. Keep the content, make it quieter or move it beside the FAQ.
- Atkinson's slashed zero shows in every price and count ("€0.20", "150", "10-question"). In body text it helps legibility; in price cards it reads like code. Set numerals in pricing in the display face.
- Page widths are inconsistent: `/demo`, `/join` are a centred 680 px column; `/terms` is left-aligned in the wide container; `/account` is a centred column with almost nothing in it.

### 1.5 Mobile

**Works.** No horizontal scroll at 375 px on any page checked. Buttons go full width, tap targets are 48–56 px, the header collapses to "Join a game" and "Sign in", answer tiles are comfortable.

**Problems.** Page length (6,100 px, a third of it pricing). No persistent action once the hero scrolls away. "How it works" and "Pricing" disappear from the header with no replacement (pricing is only reachable by scrolling or the footer). Footer links are small bold underlined text with roughly 24 px line boxes and wrap into two tight rows; the header "Join a game" link is about 40 px tall. Both are under the 44 px comfortable target.

### 1.6 Dark mode

Supported automatically through `prefers-color-scheme`, and consistent across home and pricing. Two visible issues: the logo tile is near-black aubergine on a near-black aubergine page, so the header icon and hero mark lose their shape (needs a hairline or glow in dark, or a lighter tile); and the hero preview and closing panel use the same colours as the page, so they stop reading as "the game screen" and become outlined boxes.

### 1.7 Accessibility (what is visible)

**Works, and better than most products this size.** Text pairs are tested for AA in the codebase and the ones I spot-checked hold (eyebrow grey on paper 6.4:1, gradient ends 5.3:1 and 4.8:1 at display size, tile text 7.8:1 or better). Visible focus rings, dashed on tiles so focus is not confused with "chosen". Reduced-motion handled. States never rely on colour alone. Skip link present. Live regions for timer and answer count.

**Issues.**
- Disabled primary button at 50% opacity (about 2.2:1) with no explanation, on `/demo` and `/join`.
- Tap targets under 44 px: footer links, header "Join a game".
- Reveal: the key outcome is small and low in the visual order (also a cognitive-load issue).
- Timer urgency is colour plus a pulse; the number is always there, so this is acceptable, but on a projector the 12 px bar is thin.
- The site UI is English only (`lang="en"`), while quizzes can be Estonian and the company is Estonian. There is no language switch.

### 1.8 Trust and marketability: what is there, what is missing

**There.** Legal entity and registry code in the footer, support email, Stripe named, terms/privacy/refunds, clear "players never pay or sign up", and unusually honest limits. All good.

**Missing (kind of content, not wording).**
1. **Social proof of any kind.** Quotes from real hosts, a count of games played, named schools or teams, a rating. Even two real quotes would change the page.
2. **Proof it works in a room.** A 15–30 second clip or photo sequence of a real group playing: host screen, phones, reactions.
3. **Audience entry points.** The footer says friends, classes and teams; the home page speaks to one generic host. Teachers and team leads need their own short block (review mode, nickname-only players, big screen) above the fold of their attention; the answers already exist in the FAQ but are hidden in an accordion.
4. **A share image.** `og:image` is the square favicon with a relative URL. Hosts invite people by pasting a link in a chat; that link currently previews as a tiny icon or nothing. A 1200×630 image with an absolute URL is the cheapest marketing fix on this list.
5. **Who is behind it.** A short founder or "made in Estonia" note with a face or name; an about page.
6. **Payment reassurance at the point of purchase.** Card and wallet marks, "handled by Stripe" next to the buttons, not only in a footnote.
7. **Schools reassurance.** A compact privacy block (what a player gives: a nickname; where data is processed).
8. **Example topics.** The six idea chips exist on `/create` behind sign-in; the home page describes topics only in a sentence.
9. **Estonian-language site** for the home market.

### Quick wins, in order

1. Final screen after a demo: make the "Create a quiz" card first and primary; add a celebration moment.
2. Pin "Next question" to the bottom on phones; enlarge rank and points on reveal.
3. Real share image (`og:image`, absolute URL, 1200×630).
4. One-tap solo demo; explain or remove the disabled-button state.
5. Hero: remove the duplicate logo lockup, show host screen plus phone, animate the timer.
6. Pricing: one switch, one preferred option per group, per-game price promoted, compact phone rows.
7. Dark mode: outline on the logo tile.
8. Surface the three school/work FAQ answers as visible content.

---

## 2. Three redesign directions

Each keeps the product, the logo and the existing copy. They differ in mood, layout model and who they speak to first.

### Direction 1 — "Stage Lights"

**Idea.** The game's dark stage becomes the whole brand. The marketing site looks like the product at showtime: aubergine background, spotlight glows, the four tile colours as the accent system, and a hero that shows the host screen and a phone together.

**Best for.** Party and friends hosts, pub and event nights; also the cheapest route to a stronger identity.

**Key visual decisions.**
- Type: keep Bricolage Grotesque, but use its width axis (about 82–88%) and weight 800 for large condensed headlines; keep Atkinson Hyperlegible for body.
- Palette: background `#100A1C`, band `#150E23`, surface `#1A1229`, sunk `#251B3A`, line `#34294D`; text `#FAF7FF` / `#D9D1EB` / `#A99FC4`; action gradient `#7C3AED → #C026D3`; headline accent `#B79CFF → #FF7AB6`; tiles `#22D3EE`, `#FF7AB6`, `#FFC53D`, `#8FB0FF` with ink `#140E22`.
- Layout: centred hero, then a "stage" composition (host screen with a phone overlapping it). Step cards each carry a small piece of real UI (topic field with idea chips, room code with QR, leaderboard). Big second-level headlines. Pricing and FAQ unchanged in structure but on the stage palette. Phone: a bottom dock with "Join a game" and "Try a free demo".
- Imagery: no illustration; only real UI, shown at two device sizes, with radial glows.
- Motion: live countdown in the hero, tiles settling in, a one-time spotlight sweep; everything off under reduced motion.

**Home page changes.** Site is dark by default (light mode becomes the alternate). Duplicate logo lockup removed. Hero shows two devices. "Good to know" becomes a quiet four-cell strip. A placeholder slot for social proof sits under the organiser section.

**Game screen changes.** Almost none in colour, which is the point: site and game finally match. Add the host display mode (fills the viewport, code stays visible), sticky host action on phones, a large rank-and-points moment on reveal, and a final screen with tile-colour confetti and a real podium.

**Effort.** Small to medium. The tokens already exist as `STAGE_COLORS`; most work is the hero composition, step visuals and the game-screen fixes.

**Risks.** Dark sites read as "evening entertainment"; some teachers and workplace buyers may find it less serious. Long dark pages tire the eye, so body sizes and contrast must stay generous. Light-mode users lose their default unless a toggle is added.

Mockup: `direction-1.html`

### Direction 2 — "Clear Paper"

**Idea.** A calm, editorial, light site that sells trust and clarity: warm paper, a serif display face, thin rules, one deep violet, a yellow marker highlight. The demo picker moves into the hero so the first screen is already the first step of trying it.

**Best for.** Teachers and people running work sessions; anyone who has to justify the tool to someone else. Best fit for subscriptions.

**Key visual decisions.**
- Type: Fraunces (600, optical sizing; italic for the emphasised line) with Atkinson Hyperlegible for body and UI.
- Palette: paper `#FBF8F2`, surface `#FFFFFF`, sunk `#F3EEE4`, line `#E5DED0`; ink `#1B1730` / `#4A4560` / `#6A6480`; accent `#5B2BD9` (7.1:1 on paper); accent soft `#EEE8FF`; marker `#FFD666`; success `#166B3F`. The game stage and tile colours stay as they are and appear as a dark inset.
- Layout: full-width serif headline; under it two columns, pitch on the left and a working demo picker on the right. "How it works" is a ruled numbered list beside the real question screen. The organiser section carries a highlighted callout for teaching and work use, with "Good to know" as a ruled list beside it. Three FAQ answers (schools, accuracy, big screen) are lifted out of the accordion into visible cards. Pricing becomes rows you can compare down a column, with the explanation beside it.
- Imagery: none beyond the real UI; thin-line diagrams would suit it later.
- Motion: minimal. Fades and the live timer only.

**Home page changes.** Header gains a solid "Try a free demo" button. Demo picker in the hero removes one page from the funnel. Company identity gets more weight in the footer. Placeholder row for names or logos of real schools and teams.

**Game screen changes.** The stage stays dark (it works), but setup, lobby, review mode and results chrome adopt the paper look. Review mode becomes a first-class, well-designed editor since this audience uses it. Host display mode and the reveal fixes as in Direction 1.

**Effort.** Medium. New light token set, one new font, new hero, pricing rows, three surfaced answers. No structural change to the app.

**Risks.** Can feel too quiet for party use; the serif moves the brand away from "game". Light site and dark game are two looks to maintain (already true today). The hero is busier with a picker in it and needs care on phones.

Mockup: `direction-2.html`

### Direction 3 — "Tile Arcade"

**Idea.** The answer tile becomes the design system. The home page is a bento grid of chunky, outlined, hard-shadowed tiles in the four answer colours on cream, each tile doing one job. Joining and starting a topic are both on the first screen, so the page works for players arriving mid-game as well as for hosts.

**Best for.** Phone-first visitors, younger groups, classrooms, and anyone who lands on the home page with a code in hand. Most distinctive and most shareable of the three.

**Key visual decisions.**
- Type: Archivo at weight 900 and 106–112% width for headings and prices; DM Sans for body and UI.
- Palette: cream `#FFF7E8`, white `#FFFFFF`, ink `#140E22` (also the 2.5 px outline and the hard shadow), violet `#7C3AED`, violet soft `#EFE7FF`, tiles `#22D3EE`, `#FF7AB6`, `#FFC53D`, `#8FB0FF`. Ink on every tile colour is 7.8:1 or better.
- Layout: 12-column bento. Row one: pitch tile plus a cyan "Join a game" tile with the code field. Then three step tiles with giant numerals; the real question screen beside a "what should the quiz be about" tile with the topic field and idea chips; organiser tile beside "Good to know"; pricing as tiles; FAQ and closing tile. On phones every tile is full width and the order is pitch, join, steps.
- Imagery: none needed; the tiles are the illustration. Stickers (pill labels) for short facts.
- Motion: tiles press down into their shadow on tap, numerals count in, chips wobble on hover; confetti in tile colours on the final screen.

**Home page changes.** Join form on the home page. Topic field and idea chips on the home page (type first, sign in on submit). Reassurance lines become stickers. Pricing head is a violet tile.

**Game screen changes.** Largest of the three: lobby, reveal and final adopt the outlined-tile look; the question screen keeps bright tiles but gains outlines and the press effect; the leaderboard becomes stacked tiles that reorder with motion; final screen is a proper podium of three tiles.

**Effort.** Medium to large. New fonts, new component styling across site and game, a bento layout that needs careful breakpoints.

**Risks.** Closest in spirit to the well-known classroom quiz products, so it must stay clearly its own (the palette helps). Can read as childish to workplace buyers. Heavy outlines and hard shadows are a current trend and may date. Dense colour needs discipline or it becomes noisy.

Mockup: `direction-3.html`

### Choosing

If only one thing is done: Direction 1, because it reuses what exists and fixes the gap between site and game. If subscriptions from teachers and teams are the goal: Direction 2. If growth through phones and sharing is the goal and there is time to restyle the game: Direction 3. The game-screen fixes in section 1.3 and the quick wins apply under any of them.

---

## Notes on the mockups

- Single files, inline CSS, no scripts; Google Fonts only. Checked at 320, 375, 414, 768, 1024 and 1280 px wide with no horizontal overflow.
- All visible copy is taken verbatim from the live site: home page, `/demo` (picker), `/join` (form labels), `/create` (title, topic label, hint, idea chips) and game screens ("Locked in", "Invite players", "Leaderboard").
- The logo is a CSS stand-in (a "K" on an aubergine tile), not the real mark.
- Each mockup contains one dashed box labelled "placeholder". That label is a design annotation marking where social proof would go; it is not proposed site copy.
- The FAQ in Direction 2 shows five items in the accordion because three are surfaced as cards above it.

## Not opened or not verified

- Anything signed in: the `/create` form, `/account` with a balance, checkout and billing (by instruction).
- The host lobby with room code and QR, and any multi-player state (waiting after "Locked in", other players' views, host-away notices). I played solo only; lobby observations come from `Lobby.jsx`.
- Timer "soon" and "urgent" states were read from `Countdown.jsx`, not watched.
- `/privacy`, `/refunds`, `/contact` were not opened.
- Phone-width screenshots of `/join` and `/demo` did not return an image (the browser pane was hidden and several captures failed); both were seen at desktop width and read as text. Dark mode was checked on the home page only.
- Sound, real-device behaviour and tablet widths on the live site were not assessed.
