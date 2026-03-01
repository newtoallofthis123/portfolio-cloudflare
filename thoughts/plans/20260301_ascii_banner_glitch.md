# ASCII Banner Glitch Animation — Implementation Plan

## Overview

Replace the static ASCII art banner on the homepage with a dynamic, animated banner that:
1. Renders "Ishan Joshi" in ASCII art (via figlet) on page load
2. After a delay, glitches out with random character scramble
3. Resolves into a random text from a configurable array (hardcoded to `["Happy Holi"]` for now)
4. Uses color gradient for visual pop

**Why this approach**: Generate ASCII art server-side with figlet (zero client font payload), animate client-side with direct `textContent` mutation on a `<pre>` element (ascii-morph style). This matches the codebase pattern of minimal client JS — the existing site uses inline scripts for the theme toggle and avoids heavy client bundles.

## Current State Analysis

- **ASCII banner**: Static `<pre>` with hand-crafted ASCII art spelling "Ishan Joshi" at `src/pages/index.astro:22-31`
- **Banner container**: `<div id="banner">` wrapping a `<pre>` with responsive text sizing (`text-mx sm:text-base`)
- **Manual `<span>` tags** inside the `<pre>` for selective styling — these will be removed
- **No figlet dependency** in `package.json`
- **Client scripts pattern**: `is:inline` scripts in `base.astro:138-159` for theme toggle; no per-page scripts currently
- **Fonts available**: JetBrains Mono (monospace), Geist Mono — both suitable for ASCII art
- **Color system**: Catppuccin/rosePine tokens via Tailwind, CSS variables in `global.css:46-100`

## Desired End State

The homepage banner:
- Shows "Ishan Joshi" in a figlet font on load
- After ~2 seconds, characters scramble randomly (glitch effect, ~500ms)
- Scramble resolves into "Happy Holi" (or random pick from array) in the same figlet font
- Text has a color gradient (CSS `background-clip: text` on the `<pre>`)
- Works in both light and dark mode
- Degrades gracefully with JS disabled (shows static "Ishan Joshi" ASCII art)

**Verify completion**: Visit homepage, observe the animation sequence, toggle dark mode, disable JS and confirm static fallback.

## What We're NOT Doing

- No interactive hover effects on the ASCII art (future enhancement)
- No multiple figlet font randomization (future enhancement — keep one font for now)
- No client-side figlet — all ASCII art generated at build/request time
- No React component — vanilla script is simpler and lighter here
- No animation loop — glitch happens once per page load

## Implementation Approach

**Server-side**: Astro SSR generates ASCII art strings for "Ishan Joshi" and each text in the array using figlet. These are serialized into a `<script>` tag as JSON data.

**Client-side**: A small inline script reads the pre-rendered ASCII art data, runs the glitch/morph animation by mutating the `<pre>` element's `innerHTML` (for color) or `textContent` (for the scramble phase).

**Color gradient**: Applied via CSS on the `<pre>` using `background: linear-gradient(...)` + `-webkit-background-clip: text` + `color: transparent`. During the scramble phase, the gradient stays — characters change underneath it.

## Phase 1: Install figlet and generate ASCII art server-side

### Overview
Add figlet as a dependency and generate ASCII art in the `index.astro` frontmatter.

### Changes Required

#### 1. Install figlet (`package.json`) — Modify
```bash
npm install figlet
npm install -D @types/figlet
```

#### 2. File: `src/pages/index.astro` — Modify (frontmatter, lines 1-16)
**Purpose**: Generate ASCII art strings server-side for "Ishan Joshi" and all texts in the cycle array.

**Changes**: Add figlet import and generation logic in the frontmatter block.

```typescript
// Add to frontmatter (after existing imports)
import figlet from "figlet";
import standardFont from "figlet/fonts/Standard";

figlet.parseFont("Standard", standardFont);

const bannerTexts = ["Ishan Joshi", "Happy Holi"];
const asciiArts: string[] = bannerTexts.map((text) =>
  figlet.textSync(text, { font: "Standard" })
);
// asciiArts[0] = "Ishan Joshi" ASCII art (shown first)
// asciiArts[1..n] = cycle targets
```

**Note**: Try a few figlet fonts (Standard, Slant, Small) during implementation and pick the one that looks best at the current `text-mx sm:text-base` sizing. Standard is the safe default.

### Success Criteria
- [ ] Automated: `npm run build` passes with figlet installed
- [ ] Manual: Console log `asciiArts` in dev, confirm valid ASCII art strings for both texts

---

## Phase 2: Replace static banner with server-rendered ASCII art + client data

### Overview
Replace the hand-crafted `<pre>` content with the figlet-generated "Ishan Joshi" art, and embed the full ASCII art array as JSON for the client script.

### Changes Required

#### 1. File: `src/pages/index.astro` — Modify (lines 22-31)
**Purpose**: Render initial ASCII art and pass data to client.

**Replace** the existing `<div id="banner">...<pre>...</pre></div>` block with:

```astro
<div id="banner" class="my-2">
  <pre
    id="ascii-art"
    class="text-mx sm:text-base font-mono leading-tight"
    set:html={asciiArts[0]}
  />
</div>
<script
  id="ascii-data"
  type="application/json"
  set:html={JSON.stringify(asciiArts)}
/>
```

**Key decisions**:
- `set:html` renders the pre-generated ASCII art as the initial content (SSR)
- ASCII art array is embedded as a JSON `<script>` tag (not executable, just data)
- Removed manual `<span>` tags from the old banner — no longer needed
- `leading-tight` ensures ASCII art lines don't have excessive spacing

### Success Criteria
- [ ] Manual: Homepage shows "Ishan Joshi" in figlet ASCII art on load
- [ ] Manual: View page source, confirm JSON script tag contains both ASCII art strings
- [ ] Manual: With JS disabled, "Ishan Joshi" ASCII art still displays (SSR fallback)

---

## Phase 3: CSS color gradient on the banner

### Overview
Apply a color gradient to the ASCII art text using CSS `background-clip: text`.

### Changes Required

#### 1. File: `src/pages/index.astro` — Modify (style block, line 74+)
**Purpose**: Add gradient styling for the banner `<pre>`.

**Add** to the existing `<style>` block:

```css
#ascii-art {
  background: linear-gradient(
    90deg,
    #ea76cb,  /* pink — catppuccin latte */
    #8839ef,  /* mauve */
    #1e66f5,  /* blue */
    #179299,  /* teal */
    #40a02b   /* green */
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}

:global(.dark) #ascii-art {
  background: linear-gradient(
    90deg,
    #f5c2e7,  /* pink — catppuccin mocha */
    #cba6f7,  /* mauve */
    #89b4fa,  /* blue */
    #94e2d5,  /* teal */
    #a6e3a1   /* green */
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}
```

**Key decisions**:
- Using Catppuccin Latte colors for light mode, Mocha for dark mode — consistent with the site's existing palette
- Gradient goes left-to-right across the full banner width
- `color: transparent` + `background-clip: text` makes the gradient show through the characters
- Dark mode selector uses `:global(.dark)` because Astro scopes styles by default

### Success Criteria
- [ ] Manual: ASCII art shows rainbow gradient in light mode
- [ ] Manual: Toggle to dark mode — gradient shifts to darker palette
- [ ] Manual: Gradient is visible on characters, background is transparent

---

## Phase 4: Glitch/morph animation script

### Overview
Add a client-side script that animates from "Ishan Joshi" to a random text from the array with a character-scramble glitch effect.

### Changes Required

#### 1. File: `src/pages/index.astro` — Modify (add script before closing `</Base>`)
**Purpose**: Client-side glitch animation.

**Add** an inline script after the banner markup:

```astro
<script is:inline>
  document.addEventListener("DOMContentLoaded", () => {
    const el = document.getElementById("ascii-art");
    const dataEl = document.getElementById("ascii-data");
    if (!el || !dataEl) return;

    const asciiArts = JSON.parse(dataEl.textContent);
    if (asciiArts.length < 2) return;

    const GLITCH_CHARS = "!@#$%^&*()_+-=[]{}|;:',.<>?/~`0123456789";
    const GLITCH_DURATION = 600;  // ms total for glitch phase
    const FRAME_RATE = 50;        // ms per frame (~20fps)
    const INITIAL_DELAY = 2000;   // ms before glitch starts

    function padLines(art) {
      // Normalize ASCII art to a grid: split into lines, pad to equal width
      const lines = art.split("\n");
      const maxWidth = Math.max(...lines.map((l) => l.length));
      return lines.map((l) => l.padEnd(maxWidth));
    }

    function morph(from, to) {
      const fromLines = padLines(from);
      const toLines = padLines(to);

      // Normalize to same number of lines (pad shorter with empty lines)
      const maxLines = Math.max(fromLines.length, toLines.length);
      const maxWidth = Math.max(
        fromLines[0]?.length || 0,
        toLines[0]?.length || 0
      );
      while (fromLines.length < maxLines) fromLines.push(" ".repeat(maxWidth));
      while (toLines.length < maxLines) toLines.push(" ".repeat(maxWidth));

      // Pad all lines to same width
      const fromGrid = fromLines.map((l) => l.padEnd(maxWidth));
      const toGrid = toLines.map((l) => l.padEnd(maxWidth));

      const totalFrames = Math.floor(GLITCH_DURATION / FRAME_RATE);
      let frame = 0;

      const interval = setInterval(() => {
        frame++;
        const progress = frame / totalFrames;

        // Build current frame: blend from → random glitch → to
        const result = fromGrid.map((line, row) => {
          return Array.from(line)
            .map((char, col) => {
              const targetChar = toGrid[row]?.[col] ?? " ";

              // Each character resolves at a random threshold
              // Seed a pseudo-random threshold per position
              const threshold =
                (Math.sin(row * 13.37 + col * 7.13) * 0.5 + 0.5) * 0.7 + 0.15;

              if (progress >= threshold) {
                return targetChar;
              } else if (progress > threshold * 0.3) {
                // Glitch phase: random character
                return GLITCH_CHARS[
                  Math.floor(Math.random() * GLITCH_CHARS.length)
                ];
              } else {
                return char;
              }
            })
            .join("");
        });

        el.textContent = result.join("\n");

        if (frame >= totalFrames) {
          clearInterval(interval);
          el.textContent = to; // Ensure clean final state
        }
      }, FRAME_RATE);
    }

    // Pick a random target (skip index 0 which is "Ishan Joshi")
    const targetIndex = 1 + Math.floor(Math.random() * (asciiArts.length - 1));

    setTimeout(() => {
      morph(asciiArts[0], asciiArts[targetIndex]);
    }, INITIAL_DELAY);
  });
</script>
```

**Key design decisions**:
- **`is:inline`**: Matches the existing codebase pattern (`base.astro:138`). Prevents Astro from bundling/deduplicating the script.
- **`DOMContentLoaded`**: Ensures the `<pre>` element exists before running.
- **Per-character threshold**: Each character position gets a deterministic-ish threshold (via `sin`) for when it transitions. This creates a wave/spread effect rather than pure random noise.
- **Three phases per character**: original → glitch (random chars) → target. Progress controls when each character enters glitch and when it resolves.
- **`textContent` mutation**: Single DOM update per frame on one `<pre>` element. No spans created during animation — gradient CSS still applies because `background-clip: text` works on any text content.
- **Clean final state**: After animation completes, set `textContent` to the exact target string to avoid any off-by-one artifacts.

**Astro View Transitions consideration**: If the user navigates away and back, `DOMContentLoaded` won't fire again. The SSR-rendered "Ishan Joshi" will show (correct fallback). To re-trigger animation on back-navigation, we could listen to `astro:page-load` instead — but for now, once-per-visit is the right behavior.

### Success Criteria
- [ ] Manual: Page loads → "Ishan Joshi" ASCII art visible for ~2s
- [ ] Manual: Glitch animation plays — characters scramble with random symbols
- [ ] Manual: Animation resolves to "Happy Holi" ASCII art
- [ ] Manual: Gradient color remains visible throughout animation
- [ ] Manual: Animation plays only once, does not loop
- [ ] Manual: Disable JS → static "Ishan Joshi" shows (no errors)

---

## Phase 5: Polish and edge cases

### Overview
Handle responsive sizing, view transitions, and ensure the animation feels right.

### Changes Required

#### 1. File: `src/pages/index.astro` — Modify
**Purpose**: Fine-tune timing, sizing, and transitions.

**Adjustments**:
- Verify ASCII art fits within `text-mx sm:text-base` sizing at mobile widths — figlet Standard font may be too wide. If so, use `overflow-x: auto` on the `<pre>` or switch to figlet `Small` font.
- Add `white-space: pre` and `overflow-x: hidden` to `#ascii-art` to prevent layout shifts during animation when line widths differ between "Ishan Joshi" and "Happy Holi".
- Test: if "Happy Holi" is shorter than "Ishan Joshi", the grid padding in the morph function handles it. But visually confirm no jank.

#### 2. Timing tuning
**Constants to adjust during implementation**:
- `INITIAL_DELAY`: 2000ms — may feel too long or short. Test and adjust.
- `GLITCH_DURATION`: 600ms — the sweet spot is fast enough to feel snappy, slow enough to read the glitch. 400-800ms range.
- `FRAME_RATE`: 50ms (~20fps) — ASCII art looks better slightly choppy. Don't go above 30fps.

### Success Criteria
- [ ] Manual: Test on mobile viewport (375px) — no horizontal overflow or broken layout
- [ ] Manual: Test dark mode toggle before/during/after animation
- [ ] Manual: Timing feels natural — not too slow, not too fast
- [ ] Automated: `npm run build` succeeds (type checking passes)

---

## References

- Homepage: `src/pages/index.astro:1-81`
- Current ASCII banner: `src/pages/index.astro:22-31`
- Theme toggle script pattern: `src/layouts/base.astro:138-159`
- Tailwind config: `tailwind.config.mjs:1-5`
- CSS variables (colors): `src/styles/global.css:46-100`
- Content schema (blog): `src/content/config.ts:3-20`
- figlet.js docs: https://github.com/patorjk/figlet.js
- ascii-morph algorithm reference: https://github.com/tholman/ascii-morph
