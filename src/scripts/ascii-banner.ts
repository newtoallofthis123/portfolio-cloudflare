const FONT_SIZE = 14;
const LINE_HEIGHT = 18;
const FONT_FAMILY = `'JetBrains Mono', 'Geist Mono', monospace`;
const FONT_STRING = `${FONT_SIZE}px ${FONT_FAMILY}`;

interface Cell {
  char: string;
  row: number;
  col: number;
  rx: number;
  ry: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
}

class AsciiBanner extends HTMLElement {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private cells: Cell[] = [];
  private fontArts: string[] = [];
  private color = '#000000';
  private charWidth = 0;
  private rafId = 0;

  // Morph state
  private morph = {
    active: false,
    startTime: 0,
    duration: 600,
    fromSnap: [] as Cell[],
    toLines: [] as string[][],
    thresholds: [] as number[],
    onComplete: null as (() => void) | null,
  };

  // Cycle state
  private currentTextIndex = 0;
  private nextPause = 2000;
  private cycleTimer = 0;
  private isMorphing = false;

  private readonly GLITCH_CHARS = "!@#$%^&*()_+-=[]{}|;:',.<>?/~`0123456789";
  private readonly PAUSE_STEP = 1000;
  private readonly PAUSE_MAX = 10000;
  private readonly INITIAL_DELAY = 2000;

  // Physics
  private readonly REPEL_RADIUS = 80;
  private readonly REPEL_FORCE = 3;
  private readonly SPRING_K = 0.15;
  private readonly DAMPING = 0.7;

  private mouseX = -9999;
  private mouseY = -9999;
  private hovering = false;

  connectedCallback() {
    const arts: string[][] = JSON.parse(this.dataset.arts ?? '[]');
    const canvas = this.querySelector<HTMLCanvasElement>('canvas');
    if (!canvas || arts.length === 0) return;

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    this.color = getComputedStyle(document.documentElement).color;

    this.ctx.font = FONT_STRING;
    this.charWidth = this.ctx.measureText('M').width;

    const fontIndex = Math.floor(Math.random() * arts.length);
    this.fontArts = arts[fontIndex];

    this.initCanvas(this.fontArts[0]);
    this.rafId = requestAnimationFrame((ts) => this.render(ts));

    this.canvas.addEventListener('mouseenter', () => {
      this.hovering = true;
      clearTimeout(this.cycleTimer);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = devicePixelRatio || 1;
      const scaleX = (this.canvas.width / dpr) / rect.width;
      const scaleY = (this.canvas.height / dpr) / rect.height;
      this.mouseX = (e.clientX - rect.left) * scaleX;
      this.mouseY = (e.clientY - rect.top) * scaleY;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hovering = false;
      this.mouseX = -9999;
      this.mouseY = -9999;
      if (!this.isMorphing) this.scheduleCycle();
    });

    window.setTimeout(() => this.scheduleCycle(), this.INITIAL_DELAY);
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.rafId);
    clearTimeout(this.cycleTimer);
  }

  private initCanvas(art: string) {
    const lines = art.split('\n');
    const maxCols = Math.max(...lines.map((l) => l.length));
    const dpr = devicePixelRatio || 1;

    const naturalW = Math.ceil(maxCols * this.charWidth);
    const naturalH = Math.ceil(lines.length * LINE_HEIGHT);

    this.canvas.width = Math.ceil(naturalW * dpr);
    this.canvas.height = Math.ceil(naturalH * dpr);
    this.canvas.style.width = `${naturalW}px`;
    this.canvas.style.height = `${naturalH}px`;
    this.canvas.style.maxWidth = '100%';
    this.canvas.style.height = 'auto';

    this.ctx.scale(dpr, dpr);
    this.ctx.font = FONT_STRING;

    this.cells = this.buildGrid(art);
  }

  private buildGrid(art: string): Cell[] {
    const cells: Cell[] = [];
    art.split('\n').forEach((line, row) => {
      Array.from(line).forEach((char, col) => {
        const rx = col * this.charWidth;
        const ry = row * LINE_HEIGHT + FONT_SIZE;
        cells.push({ char, row, col, rx, ry, px: rx, py: ry, vx: 0, vy: 0 });
      });
    });
    return cells;
  }

  private startMorph(toArt: string, onComplete: () => void) {
    if (this.morph.active) return;

    this.morph.fromSnap = this.cells.map((c) => ({ ...c }));
    this.morph.toLines = toArt.split('\n').map((line) => Array.from(line));
    this.morph.thresholds = this.cells.map((cell) =>
      (Math.sin(cell.row * 13.37 + cell.col * 7.13) * 0.5 + 0.5) * 0.7 + 0.15
    );

    this.morph.active = true;
    this.morph.startTime = performance.now();
    this.morph.onComplete = onComplete;
  }

  private scheduleCycle() {
    this.cycleTimer = window.setTimeout(() => this.cycle(), this.nextPause);
    this.nextPause = Math.min(this.nextPause + this.PAUSE_STEP, this.PAUSE_MAX);
  }

  private cycle() {
    if (this.isMorphing || this.hovering) return;
    this.isMorphing = true;
    const nextIndex = (this.currentTextIndex + 1) % this.fontArts.length;
    this.startMorph(this.fontArts[nextIndex], () => {
      this.initCanvas(this.fontArts[nextIndex]);
      this.currentTextIndex = nextIndex;
      this.isMorphing = false;
      this.scheduleCycle();
    });
  }

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

    // --- Physics update ---
    for (const cell of this.cells) {
      const dx = cell.rx - this.mouseX;
      const dy = cell.ry - this.mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.REPEL_RADIUS && dist > 0) {
        const force = this.REPEL_FORCE * (1 - dist / this.REPEL_RADIUS);
        cell.vx += (dx / dist) * force;
        cell.vy += (dy / dist) * force;
      }

      cell.vx += (cell.rx - cell.px) * this.SPRING_K;
      cell.vy += (cell.ry - cell.py) * this.SPRING_K;

      cell.vx *= this.DAMPING;
      cell.vy *= this.DAMPING;

      cell.px += cell.vx;
      cell.py += cell.vy;
    }

    // --- Draw ---
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
