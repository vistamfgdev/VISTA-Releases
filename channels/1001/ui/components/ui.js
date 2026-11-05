// =========================================================
// VISTA Controller UI — Iteration 1 (Static Skeleton)
// components/ui.js
// - Small Web Components to keep UI consistent without a framework
// - Currently: <vista-select> (touch-friendly dropdown)
// =========================================================

console.log("[VISTA] ui.js loaded");

class VistaSelect extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this._onChange = this._onChange.bind(this);
  }

  connectedCallback() {
    this.render();
    this._hydrateOptions();
    this._wire();
  }

  disconnectedCallback() {
    const sel = this.shadowRoot?.querySelector("select");
    sel?.removeEventListener("change", this._onChange);
  }

  static get observedAttributes() {
    return ["disabled", "value", "aria-label"];
  }

  attributeChangedCallback() {
    // Keep it simple: rerender when key attributes change
    if (this.isConnected) {
      const currentValue = this.value;
      this.render();
      this._hydrateOptions();
      this.value = currentValue;
      this._wire();
    }
  }

  get value() {
    return this.shadowRoot?.querySelector("select")?.value ?? "";
  }
  set value(v) {
    const sel = this.shadowRoot?.querySelector("select");
    if (sel) sel.value = v;
  }

  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(v) {
    if (v) this.setAttribute("disabled", "");
    else this.removeAttribute("disabled");
  }

  _wire() {
    const sel = this.shadowRoot.querySelector("select");
    sel.addEventListener("change", this._onChange);
  }

  _onChange(e) {
    // Re-dispatch a change event from <vista-select> so app.js can listen normally
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  _hydrateOptions() {
    // Move/clone any <option> elements from light DOM into the internal <select>
    const sel = this.shadowRoot.querySelector("select");
    if (!sel) return;

    // Clear any old options
    sel.innerHTML = "";

    // Collect options in light DOM
    const lightOptions = Array.from(this.querySelectorAll("option"));
    if (lightOptions.length === 0) {
      // Safety default: if none exist, add a placeholder option
      const opt = document.createElement("option");
      opt.textContent = "Select…";
      opt.value = "";
      sel.appendChild(opt);
      return;
    }

    // Clone options into shadow select
    lightOptions.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.value || o.textContent || "";
      opt.textContent = o.textContent || "";
      sel.appendChild(opt);
    });

    // If host has a value attribute, apply it
    if (this.hasAttribute("value")) {
      sel.value = this.getAttribute("value");
    }

    // Disabled attribute
    sel.disabled = this.disabled;

    // aria-label pass-through
    const aria = this.getAttribute("aria-label");
    if (aria) sel.setAttribute("aria-label", aria);
  }

  render() {
    const isDisabled = this.disabled ? "disabled" : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host{ display:block; width:100%; }

        .wrap{
          position: relative;
          width: 100%;
        }

        select{
          width: 100%;
          height: var(--tap, 48px);
          padding: 0 44px 0 14px;
          border-radius: 16px;
          border: 1px solid var(--stroke, rgba(255,255,255,.10));
          background: var(--surface-2, #172232);
          color: var(--text, rgba(255,255,255,.92));
          font-weight: 800;
          letter-spacing: .2px;
          outline: none;
          -webkit-appearance: none;
          appearance: none;
          box-shadow: var(--shadow-inset, inset 0 0 0 1px var(--stroke));
        }

        select:focus-visible{
          outline: 3px solid var(--focus, rgba(0,156,222,.45));
          outline-offset: 2px;
        }

        select:disabled{
          opacity: .55;
        }

        /* Chevron */
        .chev{
          pointer-events: none;
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-2, rgba(255,255,255,.70));
          width: 18px;
          height: 18px;
        }
      </style>

      <div class="wrap">
        <select ${isDisabled}></select>
        <svg class="chev" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M6 7l3 3 3-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    `;
  }
}

customElements.define("vista-select", VistaSelect);
``;
