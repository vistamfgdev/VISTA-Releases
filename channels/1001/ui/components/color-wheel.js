// components/color-wheel.js
// <vista-colorwheel> : SVG semi-circle hue wheel with touch/mouse drag
// Emits: "colorchange" event with detail { r, g, b, h }

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function hsvToRgb(h, s, v) {
  // h: 0-360, s/v: 0-1
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let rp = 0,
    gp = 0,
    bp = 0;
  if (h < 60) {
    rp = c;
    gp = x;
    bp = 0;
  } else if (h < 120) {
    rp = x;
    gp = c;
    bp = 0;
  } else if (h < 180) {
    rp = 0;
    gp = c;
    bp = x;
  } else if (h < 240) {
    rp = 0;
    gp = x;
    bp = c;
  } else if (h < 300) {
    rp = x;
    gp = 0;
    bp = c;
  } else {
    rp = c;
    gp = 0;
    bp = x;
  }

  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

class VistaColorWheel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this._h = 210; // default hue (pleasant blue)
    this._dragging = false;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
  }

  static get observedAttributes() {
    return ["hue"];
  }

  attributeChangedCallback(name, oldV, newV) {
    if (name === "hue") {
      const h = Number(newV);
      if (!Number.isNaN(h)) {
        this._h = clamp(h, 0, 360);
        if (this.isConnected) this._updateThumb();
      }
    }
  }

  connectedCallback() {
    this.render();
    this._wire();
    this._updateThumb();
  }

  get hue() {
    return this._h;
  }
  set hue(v) {
    const h = clamp(Number(v) || 0, 0, 360);
    this._h = h;
    this.setAttribute("hue", String(h));
    this._updateThumb();
  }

  render() {
    // SVG viewBox is 0..200 x 0..130 (semi circle)
    // Semi circle center is at (100,110) so it sits near bottom.
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; width:100%; }
        .wrap{
          position: relative;
          width: 100%;
          height: 220px;
          border-radius: var(--radius-xl, 22px);
          border: 1px solid var(--stroke-2, rgba(255,255,255,.16));
          background: radial-gradient(circle at 50% 85%, rgba(0,156,222,.10), transparent 60%);
          overflow: hidden;
          touch-action: none; /* important for drag on mobile */
        }
        svg{ width:100%; height:100%; display:block; }
        .ring path{ stroke-linecap: round; }
        .thumb{
          filter: drop-shadow(0 8px 14px rgba(0,0,0,.35));
        }
        .thumb circle.outer{
          fill: rgba(255,255,255,.10);
          stroke: rgba(255,255,255,.55);
          stroke-width: 1.2;
        }
        :root[data-theme="light"] .thumb circle.outer{
          fill: rgba(10,20,30,.08);
          stroke: rgba(10,20,30,.35);
        }
        .thumb circle.inner{
          stroke: rgba(255,255,255,.30);
          stroke-width: 1;
        }
        :root[data-theme="light"] .thumb circle.inner{
          stroke: rgba(10,20,30,.22);
        }
        .hint{
          position:absolute;
          left: 14px;
          bottom: 12px;
          font-size: 12px;
          color: var(--text-3, rgba(255,255,255,.52));
          user-select: none;
          pointer-events: none;
        }
      </style>

      <div class="wrap" part="wrap" aria-label="Color wheel" role="application">
        <svg viewBox="0 0 200 130" aria-hidden="true">
          <!-- ring segments -->
          <g class="ring" id="ring"></g>

          <!-- thumb -->
          <g class="thumb" id="thumb">
            <circle class="outer" cx="0" cy="0" r="9"></circle>
            <circle class="inner" cx="0" cy="0" r="6" fill="rgb(0,0,0)"></circle>
          </g>
        </svg>
        <div class="hint">Drag to pick hue</div>
      </div>
    `;

    this._buildSegments();
  }

  _wire() {
    const wrap = this.shadowRoot.querySelector(".wrap");
    wrap.addEventListener("pointerdown", this._onPointerDown);
    window.addEventListener("pointermove", this._onPointerMove);
    window.addEventListener("pointerup", this._onPointerUp);
    window.addEventListener("pointercancel", this._onPointerUp);
  }

  disconnectedCallback() {
    const wrap = this.shadowRoot?.querySelector(".wrap");
    wrap?.removeEventListener("pointerdown", this._onPointerDown);
    window.removeEventListener("pointermove", this._onPointerMove);
    window.removeEventListener("pointerup", this._onPointerUp);
    window.removeEventListener("pointercancel", this._onPointerUp);
  }

  _buildSegments() {
    // Build a semi-circle ring from many small arc segments.
    // More segments = smoother gradient; 72 is a good balance.
    const SEG = 72;
    const ring = this.shadowRoot.querySelector("#ring");
    ring.innerHTML = "";

    // Geometry in SVG coords
    const cx = 100,
      cy = 110;
    const rOuter = 88;
    const rInner = 66;

    // Semi circle angles: left=180°, right=0° (top half)
    // We'll sweep from 180 down to 0.
    for (let i = 0; i < SEG; i++) {
      const t0 = i / SEG;
      const t1 = (i + 1) / SEG;

      const a0 = Math.PI * (1 - t0); // π .. 0
      const a1 = Math.PI * (1 - t1);

      const x0o = cx + rOuter * Math.cos(a0);
      const y0o = cy - rOuter * Math.sin(a0);
      const x1o = cx + rOuter * Math.cos(a1);
      const y1o = cy - rOuter * Math.sin(a1);

      const x0i = cx + rInner * Math.cos(a0);
      const y0i = cy - rInner * Math.sin(a0);
      const x1i = cx + rInner * Math.cos(a1);
      const y1i = cy - rInner * Math.sin(a1);

      const largeArc = 0; // each segment is small

      // Path for a ring segment (outer arc + inner arc back)
      const d = [
        `M ${x0o.toFixed(2)} ${y0o.toFixed(2)}`,
        `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${x1o.toFixed(2)} ${y1o.toFixed(2)}`,
        `L ${x1i.toFixed(2)} ${y1i.toFixed(2)}`,
        `A ${rInner} ${rInner} 0 ${largeArc} 1 ${x0i.toFixed(2)} ${y0i.toFixed(2)}`,
        "Z",
      ].join(" ");

      // Hue mapping: left=0°, right=360° (wraps)
      const hue = Math.round(t0 * 360);
      const { r, g, b } = hsvToRgb(hue, 1, 1);

      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d);
      p.setAttribute("fill", `rgb(${r},${g},${b})`);
      p.setAttribute("opacity", "0.98");
      ring.appendChild(p);
    }
  }

  _onPointerDown(e) {
    this._dragging = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    this._setFromEvent(e);
  }

  _onPointerMove(e) {
    if (!this._dragging) return;
    this._setFromEvent(e);
  }

  _onPointerUp() {
    this._dragging = false;
  }

  _setFromEvent(e) {
    const wrap = this.shadowRoot.querySelector(".wrap");
    const rect = wrap.getBoundingClientRect();

    // Convert pointer to normalized SVG-ish plane based on wrap size
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // Map screen space to our SVG coordinate space (200 x 130)
    const x = (px / rect.width) * 200;
    const y = (py / rect.height) * 130;

    // Our wheel center in SVG coords
    const cx = 100,
      cy = 110;

    const dx = x - cx;
    const dy = cy - y; // invert so up is positive

    // Angle in [0..π] for top semicircle
    let ang = Math.atan2(dy, dx); // -π..π
    if (ang < 0) ang += Math.PI * 2;

    // Only accept the top half: 0..π
    // If user drags below, clamp to nearest edge.
    if (ang > Math.PI) {
      ang = ang < Math.PI * 1.5 ? Math.PI : 0;
    }

    // Convert angle to hue:
    // right (0 rad) => hue 360/0
    // left (π rad) => hue 0
    const t = 1 - ang / Math.PI; // left->0, right->1
    const hue = clamp(Math.round(t * 360), 0, 360);

    this._h = hue;
    this._updateThumb();

    const rgb = hsvToRgb(hue === 360 ? 0 : hue, 1, 1);
    this._emit(rgb.r, rgb.g, rgb.b, hue);
  }

  _updateThumb() {
    const thumb = this.shadowRoot.querySelector("#thumb");
    const inner = this.shadowRoot.querySelector("#thumb .inner");
    if (!thumb || !inner) return;

    const cx = 100,
      cy = 110;
    const rMid = 77; // somewhere between outer/inner

    // Convert hue back to angle on semicircle
    const t = this._h / 360; // 0..1
    const ang = Math.PI * (1 - t); // π..0

    const x = cx + rMid * Math.cos(ang);
    const y = cy - rMid * Math.sin(ang);

    thumb.setAttribute(
      "transform",
      `translate(${x.toFixed(2)},${y.toFixed(2)})`,
    );

    const { r, g, b } = hsvToRgb(this._h === 360 ? 0 : this._h, 1, 1);
    inner.setAttribute("fill", `rgb(${r},${g},${b})`);
  }

  _emit(r, g, b, h) {
    this.dispatchEvent(
      new CustomEvent("colorchange", {
        bubbles: true,
        composed: true,
        detail: { r, g, b, h },
      }),
    );
  }
}

customElements.define("vista-colorwheel", VistaColorWheel);
