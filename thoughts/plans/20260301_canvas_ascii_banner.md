# Canvas ASCII Banner with Cursor Repulsion — Implementation Plan

## Overview

Transition the ASCII banner from a `<pre>` + `textContent` approach to a `<canvas>` renderer. Canvas unlocks per-character physics — specifically cursor repulsion, where characters spring away from the mouse and snap back when it leaves. All existing behavior is preserved: random font selection per load, glitch morph animation, exponential cycle timing.

**Why canvas over spans**: Span-per-character would break the existing textContent-mutation morph logic and create ~500 DOM nodes. Canvas keeps everything in JS, gives pixel-level control, and handles the physics loop naturally inside `requestAnimationFrame`.

## Current State Analysis

- **Banner element**: `<pre id="ascii-art">` at `src/pages/index.astro:38-44` — receives textContent mutations
- **Data transport**: `<script id="ascii-data" type="application/json" is:inline>` at `src/pages/index.astro:45-50` — 3×2 JSON array passed via JSON script tag (unidiomatic)
- **Animation script**: `<script is:inline>` at `src/pages/index.astro:105-241` — uses `is:inline` because it accesses the JSON script tag; loses TypeScript, bundling, tree-shaking
- **CSS**: `src/pages/index.astro:93-104` — `white-space: pre`, `overflow-x: hidden`
- **Dark mode**: Page reloads on theme toggle (`src/layouts/base.astro:154`) — canvas can read current color at init time
- **Font**: `font-mono` Tailwind; `--font-geist-mono` CSS variable from `src/styles/global.css`
- **SSR fallback**: `set:html={asciiArts[0][0]}` on the `<pre>` renders first frame server-side

## Desired End State

- A `<ascii-banner>` custom element wraps a `<canvas>` and a hidden `<pre>` fallback
- Server data (the ASCII arts array) passed via a `data-arts` attribute — idiomatic Astro pattern
- The animation script is a **processed** `<script>` (no `is:inline`) — gets TypeScript, bundling, deduplication
- The script is extracted to `src/scripts/ascii-banner.ts` for cleanliness
- Characters spring away from cursor, snap back when cursor leaves
- Glitch morph + physics work simultaneously
- Exponential pause: 2s → 3s → ... → 10s cap
- `bun run build` passes with 0 errors

**Verify completion**: Load homepage → ASCII art on canvas → hover → chars spring away → leave → snap back → wait 2s → glitch morph while repulsion active → cycle timing grows.

## What We're NOT Doing

- No WebGL — 2D canvas context is sufficient
- No client-side figlet — ASCII art still server-side; canvas just renders strings
- No ResizeObserver — canvas sized once on init
- No touch repulsion — mobile has no cursor; banner just animates normally
- No canvas text selection — hidden `<pre>` handles a11y/copy-paste

## Astro Patterns Applied (from docs)

The current implementation uses two anti-patterns that this plan corrects:

1. **JSON `<script>` tag for data** → Astro docs recommend `data-*` attributes on HTML elements. The script reads `this.dataset.arts` instead of `document.getElementById("ascii-data").textContent`. This eliminates the JSON script tag entirely.

2. **`is:inline` script** → Only needed when the script has attributes (other than `src`) or reads from a JSON script tag. With data attributes, the animation script can be a plain `<script>` — processed by Astro (TypeScript, bundled, deduplicated, optimized). Per the docs: *"The `is:inline` directive is implied whenever any attribute other than `src` is used on a `<script>` tag."*

3. **Custom element pattern** → Astro docs recommend Web Components custom elements for interactive components. `connectedCallback()` scopes init to the element instance; no `document.getElementById` needed. The `<ascii-banner>` custom element owns the canvas, reads its own `data-arts`, and manages all state internally.

## Implementation Approach

### Data flow

```
Server (index.astro frontmatter)
  → asciiArts: string[][] (3 fonts × 2 texts)
  → JSON.stringify → data-arts attribute on <ascii-banner>

Client (src/scripts/ascii-banner.ts)
  → class AsciiBanner extends HTMLElement
  → connectedCallback(): parse this.dataset.arts
  → init canvas, start rAF loop
```

### rAF loop responsibilities (single loop, always running)

1. **Morph update** — if morph active, advance `morphProgress` by elapsed time; update each cell's `char` based on threshold
2. **Physics update** — apply repulsion + spring + damping to each cell's `(px, py, vx, vy)`
3. **Draw** — `ctx.fillText(cell.char, cell.px, cell.py)` for all cells

Cycle timing stays `setTimeout`-based (exponential). It just calls `startMorph()` which sets a flag read by the rAF loop.

---

## Phase 1: Custom Element + Canvas Setup + Static Rendering

### Overview

Replace the `<pre>` + JSON script tag + `is:inline` script with an `<ascii-banner>` custom element. Canvas renders static text at rest positions. No morph or physics yet — just the scaffold that subsequent phases build on.

### Changes Required

#### 1. File: `src/scripts/ascii-banner.ts` — Create

**Purpose**: Processed TypeScript module containing the `AsciiBanner` custom element. Astro will bundle and optimize this automatically.

```typescript
const FONT_SIZE = 14;       // px
const LINE_HEIGHT = 18;     // px (tight leading)
const FONT_FAMILY = `'JetBrains Mono', 'Geist Mono', monospace`;
const FONT_STRING = `${FONT_SIZE}px ${FONT_FAMILY}`;

interface Cell {
  char: string;
  row: number;
  col: number;
  rx: number;   // rest x (CSS px)
  ry: number;   // rest y (CSS px, baseline)
  px: number;   // current x
  py: number;   // current y
  vx: number;   // velocity x
  vy: number;   // velocity y
}

class AsciiBanner extends HTMLElement {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private cells: Cell[] = [];
  private fontArts: string[] = [];
  private color = '#000000';
  private charWidth = 0;
  private rafId = 0;

  connectedCallback() {
    const arts: string[][] = JSON.parse(this.dataset.arts ?? '[]');
    const canvas = this.querySelector<HTMLCanvasElement>('canvas');
    if (!canvas || arts.length === 0) return;

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    // Read current text color (handles light/dark at init time)
    this.color = getComputedStyle(document.documentElement).color;

    // Measure char width with canvas itself
    this.ctx.font = FONT_STRING;
    this.charWidth = this.ctx.measureText('M').width;

    // Pick random font for this page load
    const fontIndex = Math.floor(Math.random() * arts.length);
    this.fontArts = arts[fontIndex];

    this.initCanvas(this.fontArts[0]);
    this.rafId = requestAnimationFrame((ts) => this.render(ts));
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.rafId);
  }

  private initCanvas(art: string) {
    const lines = art.split('\n');
    const maxCols = Math.max(...lines.map((l) => l.length));
    const dpr = devicePixelRatio || 1;

    this.canvas.width = Math.ceil(maxCols * this.charWidth * dpr);
    this.canvas.height = Math.ceil(lines.length * LINE_HEIGHT * dpr);
    this.canvas.style.width = `${Math.ceil(maxCols * this.charWidth)}px`;
    this.canvas.style.height = `${Math.ceil(lines.length * LINE_HEIGHT)}px`;

    this.ctx.scale(dpr, dpr);
    this.ctx.font = FONT_STRING; // re-apply after scale reset

    this.cells = this.buildGrid(art);
  }

  private buildGrid(art: string): Cell[] {
    const cells: Cell[] = [];
    art.split('\n').forEach((line, row) => {
      Array.from(line).forEach((char, col) => {
        const rx = col * this.charWidth;
        const ry = row * LINE_HEIGHT + FONT_SIZE; // fillText y = baseline
        cells.push({ char, row, col, rx, ry, px: rx, py: ry, vx: 0, vy: 0 });
      });
    });
    return cells;
  }

  private render(_timestamp: number) {
    const { ctx, canvas, cells, color } = this;
    const w = canvas.width / (devicePixelRatio || 1);
    const h = canvas.height / (devicePixelRatio || 1);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.font = FONT_STRING;

    for (const cell of cells) {
      if (cell.char !== ' ') {
        ctx.fillText(cell.char, cell.px, cell.py);
      }
    }

    this.rafId = requestAnimationFrame((ts) => this.render(ts));
  }
}

customElements.define('ascii-banner', AsciiBanner);
```

#### 2. File: `src/pages/index.astro` — Modify HTML (lines 31–50)

**Purpose**: Replace `<div id="banner">` + `<pre>` + JSON script tag with `<ascii-banner>` custom element carrying the data attribute.

**Remove**:
```astro
<div id="banner" class="my-2">
  <pre id="ascii-art" ... set:html={asciiArts[0][0]} />
</div>
<script is:inline id="ascii-data" type="application/json" set:html={JSON.stringify(asciiArts)} />
```

**Add**:
```astro
<ascii-banner data-arts={JSON.stringify(asciiArts)} class="block my-2">
  <canvas
    role="img"
    aria-label="ASCII art: Ishan Joshi"
    class="block"
  ></canvas>
  <!-- No-JS / screen-reader fallback -->
  <pre
    class="font-mono leading-tight text-sm sr-only"
    aria-hidden="true"
  >{asciiArts[0][0]}</pre>
</ascii-banner>
```

**Note**: `sr-only` (Tailwind screen-reader utility) hides the `<pre>` visually but keeps it accessible. The canvas gets the `aria-label`.

#### 3. File: `src/pages/index.astro` — Replace `<script is:inline>` with processed script

**Remove**: The entire `<script is:inline>` block (lines 125–241 approximately)

**Add** (processed script — no `is:inline`):
```astro
<script>
  import '../scripts/ascii-banner.ts';
</script>
```

Astro bundles this into the page's JS output. TypeScript is supported. Deduplication means if `<ascii-banner>` is ever used on multiple pages, the script only loads once.

#### 4. File: `src/pages/index.astro` — Update CSS block

**Remove**: `#ascii-art` rule (no longer exists)

**Add**: Nothing needed — canvas is `display: block` via Tailwind class; `<ascii-banner>` is a custom element (inline by default, so `class="block"` makes it block-level).

### Success Criteria
- [ ] Manual: Homepage shows "Ishan Joshi" ASCII art on canvas, same visual as before
- [ ] Manual: Dark mode — white text on dark background
- [ ] Manual: `<pre>` is visually hidden but present in DOM (inspect element)
- [ ] Manual: Disable JS — `<pre>` content visible (no canvas)
- [ ] Automated: `bun run build` — 0 errors, 0 type errors

---

## Phase 2: Glitch Morph Animation on Canvas

### Overview

Port the morph/glitch animation to the rAF loop using `performance.now()` timestamps instead of `setInterval`. Add morph state to the class. Cycle timing (`setTimeout`, exponential pause) is preserved exactly. After this phase, the banner glitches between texts on canvas identically to the old `<pre>` implementation.

### Changes Required

#### 1. File: `src/scripts/ascii-banner.ts` — Extend class with morph state and cycle timing

**Add to class fields**:
```typescript
// Morph state
private morph = {
  active: false,
  startTime: 0,
  duration: 600,        // ms
  fromSnap: [] as Cell[],          // snapshot of cells at morph start
  toLines: [] as string[][],       // target chars [row][col]
  thresholds: [] as number[],      // per-cell threshold (flat array, index matches cells)
  onComplete: null as (() => void) | null,
};

// Cycle state
private currentTextIndex = 0;
private nextPause = 2000;          // grows 2s → 3s → ... → 10s
private cycleTimer = 0;
private isMorphing = false;

private readonly GLITCH_CHARS = "!@#$%^&*()_+-=[]{}|;:',.<>?/~`0123456789";
private readonly PAUSE_STEP = 1000;
private readonly PAUSE_MAX = 10000;
private readonly INITIAL_DELAY = 2000;
```

**Add `startMorph(toArt, onComplete)` method**:
```typescript
private startMorph(toArt: string, onComplete: () => void) {
  if (this.morph.active) return;

  // Snapshot current cell chars
  this.morph.fromSnap = this.cells.map((c) => ({ ...c }));

  // Build target grid
  this.morph.toLines = toArt.split('\n').map((line) => Array.from(line));

  // Pre-compute deterministic per-cell thresholds (same formula as original)
  this.morph.thresholds = this.cells.map((cell) =>
    (Math.sin(cell.row * 13.37 + cell.col * 7.13) * 0.5 + 0.5) * 0.7 + 0.15
  );

  this.morph.active = true;
  this.morph.startTime = performance.now();
  this.morph.onComplete = onComplete;
}
```

**Add `scheduleCycle()` and `cycle()` methods**:
```typescript
private scheduleCycle() {
  this.cycleTimer = window.setTimeout(() => this.cycle(), this.nextPause);
  this.nextPause = Math.min(this.nextPause + this.PAUSE_STEP, this.PAUSE_MAX);
}

private cycle() {
  if (this.isMorphing) return;
  this.isMorphing = true;
  const nextIndex = (this.currentTextIndex + 1) % this.fontArts.length;
  this.startMorph(this.fontArts[nextIndex], () => {
    // Rebuild cells for new art (fresh rest positions + zero velocity)
    this.initCanvas(this.fontArts[nextIndex]);
    this.currentTextIndex = nextIndex;
    this.isMorphing = false;
    this.scheduleCycle();
  });
}
```

**Update `connectedCallback()`** — kick off cycle after initial delay:
```typescript
window.setTimeout(() => this.scheduleCycle(), this.INITIAL_DELAY);
```

**Update `disconnectedCallback()`** — clear timer:
```typescript
clearTimeout(this.cycleTimer);
cancelAnimationFrame(this.rafId);
```

**Update `render(timestamp)` method** — add morph update step before draw:
```typescript
private render(timestamp: number) {
  // --- Morph update ---
  if (this.morph.active) {
    const progress = Math.min(
      (timestamp - this.morph.startTime) / this.morph.duration,
      1
    );

    this.cells.forEach((cell, i) => {
      const threshold = this.morph.thresholds[i];
      const fromChar = this.morph.fromSnap[i]?.char ?? ' ';
      const toChar = this.morph.toLines[cell.row]?.[cell.col] ?? ' ';

      if (progress >= threshold) {
        cell.char = toChar;
      } else if (progress > threshold * 0.3) {
        cell.char = this.GLITCH_CHARS[
          Math.floor(Math.random() * this.GLITCH_CHARS.length)
        ];
      } else {
        cell.char = fromChar;
      }
    });

    if (progress >= 1) {
      this.morph.active = false;
      this.morph.onComplete?.();
    }
  }

  // --- Draw (unchanged from Phase 1) ---
  ...
}
```

### Success Criteria
- [ ] Manual: After 2s, glitch animation plays — chars scramble, resolve to "Happy Holi"
- [ ] Manual: Cycle timing grows: wait 2s after first morph, 3s after second, etc.
- [ ] Manual: Glitch character wave spread matches the original `<pre>` animation visually
- [ ] Automated: `bun run build` — 0 errors, 0 type errors

---

## Phase 3: Cursor Repulsion Physics

### Overview

Add spring-damped per-character repulsion. Mouse position is tracked in canvas CSS-pixel space. Each rAF frame: apply repulsion force to cells within radius, apply spring toward rest position, apply damping, integrate velocity. The physics update runs every frame regardless of morph state — both effects compose naturally.

### Changes Required

#### 1. File: `src/scripts/ascii-banner.ts` — Add physics constants and mouse state

**Add to class fields**:
```typescript
private readonly REPEL_RADIUS = 120;  // px — repulsion zone
private readonly REPEL_FORCE = 12;    // push strength
private readonly SPRING_K = 0.12;     // spring toward rest (0.1–0.2)
private readonly DAMPING = 0.75;      // velocity decay per frame (0.7–0.8)

private mouseX = -9999;  // off-screen = no repulsion
private mouseY = -9999;
```

**Add mouse listeners in `connectedCallback()`**:
```typescript
this.canvas.addEventListener('mousemove', (e) => {
  const rect = this.canvas.getBoundingClientRect();
  this.mouseX = e.clientX - rect.left;
  this.mouseY = e.clientY - rect.top;
});

this.canvas.addEventListener('mouseleave', () => {
  this.mouseX = -9999;
  this.mouseY = -9999;
});
```

**Note**: Mouse coords are in CSS pixels. Cell rest positions `(rx, ry)` are also CSS pixels (pre-`devicePixelRatio`). Same coordinate space — no scaling needed for physics comparison.

#### 2. File: `src/scripts/ascii-banner.ts` — Add physics update step in `render()`

**Insert between morph update and draw**:
```typescript
// --- Physics update ---
for (const cell of this.cells) {
  const dx = cell.rx - this.mouseX;
  const dy = cell.ry - this.mouseY;
  const distSq = dx * dx + dy * dy;
  const dist = Math.sqrt(distSq);

  if (dist < this.REPEL_RADIUS && dist > 0) {
    // Repulsion: push away from cursor (direction = cursor → cell)
    const force = this.REPEL_FORCE * (1 - dist / this.REPEL_RADIUS);
    cell.vx += (dx / dist) * force;
    cell.vy += (dy / dist) * force;
  }

  // Spring: pull back to rest
  cell.vx += (cell.rx - cell.px) * this.SPRING_K;
  cell.vy += (cell.ry - cell.py) * this.SPRING_K;

  // Damping
  cell.vx *= this.DAMPING;
  cell.vy *= this.DAMPING;

  // Integrate
  cell.px += cell.vx;
  cell.py += cell.vy;
}
```

**Physics constant tuning guide** (for the implementer — adjust after first visual test):
- `REPEL_FORCE` too high → chars fly off canvas edge; too low → barely noticeable. Start at 12, test.
- `SPRING_K` too high → jittery snap-back (>0.2 feels wrong); too low → chars drift and don't return (<0.08)
- `DAMPING` too high → sluggish return (>0.85); too low → oscillation/bouncing (<0.65)
- `REPEL_RADIUS` is purely aesthetic — 100–150px feels natural for this font size

### Success Criteria
- [ ] Manual: Hover over banner → chars spring away from cursor position
- [ ] Manual: Move cursor away → chars spring back smoothly to rest
- [ ] Manual: Cursor repulsion + glitch morph active simultaneously — chars glitch AND displace
- [ ] Manual: Mobile viewport — no repulsion artifacts (mouse events don't fire on touch)
- [ ] Automated: `bun run build` — 0 errors, 0 type errors

---

## Phase 4: Cleanup and Integration

### Overview

Remove all dead code from the old `<pre>` approach. Verify the full end-to-end flow. Ensure `disconnectedCallback` cleans up properly (important for Astro view transitions if ever added).

### Changes Required

#### 1. File: `src/pages/index.astro` — Remove old imports now unused

The JSON data script and `is:inline` script are already gone from Phase 1. Verify no dead references remain. The figlet imports and `asciiArts` generation in the frontmatter stay — they now feed the `data-arts` attribute.

#### 2. File: `src/scripts/ascii-banner.ts` — Verify cleanup in `disconnectedCallback`

```typescript
disconnectedCallback() {
  cancelAnimationFrame(this.rafId);
  clearTimeout(this.cycleTimer);
}
```

This matters if Astro View Transitions are ever enabled — the custom element's `disconnectedCallback` fires on navigation, preventing rAF and timer leaks.

#### 3. File: `src/pages/index.astro` — Final `<script>` tag

The processed script import stays minimal:
```astro
<script>
  import '../scripts/ascii-banner.ts';
</script>
```

Astro handles bundling. The `customElements.define('ascii-banner', AsciiBanner)` inside the module runs once — Astro's deduplication ensures the script is not included multiple times even if the component is reused.

### Success Criteria
- [ ] Manual: Full flow — load → static ASCII art → 2s → morph with repulsion → resolves → 3s → morph back → timing grows to 10s cap
- [ ] Manual: Cursor interaction at every stage: during initial pause, during morph, during post-morph pause
- [ ] Manual: Dark mode toggle → page reloads → canvas re-inits with correct color
- [ ] Manual: JS disabled → `<pre>` fallback visible with "Ishan Joshi" ASCII art
- [ ] Manual: Mobile viewport (375px) — no horizontal overflow
- [ ] Automated: `bun run build` — 0 errors, 0 type errors

---

## File Summary

| File | Action | Notes |
|---|---|---|
| `src/scripts/ascii-banner.ts` | **Create** | Custom element, canvas renderer, physics, morph |
| `src/pages/index.astro` | **Modify** | Replace banner HTML, add `<script>` import, update CSS |

No new dependencies. No changes to `astro.config.mjs`, `tailwind.config.mjs`, or any layout files.

---

## References

- Current implementation: `src/pages/index.astro:1-241`
- Dark mode toggle (page reload): `src/layouts/base.astro:138-159`
- Global colors: `src/styles/global.css:16-24`
- Astro docs — passing data to scripts: https://docs.astro.build/en/guides/client-side-scripts/#pass-frontmatter-variables-to-scripts
- Astro docs — custom elements pattern: https://docs.astro.build/en/guides/client-side-scripts/#web-components-with-custom-elements
- Astro docs — processed vs `is:inline`: https://docs.astro.build/en/guides/client-side-scripts/#script-processing
- Prior glitch plan: `thoughts/plans/20260301_ascii_banner_glitch.md`
