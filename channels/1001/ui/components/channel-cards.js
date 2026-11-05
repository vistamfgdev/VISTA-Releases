// =========================================================
// VISTA Channel Widgets
// Each widget owns its render but emits its FULL current state
// on every change. Parent (vista-app) does the merging via commitChannelEdit.
// =========================================================
console.log("[VISTA] channel-cards.js loaded");

const vClamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const toPercent = (v) => Math.round((v / 255) * 100);
const percentToPwm = (pct) => Math.round((pct / 100) * 255);

const PRESET_COLORS = [
  { id: "red", label: "Red", rgb: [255, 0, 0], dot: "#ff3b30" },
  { id: "green", label: "Green", rgb: [0, 255, 0], dot: "#34c759" },
  { id: "blue", label: "Blue", rgb: [0, 0, 255], dot: "#007aff" },
  { id: "white", label: "White", rgb: [0, 0, 0], w: 255, dot: "#f2f2f7" },
  { id: "cyan", label: "Cyan", rgb: [0, 255, 255], dot: "#32ade6" },
  { id: "magenta", label: "Magenta", rgb: [255, 0, 255], dot: "#ff2d55" },
  { id: "yellow", label: "Yellow", rgb: [255, 255, 0], dot: "#ffcc00" },
];

function hsvToRgb(h, s, v) {
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  let rp = 0,
    gp = 0,
    bp = 0;
  if (h < 60) {
    rp = c;
    gp = x;
  } else if (h < 120) {
    rp = x;
    gp = c;
  } else if (h < 180) {
    gp = c;
    bp = x;
  } else if (h < 240) {
    gp = x;
    bp = c;
  } else if (h < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

function rgbToHue(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return h;
}

let vistaAddressableAnimations = [];

window.setVistaAddressableAnimations = function (
  animations
) {
  vistaAddressableAnimations = Array.isArray(animations)
    ? animations
        .filter(
          (animation) =>
            animation &&
            typeof animation.id === "string" &&
            animation.id.length > 0
        )
        .map((animation) => ({
          id: animation.id,
          label:
            animation.label || animation.id,
          minIntervalMs:
            Number(animation.minIntervalMs) || 0,
          maxIntervalMs:
            Number(animation.maxIntervalMs) || 0,
          hasDirection:
            !!animation.hasDirection,
          hasSize:
            !!animation.hasSize,
          hasCycleCount:
            !!animation.hasCycleCount,
          minSizePercent: Math.max(
            0,
            Math.min(100, Number(animation.minSizePercent) || 0)
          ),
          maxSizePercent: Math.max(
            0,
            Math.min(100, Number(animation.maxSizePercent) || 0)
          ),
        }))
    : [];

  document
    .querySelectorAll(
      "vista-channel-addressable"
    )
    .forEach((widget) => {
      widget.render();
    });
};

// ---------- Base class ----------
class ChannelWidgetBase extends HTMLElement {
  constructor() {
    super();
    this._state = {};
  }

  defaultState() {
    return {};
  }
  render() {
    /* override */
  }

  /** Parent seeds state on every render. We re-render only if value actually changed. */
  setState(state) {
    const known = Object.keys(this.defaultState());
    const incoming = {};
    for (const k of known) {
      if (state && state[k] !== undefined) incoming[k] = state[k];
    }
    const next = { ...this.defaultState(), ...incoming };
    if (JSON.stringify(next) === JSON.stringify(this._state)) return;
    this._state = next;
    if (this.isConnected) this.render();
  }

  getState() {
    return JSON.parse(JSON.stringify(this._state));
  }

  /** Emit current full state. Parent commits via commitChannelEdit. */
  _emitChange() {
    this.dispatchEvent(
      new CustomEvent("channelchange", {
        bubbles: true,
        composed: true,
        detail: { state: this.getState() },
      })
    );
  }

  _trackSlider(input, max = 255) {
    const update = () => {
      const v = parseInt(input.value, 10) || 0;
      input.style.setProperty("--val", `${(v / max) * 100}%`);
    };
    update();
    input.addEventListener("input", update);
  }

  connectedCallback() {
    if (!Object.keys(this._state).length) this._state = this.defaultState();
    this.render();
  }
}

// ---------- DIM widget ----------
class DimWidget extends ChannelWidgetBase {
  defaultState() {
    return { running: true, level: 0, brightness: 255 };
  }

  render() {
    const s = this._state;
    this.innerHTML = `
      <div class="card"><div class="card__pad">
        <div class="row">
          <div class="left">
            <div class="kicker">Brightness</div>
            <div class="value"><span data-role="lvl-val">${toPercent(s.level ?? 0)}</span>%</div>
          </div>
          <span class="badge gray">DIM</span>
        </div>
        <div class="mt-12 slider">
          <input type="range" min="0" max="255" step="1"
                 value="${s.level ?? 0}" data-action="dim-level" />
        </div>
      </div></div>
    `;
    this.querySelector('[data-action="dim-level"]').addEventListener("input", (e) => {
      const v = vClamp(parseInt(e.target.value, 10) || 0, 0, 255);
      this._state.level = v;
      this._state.brightness = 255;
      this._state.running = true;
      this.querySelector('[data-role="lvl-val"]').textContent = String(toPercent(v));
      this._emitChange();
    });
    this._trackSlider(this.querySelector('[data-action="dim-level"]'));
  }
}
customElements.define("vista-channel-dim", DimWidget);

// ---------- CCT widget ----------
class CCTWidget extends ChannelWidgetBase {
  defaultState() {
    return { running: true, warm: 0, cool: 0, brightness: 255 };
  }

  // Derived: a 0..255 slider value representing warm↔cool blend
  _blendFromState() {
    const total = (this._state.warm || 0) + (this._state.cool || 0);
    if (total === 0) return 128; // neutral default
    return Math.round((this._state.cool / total) * 255);
  }

  _stateFromBlend(blend) {
    // blend 0..255: 0 = full warm, 255 = full cool
    // Map to warm+cool levels that sum to 255 (so brightness controls overall output)
    this._state.warm = 255 - blend;
    this._state.cool = blend;
  }

  _kelvinFromBlend(blend) {
    // Linear map: blend 0 → 2700K, blend 255 → 6500K
    const k = Math.round(2700 + (blend / 255) * (6500 - 2700));
    return k;
  }

  render() {
    const s = this._state;
    const blend = this._blendFromState();
    const kelvin = this._kelvinFromBlend(blend);

    this.innerHTML = `
      <div class="card"><div class="card__pad">
        <div class="row">
          <div class="left">
            <div class="kicker">Brightness</div>
            <div class="value"><span data-role="br-val">${toPercent(s.brightness)}</span>%</div>
          </div>
          <span class="badge">CCT</span>
        </div>
        <div class="mt-12 slider">
          <input type="range" min="0" max="255" step="1"
                 value="${s.brightness}" data-action="cct-brightness" />
        </div>
      </div></div>

      <div class="card"><div class="card__pad">
        <div class="row">
          <div class="left">
            <div class="kicker">Color Temperature</div>
            <div class="value"><span data-role="cct-kelvin">${kelvin}</span> K</div>
          </div>
        </div>
        <div class="mt-12 slider">
          <input type="range" min="0" max="255" step="1"
                 value="${blend}" data-action="cct-blend" />
        </div>
        <div class="mt-12 row">
          <span class="kicker">Warm</span>
          <span class="kicker">Cool</span>
        </div>
      </div></div>
    `;
    this._wire();
  }

  _wire() {
    const emit = () => {
      this._state.running = true;
      this._emitChange();
    };

    this._trackSlider(this.querySelector('[data-action="cct-brightness"]'));
    this._trackSlider(this.querySelector('[data-action="cct-blend"]'));

    this.querySelector('[data-action="cct-brightness"]')?.addEventListener("input", (e) => {
      const v = vClamp(parseInt(e.target.value, 10) || 0, 0, 255);
      this._state.brightness = v;
      this.querySelector('[data-role="br-val"]').textContent = String(toPercent(v));
      emit();
    });

    this.querySelector('[data-action="cct-blend"]')?.addEventListener("input", (e) => {
      const blend = vClamp(parseInt(e.target.value, 10) || 0, 0, 255);
      this._stateFromBlend(blend);
      this.querySelector('[data-role="cct-kelvin"]').textContent = String(this._kelvinFromBlend(blend));
      emit();
    });
  }
}
customElements.define("vista-channel-cct", CCTWidget);

// ---------- RGB widget ----------
class RGBWidget extends ChannelWidgetBase {
  defaultState() {
    return { running: true, r: 0, g: 0, b: 0, brightness: 255 };
  }

  render() {
    const s = this._state;
    const hue = rgbToHue(s.r, s.g, s.b);

    this.innerHTML = `
      <div class="card"><div class="card__pad">
        <div class="row">
          <div class="left">
            <div class="kicker">Brightness</div>
            <div class="value"><span data-role="br-val">${toPercent(s.brightness)}</span>%</div>
          </div>
          <span class="badge">RGB</span>
        </div>
        <div class="mt-12 slider">
          <input type="range" min="0" max="255" step="1"
                 value="${s.brightness}" data-action="rgb-brightness" />
        </div>
      </div></div>

      <div class="card"><div class="card__pad">
        <div class="kicker">Presets</div>
        <div class="mt-12 chip-grid">
          ${PRESET_COLORS.filter((p) => p.id !== "white")
            .map(
              (p) => `
            <button class="chip compact" type="button"
                    data-action="rgb-preset" data-preset="${p.id}">
              <span class="dot" style="background:${p.dot};"></span>
              ${p.label}
            </button>
          `
            )
            .join("")}
        </div>
      </div></div>

      <div class="card"><div class="card__pad">
        <div class="kicker">Color</div>
        <div class="mt-12">
          <vista-colorwheel hue="${hue}"></vista-colorwheel>
        </div>
        <div class="mt-12 row">
          <div class="left">
            <div class="kicker">Selected</div>
            <div class="value" data-role="color-read">R ${s.r} G ${s.g} B ${s.b}</div>
          </div>
        </div>
        <div class="mt-12">
          ${this._renderRgbSliders(s.r, s.g, s.b)}
        </div>
      </div></div>
    `;
    this._wire();
  }

  _renderRgbSliders(r, g, b) {
    const items = [
      ["R", "r", r],
      ["G", "g", g],
      ["B", "b", b],
    ];
    return items
      .map(
        ([label, key, val]) => `
      <div class="rgbw-row">
        <span class="kicker">${label}</span>
        <input type="range" min="0" max="255" step="1"
               value="${val}" data-action="rgb-channel" data-channel="${key}" />
        <span data-role="rgb-${key}-val">${val}</span>
      </div>
    `
      )
      .join("");
  }

  _wire() {
    const emit = () => {
      this._state.running = true;
      this._emitChange();
    };

    this._trackSlider(this.querySelector('[data-action="rgb-brightness"]'));
    this.querySelectorAll('[data-action="rgb-channel"]').forEach((s) => this._trackSlider(s));

    this.querySelector('[data-action="rgb-brightness"]')?.addEventListener("input", (e) => {
      const v = vClamp(parseInt(e.target.value, 10) || 0, 0, 255);
      this._state.brightness = v;
      this.querySelector('[data-role="br-val"]').textContent = String(toPercent(v));
      emit();
    });

    this.querySelector("vista-colorwheel")?.addEventListener("colorchange", (e) => {
      const { r, g, b } = e.detail || {};
      if (r == null) return;
      this._state.r = r;
      this._state.g = g;
      this._state.b = b;
      this._updateColorUI();
      emit();
    });

    this.querySelectorAll('[data-action="rgb-channel"]').forEach((slider) => {
      slider.addEventListener("input", (e) => {
        const key = e.target.getAttribute("data-channel");
        const v = vClamp(parseInt(e.target.value, 10) || 0, 0, 255);
        if (!["r", "g", "b"].includes(key)) return;
        this._state[key] = v;
        this.querySelector(`[data-role="rgb-${key}-val"]`).textContent = String(v);
        this._updateColorUI();
        emit();
      });
    });

    this.querySelectorAll('[data-action="rgb-preset"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const presetId = e.currentTarget.getAttribute("data-preset");
        const preset = PRESET_COLORS.find((p) => p.id === presetId);
        if (!preset) return;
        const [r, g, b] = preset.rgb;
        this._state.r = r;
        this._state.g = g;
        this._state.b = b;
        this.render();
        emit();
      });
    });
  }

  _updateColorUI() {
    const { r, g, b } = this._state;
    const read = this.querySelector('[data-role="color-read"]');
    if (read) read.textContent = `R ${r} G ${g} B ${b}`;
    ["r", "g", "b"].forEach((key) => {
      const label = this.querySelector(`[data-role="rgb-${key}-val"]`);
      if (label) label.textContent = String(this._state[key]);
      const slider = this.querySelector(`[data-action="rgb-channel"][data-channel="${key}"]`);
      if (slider) {
        slider.value = this._state[key];
        this._trackSlider(slider);
      }
    });
    const wheel = this.querySelector("vista-colorwheel");
    if (wheel && (r || g || b)) wheel.hue = rgbToHue(r, g, b);
  }
}
customElements.define("vista-channel-rgb", RGBWidget);

// ---------- RGBW widget ----------
class RGBWWidget extends ChannelWidgetBase {
  defaultState() {
    return { running: true, r: 0, g: 0, b: 0, w: 0, brightness: 255 };
  }

  render() {
    const s = this._state;
    const hue = rgbToHue(s.r, s.g, s.b);

    this.innerHTML = `
      <div class="card"><div class="card__pad">
        <div class="row">
          <div class="left">
            <div class="kicker">Brightness</div>
            <div class="value"><span data-role="br-val">${toPercent(s.brightness)}</span>%</div>
          </div>
          <span class="badge">RGBW</span>
        </div>
        <div class="mt-12 slider">
          <input type="range" min="0" max="255" step="1"
                 value="${s.brightness}" data-action="rgbw-brightness" />
        </div>
      </div></div>

      <div class="card"><div class="card__pad">
        <div class="kicker">Presets</div>
        <div class="mt-12 chip-grid">
          ${PRESET_COLORS.map(
            (p) => `
            <button class="chip compact" type="button"
                    data-action="rgbw-preset" data-preset="${p.id}">
              <span class="dot" style="background:${p.dot};"></span>
              ${p.label}
            </button>
          `
          ).join("")}
        </div>
      </div></div>

      <div class="card"><div class="card__pad">
        <div class="kicker">Color</div>
        <div class="mt-12">
          <vista-colorwheel hue="${hue}"></vista-colorwheel>
        </div>
        <div class="mt-12 row">
          <div class="left">
            <div class="kicker">Selected</div>
            <div class="value" data-role="color-read">R ${s.r} G ${s.g} B ${s.b} W ${s.w}</div>
          </div>
        </div>
        <div class="mt-12">
          ${this._renderRgbwSliders(s.r, s.g, s.b, s.w)}
        </div>
      </div></div>
    `;
    this._wire();
  }

  _renderRgbwSliders(r, g, b, w) {
    const items = [
      ["R", "r", r],
      ["G", "g", g],
      ["B", "b", b],
      ["W", "w", w],
    ];
    return items
      .map(
        ([label, key, val]) => `
      <div class="rgbw-row">
        <span class="kicker">${label}</span>
        <input type="range" min="0" max="255" step="1"
               value="${val}" data-action="rgbw-channel" data-channel="${key}" />
        <span data-role="rgbw-${key}-val">${val}</span>
      </div>
    `
      )
      .join("");
  }

  _wire() {
    const emit = () => {
      this._state.running = true;
      this._emitChange();
    };

    this._trackSlider(this.querySelector('[data-action="rgbw-brightness"]'));
    this.querySelectorAll('[data-action="rgbw-channel"]').forEach((s) => this._trackSlider(s));

    this.querySelector('[data-action="rgbw-brightness"]')?.addEventListener("input", (e) => {
      const v = vClamp(parseInt(e.target.value, 10) || 0, 0, 255);
      this._state.brightness = v;
      this.querySelector('[data-role="br-val"]').textContent = String(toPercent(v));
      emit();
    });

    this.querySelector("vista-colorwheel")?.addEventListener("colorchange", (e) => {
      const { r, g, b } = e.detail || {};
      if (r == null) return;
      this._state.r = r;
      this._state.g = g;
      this._state.b = b;
      this._updateColorUI();
      emit();
    });

    this.querySelectorAll('[data-action="rgbw-channel"]').forEach((slider) => {
      slider.addEventListener("input", (e) => {
        const key = e.target.getAttribute("data-channel");
        const v = vClamp(parseInt(e.target.value, 10) || 0, 0, 255);
        if (!["r", "g", "b", "w"].includes(key)) return;
        this._state[key] = v;
        this.querySelector(`[data-role="rgbw-${key}-val"]`).textContent = String(v);
        this._updateColorUI();
        emit();
      });
    });

    this.querySelectorAll('[data-action="rgbw-preset"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const presetId = e.currentTarget.getAttribute("data-preset");
        const preset = PRESET_COLORS.find((p) => p.id === presetId);
        if (!preset) return;
        const [r, g, b] = preset.rgb;
        const w = preset.w ?? 0;
        this._state.r = r;
        this._state.g = g;
        this._state.b = b;
        this._state.w = w;
        this.render();
        emit();
      });
    });
  }

  _updateColorUI() {
    const { r, g, b, w } = this._state;
    const read = this.querySelector('[data-role="color-read"]');
    if (read) read.textContent = `R ${r} G ${g} B ${b} W ${w}`;
    ["r", "g", "b", "w"].forEach((key) => {
      const label = this.querySelector(`[data-role="rgbw-${key}-val"]`);
      if (label) label.textContent = String(this._state[key]);
      const slider = this.querySelector(`[data-action="rgbw-channel"][data-channel="${key}"]`);
      if (slider) {
        slider.value = this._state[key];
        this._trackSlider(slider);
      }
    });
    const wheel = this.querySelector("vista-colorwheel");
    if (wheel && (r || g || b)) wheel.hue = rgbToHue(r, g, b);
  }
}
customElements.define("vista-channel-rgbw", RGBWWidget);

// ---------- ADDRESSABLE widget ----------
class AddressableWidget extends ChannelWidgetBase {
  defaultState() {
    return {
      running: true,
      mode: "solid",
      color: [0, 0, 0, 0],
      brightness: 128,
      speed: 128,
      animationSize: 64,
      reverse: false,

      physicalPixelCount: 0,
      maxPixelCount: 0,
      supportsAutoSense: false,
      autoSenseLength: false,
    };
  }

  render() {
    const s = this._state;

    const availableAnimations =
      vistaAddressableAnimations;

    const selectedAnimation =
      availableAnimations.find(
        (animation) =>
          animation.id === s.mode
      ) || null;

    const isAnimated =
      selectedAnimation
        ? selectedAnimation.id !== "solid"
        : s.mode !== "solid";

    const showReverse =
      !!selectedAnimation?.hasDirection;

    const showAnimationSize =
      !!selectedAnimation?.hasSize;

    const sizeControlPercent = toPercent(
      s.animationSize ?? 64
    );

    const minimumSizePercent =
      selectedAnimation?.hasSize
        ? selectedAnimation.minSizePercent
        : 0;

    const maximumSizePercent =
      selectedAnimation?.hasSize
        ? Math.max(
            minimumSizePercent,
            selectedAnimation.maxSizePercent
          )
        : 0;

    const effectiveSizePercent =
      minimumSizePercent +
      Math.round(
        (maximumSizePercent - minimumSizePercent) *
        sizeControlPercent /
        100
      );

    const c = Array.isArray(s.color)
      ? s.color
      : [0, 0, 0, 0];

    const [r, g, b, w] = [
      c[0] || 0,
      c[1] || 0,
      c[2] || 0,
      c[3] || 0,
    ];

    const hue = rgbToHue(r, g, b);

    this.innerHTML = `
      <div class="card"><div class="card__pad">
        <div class="row">
          <div class="left">
            <div class="kicker">Brightness</div>
            <div class="value"><span data-role="br-val">${toPercent(s.brightness)}</span>%</div>
          </div>
          <span class="badge">Addressable</span>
        </div>
        <div class="mt-12 slider">
          <input type="range" min="0" max="255" step="1"
                 value="${s.brightness}" data-action="addr-brightness" />
        </div>
      </div></div>

      <div class="card"><div class="card__pad">
        <div class="kicker">Presets</div>
        <div class="mt-12 chip-grid">
          ${PRESET_COLORS.map(
            (p) => `
            <button class="chip compact" type="button"
                    data-action="addr-preset" data-preset="${p.id}">
              <span class="dot" style="background:${p.dot};"></span>
              ${p.label}
            </button>
          `
          ).join("")}
        </div>
      </div></div>

      <div class="card"><div class="card__pad">
        <div class="kicker">Color</div>
        <div class="mt-12">
          <vista-colorwheel hue="${hue}"></vista-colorwheel>
        </div>
        <div class="mt-12 row">
          <div class="left">
            <div class="kicker">Selected</div>
            <div class="value" data-role="color-read">R ${r} G ${g} B ${b} W ${w}</div>
          </div>
        </div>
        <div class="mt-12">
          ${this._renderRgbwSliders(r, g, b, w)}
        </div>
      </div></div>

      <div class="card"><div class="card__pad">
        <div class="kicker">Animation</div>
        <div class="value" data-role="anim-label">${s.mode}</div>
        <div class="mt-12 chip-grid">
          ${
            availableAnimations.length
              ? availableAnimations
                  .map(
                    (animation) => `
                      <button
                        class="chip compact ${
                          s.mode === animation.id
                            ? "is-active"
                            : ""
                        }"
                        type="button"
                        data-action="addr-mode"
                        data-mode="${animation.id}"
                      >
                        ${animation.label || animation.id}
                      </button>
                    `
                  )
                  .join("")
              : `
                  <div class="hint">
                    No animations reported by the controller.
                  </div>
                `
          }
        </div>
      </div></div>

      <div class="card" data-role="speed-card" style="${isAnimated ? "" : "display:none;"}">
        <div class="card__pad">
          <div class="row">
            <div class="left">
              <div class="kicker">Speed</div>
              <div class="value"><span data-role="sp-val">${toPercent(s.speed)}</span>%</div>
            </div>
          </div>
          <div class="mt-12 slider">
            <input type="range" min="0" max="255" step="1"
                   value="${s.speed}" data-action="addr-speed" />
          </div>
        ${
          showReverse
            ? `
          <div class="mt-12 row">
            <span class="kicker">Reverse</span>
            <label class="toggle">
              <input type="checkbox" data-action="addr-reverse" ${s.reverse ? "checked" : ""} />
              <span class="track"></span><span class="thumb"></span>
            </label>
          </div>
        `
            : ""
        }
        </div>
      </div>
      <div class="card"
        data-role="animation-size-card"
        style="${
          showAnimationSize
            ? ""
            : "display:none;"
        }"
      >
        <div class="card__pad">
          <div class="row">
            <div class="left">
              <div class="kicker">Animation Size</div>
              <div class="value">
                <span data-role="animation-size-value">
                  ${effectiveSizePercent}
                </span>%
              </div>
            </div>
            <span class="badge gray">SIZE</span>
          </div>

          <div class="mt-12 slider">
            <input
              type="range"
              min="0"
              max="255"
              step="1"
              value="${s.animationSize ?? 64}"
              data-action="addressable-size"
            >
          </div>
        </div>
      </div>

      <div class="card"><div class="card__pad">
        <div class="row">
          <div class="left">
            <div class="kicker">Strip Length</div>
            <div class="value">${s.physicalPixelCount || 0} pixels</div>
          </div>

          <span class="badge ${s.supportsAutoSense && s.autoSenseLength ? "" : "gray"}">
            ${!s.supportsAutoSense ? "Auto Detect Not Supported" : s.autoSenseLength ? "Auto Detect On" : "Auto Detect Off"}
          </span>
        </div>

        ${
          s.supportsAutoSense && s.autoSenseLength
            ? `
              <button class="btn ghost mt-12" type="button"
                      data-action="addr-redetect-length">
                Re-detect Length
              </button>
            `
            : `
              <div class="mt-12">
                <input type="number"
                      min="1"
                      max="${s.maxPixelCount || 1}"
                      step="1"
                      value="${s.physicalPixelCount || 1}"
                      data-action="addr-physical-count" />
              </div>

              <div class="hint mt-12">
                Maximum supported length: ${s.maxPixelCount || 0} pixels
              </div>
            `
        }
      </div></div>
    `;
    this._wire();
  }

  _renderRgbwSliders(r, g, b, w) {
    const items = [
      ["R", "r", r],
      ["G", "g", g],
      ["B", "b", b],
      ["W", "w", w],
    ];
    return items
      .map(
        ([label, key, val]) => `
      <div class="rgbw-row">
        <span class="kicker">${label}</span>
        <input type="range" min="0" max="255" step="1"
               value="${val}" data-action="addr-rgbw" data-channel="${key}" />
        <span data-role="rgbw-${key}-val">${val}</span>
      </div>
    `
      )
      .join("");
  }

  _wire() {
    this._trackSlider(this.querySelector('[data-action="addr-brightness"]'));
    this._trackSlider(this.querySelector('[data-action="addr-speed"]'));
    this.querySelectorAll('[data-action="addr-rgbw"]').forEach((s) => this._trackSlider(s));
    const emit = () => {
      this._state.running = true;
      this._emitChange();
    };

    this.querySelector('[data-action="addr-brightness"]')?.addEventListener("input", (e) => {
      const v = vClamp(parseInt(e.target.value, 10) || 0, 0, 255);
      this._state.brightness = v;
      this.querySelector('[data-role="br-val"]').textContent = String(toPercent(v));
      emit();
    });

    this.querySelector('[data-action="addr-redetect-length"]')?.addEventListener("click", () => {
      this.dispatchEvent(
        new CustomEvent("redetectlength", {
          bubbles: true,
          composed: true,
        })
      );
    });

    this.querySelector('[data-action="addr-physical-count"]')?.addEventListener("change", (e) => {
      const max = this._state.maxPixelCount || 1;
      const value = vClamp(parseInt(e.target.value, 10) || 1, 1, max);

      e.target.value = String(value);
      this._state.physicalPixelCount = value;

      this.dispatchEvent(
        new CustomEvent("physicalpixelcountchange", {
          bubbles: true,
          composed: true,
          detail: { physicalPixelCount: value },
        })
      );
    });

    this.querySelectorAll('[data-action="addr-preset"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const presetId = e.currentTarget.getAttribute("data-preset");
        const preset = PRESET_COLORS.find((p) => p.id === presetId);
        if (!preset) return;
        const [r, g, b] = preset.rgb;
        const w = preset.w ?? 0;
        this._state.color = [r, g, b, w];
        this._updateColorUI();
        emit();
      });
    });

    this.querySelector('[data-action="addr-speed"]')?.addEventListener("input", (e) => {
      const v = vClamp(parseInt(e.target.value, 10) || 0, 0, 255);
      this._state.speed = v;
      this.querySelector('[data-role="sp-val"]').textContent = String(toPercent(v));
      emit();
    });

    const sizeInput = this.querySelector(
      '[data-action="addressable-size"]'
    );

    if (sizeInput) {
      this._trackSlider(sizeInput, 255);

      sizeInput.addEventListener("input", (event) => {
        const value = vClamp(
          parseInt(event.target.value, 10) || 0,
          0,
          255
        );

        this._state.animationSize = value;

        const selectedAnimation =
          vistaAddressableAnimations.find(
            (animation) =>
              animation.id === this._state.mode
          ) || null;

        const sizeControlPercent =
          toPercent(value);

        const minimumSizePercent =
          selectedAnimation?.hasSize
            ? selectedAnimation.minSizePercent
            : 0;

        const maximumSizePercent =
          selectedAnimation?.hasSize
            ? Math.max(
                minimumSizePercent,
                selectedAnimation.maxSizePercent
              )
            : 0;

        const effectiveSizePercent =
          minimumSizePercent +
          Math.round(
            (
              maximumSizePercent -
              minimumSizePercent
            ) *
            sizeControlPercent /
            100
          );

        const sizeLabel = this.querySelector(
          '[data-role="animation-size-value"]'
        );

        if (sizeLabel) {
          sizeLabel.textContent =
            String(effectiveSizePercent);
        }

        emit();
      });
    }

    this.querySelector('[data-action="addr-reverse"]')?.addEventListener("change", (e) => {
      this._state.reverse = !!e.target.checked;
      emit();
    });

    this
      .querySelectorAll(
        '[data-action="addr-mode"]'
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          (event) => {
            const mode =
              event.currentTarget.getAttribute(
                "data-mode"
              );

            if (!mode) {
              return;
            }

            this._state.mode = mode;
            this._state.running = true;

            this.render();
            emit();
          }
        );
      });

    this.querySelector("vista-colorwheel")?.addEventListener("colorchange", (e) => {
      const { r, g, b } = e.detail || {};
      if (r == null) return;
      const w = (this._state.color || [])[3] || 0;
      this._state.color = [r, g, b, w];
      this._updateColorUI();
      emit();
    });

    this.querySelectorAll('[data-action="addr-rgbw"]').forEach((slider) => {
      slider.addEventListener("input", (e) => {
        const key = e.target.getAttribute("data-channel");
        const v = vClamp(parseInt(e.target.value, 10) || 0, 0, 255);
        const idx = { r: 0, g: 1, b: 2, w: 3 }[key];
        if (idx == null) return;
        if (!Array.isArray(this._state.color)) this._state.color = [0, 0, 0, 0];
        this._state.color[idx] = v;
        this.querySelector(`[data-role="rgbw-${key}-val"]`).textContent = String(v);
        this._updateColorUI();
        emit();
      });
    });
  }

  _updateColorUI() {
    const c = this._state.color || [0, 0, 0, 0];
    const [r, g, b, w] = [c[0] || 0, c[1] || 0, c[2] || 0, c[3] || 0];
    const read = this.querySelector('[data-role="color-read"]');
    if (read) read.textContent = `R ${r} G ${g} B ${b} W ${w}`;
    ["r", "g", "b", "w"].forEach((key, i) => {
      const label = this.querySelector(`[data-role="rgbw-${key}-val"]`);
      if (label) label.textContent = String(this._state.color[i]);
      const slider = this.querySelector(`[data-action="addr-rgbw"][data-channel="${key}"]`);
      if (slider) {
        slider.value = this._state.color[i];
        this._trackSlider(slider);
      }
    });
    const wheel = this.querySelector("vista-colorwheel");
    if (wheel && (r || g || b)) wheel.hue = rgbToHue(r, g, b);
  }
}
customElements.define("vista-channel-addressable", AddressableWidget);

// ---------- RAW PWM widget ----------
// Firmware stores raw PWM duty as a percentage from 0 to 100.
class PWMWidget extends ChannelWidgetBase {
  defaultState() {
    return { running: true, duty: 0, freq: 1000, resolution: 12 };
  }
  render() {
    const s = this._state;
    const duty = vClamp(Number(s.duty) || 0, 0, 100);
    this.innerHTML = `
      <div class="card"><div class="card__pad">
        <div class="row"><div class="left"><div class="kicker">Duty Cycle</div><div class="value"><span data-role="duty-val">${duty}</span>%</div></div><span class="badge">PWM</span></div>
        <div class="mt-12 slider"><input type="range" min="0" max="100" step="1" value="${duty}" data-action="pwm-duty" /></div>
      </div></div>
      <div class="card card--flat"><div class="card__pad">
        <div class="kicker">Hardware</div>
        <div class="mt-12"><div class="row"><div class="kicker">Shared Frequency</div><div class="value">${Number(s.freq) || 1000} Hz</div></div><div class="row"><div class="kicker">Resolution</div><div class="value">${Number(s.resolution) || 12}-bit</div></div></div>
      </div></div>`;
    const slider = this.querySelector('[data-action="pwm-duty"]');
    this._trackSlider(slider, 100);
    slider?.addEventListener("input", (event) => {
      this._state.duty = vClamp(parseInt(event.target.value, 10) || 0, 0, 100);
      this._state.running = true;
      this.querySelector('[data-role="duty-val"]').textContent = String(this._state.duty);
      this._emitChange();
    });
  }
}
customElements.define("vista-channel-pwm", PWMWidget);

// ---------- Registry + dispatcher ----------
const CHANNEL_TYPES = {
  dim: { widget: "vista-channel-dim", label: "Dimming" },
  rgb: { widget: "vista-channel-rgb", label: "RGB" },
  rgbw: { widget: "vista-channel-rgbw", label: "RGBW" },
  cct: { widget: "vista-channel-cct", label: "CCT" },
  pwm: { widget: "vista-channel-pwm", label: "PWM" },
  rawPWM: { widget: "vista-channel-pwm", label: "Raw PWM" },
  addressable: { widget: "vista-channel-addressable", label: "Addressable" },
};

class VistaChannelCard extends HTMLElement {
  static get observedAttributes() {
    return ["channel-id", "type"];
  }

  constructor() {
    super();
    this._widget = null;
    this._pendingState = null;
  }

  attributeChangedCallback() {
    if (this.isConnected) this._render();
  }
  connectedCallback() {
    this._render();
  }

  setChannelState(state) {
    this._pendingState = state || {};
    if (this._widget) this._widget.setState(this._pendingState);
  }

  getChannelState() {
    return this._widget?.getState() || null;
  }

  _render() {
    const type = this.getAttribute("type");
    const entry = CHANNEL_TYPES[type];

    if (!entry) {
      this.innerHTML = `<div class="card"><div class="card__pad">
        <div class="kicker">Unknown type</div>
        <div class="value">No widget for "${type}"</div>
      </div></div>`;
      this._widget = null;
      return;
    }

    this.innerHTML = `<${entry.widget}></${entry.widget}>`;
    this._widget = this.querySelector(entry.widget);
    if (this._widget && this._pendingState) {
      this._widget.setState(this._pendingState);
    }
  }
}
customElements.define("vista-channel-card", VistaChannelCard);
