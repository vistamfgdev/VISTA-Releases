// =========================================================
// VISTA Controller UI — app.js (Static + Web Components)
// Single source of truth: this.data
// UI-only state: this.ui
// All channel edits flow through commitChannelEdit().
// =========================================================
console.log("[VISTA] app.js loaded");

const UI_VERSION = "0.1.1";

// ---------- Tunables ----------
const CONFIG = {
  liveThrottleMs: 80, // debounce window for live PUTs during slider drags
  initialLoadTimeoutMs: 8000, // boot-time API timeout
  toastDurationMs: 2500,
  kelvinMin: 2700,
  kelvinMax: 6500,
  channelMaxLeds: 300,
  defaultTheme: "dark",
};

// ---------- Feature flags ----------
const FEATURES = {
  control: true,
  builder: true,
  remote: true, // placeholder panel
  menu: true,
  ota: true,
  wifi: true,
};

// ---------- API layer ----------
async function withTimeout(fn, ms = 1500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

async function apiGetJson(path, ms = 1500) {
  return withTimeout(async (signal) => {
    const res = await fetch(path, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal,
    });
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return await res.json();
  }, ms);
}

async function apiPutJson(path, obj, ms = 1500) {
  return withTimeout(async (signal) => {
    const res = await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(obj),
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`PUT ${path} failed: ${res.status} ${text}`);
    }
    const text = await res.text().catch(() => "");
    return text ? JSON.parse(text) : { ok: true };
  }, ms);
}

async function apiPatchJson(path, obj, ms = 1500) {
  return withTimeout(async (signal) => {
    const res = await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(obj),
      signal,
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status} ${text}`);
    return text ? JSON.parse(text) : { ok: true };
  }, ms);
}

async function apiPostJson(path, obj = null, ms = 1500) {
  return withTimeout(async (signal) => {
    const res = await fetch(path, {
      method: "POST",
      headers: obj ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
      body: obj ? JSON.stringify(obj) : undefined,
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`POST ${path} failed: ${res.status} ${text}`);
    }
    const text = await res.text().catch(() => "");
    return text ? JSON.parse(text) : { ok: true };
  }, ms);
}

async function apiPostForm(path, formData, extraHeaders = {}, ms = 30000) {
  return withTimeout(async (signal) => {
    const res = await fetch(path, {
      method: "POST",
      headers: extraHeaders,
      body: formData,
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`POST ${path} failed: ${res.status} ${text}`);
    }
    const text = await res.text().catch(() => "");
    return text ? JSON.parse(text) : { ok: true };
  }, ms);
}

const ENDPOINTS = {
  info: "/api/info",
  channel: "/api/channel",
  liveUpdate: "/api/liveUpdate",
  programs: "/api/programs",
  programPreview: "/api/programPreview",
  programControl: "/api/programControl",
  config: "/api/config",
  runtime: "/api/runtime",
  configExport: "/api/exportconfig",
  configImport: "/api/importconfig",
  status: "/api/status",
  scan: "/api/wifi/scan",
  reboot: "/api/system/reboot",
  connect: "/api/wifi/connect",
  otafirmware: "/api/ota/firmware",
  otacheck: "/api/ota/check",
  otaui: "/api/ota/ui",
  animations: "/api/animations",
  meshPool: "/api/mesh/pool",
};
const API = {
  getInfo: () => apiGetJson(ENDPOINTS.info),
  getChannels: () => apiGetJson(ENDPOINTS.channel),
  putChannels: (data) => apiPutJson(ENDPOINTS.channel, data),
  liveBegin: (channelId) => apiPatchJson(ENDPOINTS.liveUpdate, { action: "begin", channelId }),
  livePreview: (channelId, segmentId, state) => apiPatchJson(ENDPOINTS.liveUpdate, { action: "preview", channelId, segmentId, state }),
  liveSave: (channelId) => apiPatchJson(ENDPOINTS.liveUpdate, { action: "save", channelId }),
  liveCancel: (channelId) => apiPatchJson(ENDPOINTS.liveUpdate, { action: "cancel", channelId }),
  redetectLength: (channelId) => apiPatchJson(ENDPOINTS.liveUpdate, { action: "redetectLength", channelId }),
  setPhysicalPixelCount: (channelId, physicalPixelCount) => apiPatchJson(ENDPOINTS.liveUpdate, { action: "setPhysicalPixelCount", channelId, physicalPixelCount }),
  createSegment: (channelId, segmentId, name, start, end, state) => apiPatchJson(ENDPOINTS.liveUpdate, { action: "createSegment", channelId, segmentId, name, start, end, state }, 10000),
  updateSegment: (channelId, segmentId, name, start, end, state) => apiPatchJson(ENDPOINTS.liveUpdate, { action: "updateSegment", channelId, segmentId, name, start, end, state }, 10000),
  deleteSegment: (channelId, segmentId) => apiPatchJson(ENDPOINTS.liveUpdate, { action: "deleteSegment", channelId, segmentId }, 10000),
  setChannelRunning: (channelId, running) => apiPatchJson(ENDPOINTS.liveUpdate, { action: "setChannelRunning", channelId, running }, 10000),
  getPrograms: () => apiGetJson(ENDPOINTS.programs),
  putPrograms: (data) => apiPutJson(ENDPOINTS.programs, data, 10000),
  patchPrograms: (payload) => apiPatchJson(ENDPOINTS.programs, payload, 10000),
  programPreview: (payload) => apiPatchJson(ENDPOINTS.programPreview, payload, 10000),
  programControl: (action, programId) => apiPostJson(ENDPOINTS.programControl, { action, programId }),
  getConfig: () => apiGetJson(ENDPOINTS.config),
  getConfigRaw: () => apiGetJson(ENDPOINTS.configExport),
  putConfig: (config) => apiPutJson(ENDPOINTS.config, config),
  getRuntime: () => apiGetJson(ENDPOINTS.runtime),
  getStatus: () => apiGetJson(ENDPOINTS.status),
  scanWifi: () => apiPostJson(ENDPOINTS.scan, null, 10000),
  reboot: () => apiPostJson(ENDPOINTS.reboot, null, 2000),
  wifiConnect: (ssid, password) => apiPostJson(ENDPOINTS.connect, { ssid, password }, 15000),
  otaFirmware: (file) => {const fd = new FormData(); fd.append("firmware", file); return apiPostForm(ENDPOINTS.otafirmware, fd, {}, 120000);},
  otaUI: (file, path) => {const fd = new FormData(); fd.append("file", file, file.name); return apiPostForm(ENDPOINTS.otaui, fd, { "X-File-Path": path }, 60000);},
  getAnimations: () => apiGetJson(ENDPOINTS.animations),
};

// ---------- Device/UI data adapters ----------
const clone = (value) => JSON.parse(JSON.stringify(value ?? {}));
const pctToByte = (value) => Math.round(Math.max(0, Math.min(100, Number(value) || 0)) * 2.55);
const byteToPct = (value) => Math.round(Math.max(0, Math.min(255, Number(value) || 0)) / 2.55);

function firstSegment(route = {}) {
  const segmentId = Object.keys(route).find((key) => key !== "active");
  return segmentId ? { segmentId, segment: route[segmentId] || {} } : { segmentId: "seg_1", segment: { name: "", state: {} } };
}

function allSegments(route = {}, type = "", channelConfig = {}) {
  return Object.entries(route)
    .filter(([key, value]) => key !== "active" && value && typeof value === "object")
    .map(([segmentId, segment]) => {
      const deviceState = clone(segment.state || {});
      return {
        segmentId,
        name: segment.name || segmentId,
        deviceState,
        state: deviceStateToWidget(type, deviceState, channelConfig),
      };
    });
}

function deviceStateToWidget(type, state = {}, channelConfig = {}) {
  const color = state.color || {};
  const detectedCount = channelConfig.params?.physicalPixelCount || channelConfig.params?.maxPixelCount || 1;

  const start = Math.max(0, Number(state.start) || 0);
  const end = Math.max(start, Number(state.end ?? detectedCount - 1));
  const segmentPixels = end - start + 1;
  if (type === "addressable") {
    return {
      running: state.running !== false,
      mode: state.animation || "solid",
      color: [pctToByte(color.r), pctToByte(color.g), pctToByte(color.b), pctToByte(color.w)],
      brightness: pctToByte(state.brightness),
      speed: pctToByte(state.speed),
      animationSize: Math.round(
        Math.max(1, Math.min(100, Number(state.animationSize) || 25)) * 2.55),
      reverse: !!state.reverse,
      physicalPixelCount: Number(channelConfig.params?.physicalPixelCount) || 0,
      maxPixelCount: Number(channelConfig.params?.maxPixelCount) || 0,
      supportsAutoSense: !!channelConfig.params?.supportsAutoSense,
      autoSenseLength: !!channelConfig.params?.autoSenseLength,
    };
  }
  if (type === "rgb") return { running: state.running !== false, r: pctToByte(color.r), g: pctToByte(color.g), b: pctToByte(color.b), brightness: pctToByte(state.brightness) };
  if (type === "rgbw") return { running: state.running !== false, r: pctToByte(color.r), g: pctToByte(color.g), b: pctToByte(color.b), w: pctToByte(color.w), brightness: pctToByte(state.brightness) };
  if (type === "cct") return { running: state.running !== false, warm: pctToByte(color.warm), cool: pctToByte(color.cool), brightness: pctToByte(state.brightness) };
  if (type === "dim") return { running: state.running !== false, level: pctToByte(state.level), brightness: pctToByte(state.brightness ?? 100) };
  if (type === "rawPWM" || type === "pwm") return { running: state.running !== false, duty: Math.max(0, Math.min(100, Number(state.duty) || 0)), freq: state.freq || channelConfig.params?.freq || 1000, resolution: state.resolution || channelConfig.params?.resolution || 12 };
  return clone(state);
}

function widgetStateToDevice(type, widget = {}, previous = {}) {
  const next = clone(previous);
  if (widget.running !== undefined) next.running = !!widget.running;
  if (widget.brightness !== undefined) next.brightness = byteToPct(widget.brightness);
  if (type === "dim" && widget.level !== undefined) next.level = byteToPct(widget.level);
  if (type === "rawPWM" || type === "pwm") {
    if (widget.duty !== undefined) next.duty = Math.max(0, Math.min(100, Number(widget.duty) || 0));
    if (widget.freq !== undefined) next.freq = Math.max(0, Number(widget.freq) || 0);
    if (widget.resolution !== undefined) next.resolution = Math.max(0, Number(widget.resolution) || 0);
  }
  next.color = { ...(previous.color || {}) };
  for (const key of ["r", "g", "b", "w", "warm", "cool"]) if (widget[key] !== undefined) next.color[key] = byteToPct(widget[key]);
  if (type === "addressable") {
    const c = Array.isArray(widget.color) ? widget.color : [0, 0, 0, 0];
    next.color = { ...(previous.color || {}), r: byteToPct(c[0]), g: byteToPct(c[1]), b: byteToPct(c[2]), w: byteToPct(c[3]) };
    if (widget.mode !== undefined) next.animation = widget.mode;
    if (widget.speed !== undefined) next.speed = byteToPct(widget.speed);
    if (widget.animationSize !== undefined) {next.animationSize = Math.max(1,byteToPct(widget.animationSize));}
    if (widget.reverse !== undefined) next.reverse = !!widget.reverse;
  }
  return next;
}

function normalizeChannels(config = {}, channelsDoc = {}) {
  const definitions = Array.isArray(config.channels) ? config.channels : [];

  return definitions.map((definition) => {
    const route = channelsDoc[definition.id] || {};
    const segments = allSegments(route, definition.type, definition);
    const selected = segments[0] || {
      segmentId: "seg_1",
      name: "Full Strip",
      deviceState: {},
      state: deviceStateToWidget(definition.type, {}, definition),
    };

    return {
      ...clone(definition),
      id: definition.id,
      type: definition.type,
      routeActive: !!route.active,
      segments,
      segmentId: selected.segmentId,
      segmentName: selected.name,
      deviceState: clone(selected.deviceState),
      state: clone(selected.state),
    };
  });
}

const DATA_ACTIONS = {};

const icons = {
  menu: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  back: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M10.8 4.2L6 9l4.8 4.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  chev: `<svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M6 7l3 3 3-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  sun: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  moon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  close: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
};

// =========================================================
// VistaApp — main shell
// =========================================================
class VistaApp extends HTMLElement {
  constructor() {
    super();

    // Single source of truth: device data
    this.data = {
      device: {},
      channels: [],
      // presets: [],
      // builder: { version: 1, bindings: {}, inputs: [] },
      programs: { $schema: 1, version: 1, inputs: [], scenes: {}, programs: {} },
      config: {},
      animations: [], 
      status: {},
    };

    // UI-only state
    this.ui = {
      theme: this._loadTheme() || CONFIG.defaultTheme,
      mode: "control",
      previousMode: null,
      activeChannelId: null,
      preEditSnapshot: null,
      liveEditBegun: false,
      activeSegmentId: null,
      segmentModal: null,
      segmentSaving: false,
      programSegmentModal: null,
      programSegmentSaving: false,
      menuOpen: false,
      menuStack: ["main"],
      builderOpen: { presetId: null, side: "" },
      editingPresetTarget: null,
      wifiScanResults: null,
      wifiSelectedSSID: null,
      wifiPassword: "",
      wifiConnecting: false,
      wifiRedirectIP: null,
      otaStatus: null,
      otaError: null,
      updateCheck: null,
      ready: false,
      fatalError: null,
      // Preset editor modal state
      presetModal: null,
      // Shape when active:
      // {
      //   mode: "edit" | "create" | "save-to-preset" | "edit-target",
      //   draft: { id, name, targets: [{channelId, state}, ...] },
      //   editingTargetIndex: null | number,   // when mode === "edit-target"
      //   originalId: null | string,           // for edits: which preset this draft came from
      //   touchedChannels: new Set(),          // channels whose hardware was modified
      // }

      // Swipe drawer state per preset card
      presetSwipe: {},
      // Shape: { [presetId]: "left" | "right" | null }
    };

    // Live-send throttling
    this._pendingCommits = new Map();
    this._commitTimers = new Map();

    // Render scheduling (coalesce multiple setData calls into one render)
    this._renderScheduled = false;

    // Bind delegated handlers once
    this.onClick = this.onClick.bind(this);
    this.onChange = this.onChange.bind(this);
    this.onInput = this.onInput.bind(this);
    this.onChannelChange = this.onChannelChange.bind(this);
    this.onRedetectLength = this.onRedetectLength.bind(this);
    this.onPhysicalPixelCountChange = this.onPhysicalPixelCountChange.bind(this);
  }

  // ---------------- Lifecycle ----------------
  async connectedCallback() {
    this._applyTheme();
    this._renderLoading();
    try {
      await this.reloadFromDevice();
      this.ui.ready = true;
      this.render();
      this._wireEvents();
      this.addEventListener("toast", (e) => {
        const msg = e.detail?.message;
        if (msg) this._toast(msg);
      });
    } catch (err) {
      console.error("[VISTA] init failed", err);
      this.ui.fatalError = String(err?.message || err);
      this._renderFatal(this.ui.fatalError);
    }
  }

  // Register event listeners to detect actions
  _wireEvents() {
    this.addEventListener("click", this.onClick);
    this.addEventListener("change", this.onChange);
    this.addEventListener("input", this.onInput);
    this.addEventListener("channelchange", this.onChannelChange);
    this.addEventListener("redetectlength", this.onRedetectLength);
    this.addEventListener("physicalpixelcountchange", this.onPhysicalPixelCountChange);
  }

  // ---------------- Data operations ----------------
  /**
   * Update nested data path. Triggers a re-render.
   * setData("channels.0.state.level", 100)
   */
  setData(path, value) {
    const parts = path.split(".");
    let obj = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      const next = parts[i + 1];
      if (obj[k] == null) obj[k] = /^\d+$/.test(next) ? [] : {};
      obj = obj[k];
    }
    obj[parts[parts.length - 1]] = value;
    this._scheduleRender();
  }

  _getActiveSegment(channel) {
    if (!channel) return null;
    const wantedId = this.ui.activeSegmentId || channel.segmentId;
    return channel.segments?.find((segment) => segment.segmentId === wantedId) || channel.segments?.[0] || null;
  }

  _selectSegment(channel, segmentId) {
    const segment = channel?.segments?.find((item) => item.segmentId === segmentId);
    if (!channel || !segment) return false;

    this.ui.activeSegmentId = segment.segmentId;
    channel.segmentId = segment.segmentId;
    channel.segmentName = segment.name;
    channel.deviceState = clone(segment.deviceState);
    channel.state = clone(segment.state);
    return true;
  }

  /**
   * Edit a channel. Optimistic local update + PUT.
   * If persist=false, debounced. If persist=true, immediate.
   * Rolls back on persist=true failure; ignores persist=false failures (transient).
   */
  async commitChannelEdit(id, widgetState, opts = {}) {
    const persist = !!opts.persist;
    const ch = this.data.channels.find((item) => item.id === id);
    if (!ch) return;

    ch.state = { ...ch.state, ...widgetState };
    ch.deviceState = widgetStateToDevice(ch.type, ch.state, ch.deviceState);

    const activeSegment = this._getActiveSegment(ch);
    if (activeSegment) {
      activeSegment.state = clone(ch.state);
      activeSegment.deviceState = clone(ch.deviceState);
    }

    if (this.ui.activeChannelId !== id) this._scheduleRender();

    if (!this.ui.liveEditBegun) {
      await API.liveBegin(id);
      this.ui.liveEditBegun = true;
    }

    const segmentId = this.ui.activeSegmentId || ch.segmentId || "seg_1";
    const sendPreview = async () => API.livePreview(id, segmentId, ch.deviceState);

    if (persist) {
      const timer = this._commitTimers.get(id);
      if (timer) clearTimeout(timer);
      this._commitTimers.delete(id);
      this._pendingCommits.delete(id);

      try {
        await sendPreview();
        await API.liveSave(id);
        ch.preview = false;
        this.ui.liveEditBegun = false;
        this.ui.preEditSnapshot = clone(ch);
        this._toast("Saved");
      } catch (err) {
        console.error("[VISTA] channel save failed", err);
        this._toast("Save failed");
        throw err;
      }
      return;
    }

    this._pendingCommits.set(id, {
      segmentId,
      state: clone(ch.deviceState),
    });

    if (this._commitTimers.has(id)) return;

    const timer = setTimeout(
      () => {
        const pending = this._pendingCommits.get(id);
        this._pendingCommits.delete(id);
        this._commitTimers.delete(id);
        if (!pending) return;

        API.livePreview(id, pending.segmentId, pending.state).catch((err) => console.warn("[VISTA] live preview failed", err));
      },
      Number(this.data.config.liveThrottleMs || CONFIG.liveThrottleMs)
    );

    this._commitTimers.set(id, timer);
  }
  /** Full reload from device. */
  async reloadFromDevice() {
    const [
      info,
      channelsDoc,
      programsDoc,
      config,
      status,
      animationResponse,
    ] = await Promise.all([
      API.getInfo().catch(() => ({})),
      API.getChannels().catch(() => ({})),
      API.getPrograms().catch(() => ({
        $schema: 1,
        version: 1,
        inputs: [],
        scenes: {},
        programs: {},
      })),
      API.getConfig().catch(() => ({})),
      API.getStatus().catch(() => ({})),
      API.getAnimations().catch(() => ({animations: [], })),
    ]);

    this.data.device = info?.device || {};
    this.data.config = config || {};

    this.data.channels = normalizeChannels(
      this.data.config,
      channelsDoc || {}
    );

    this.data.programs = programsDoc || {
      $schema: 1,
      version: 1,
      inputs: [],
      scenes: {},
      programs: {},
    };

    this.data.scenes = this.data.programs.scenes || {};
    this.data.programRules = this.data.programs.programs || {};
    this.data.programInputs = this.data.programs.inputs || [];
    this.data.status = status || {};
    this.data.animations = Array.isArray(
      animationResponse?.animations
    )
      ? animationResponse.animations
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

    window.setVistaAddressableAnimations?.(
      this.data.animations
    );
  }

  async refreshChannel(id) {
    await this._refreshAllChannels();
    const fresh = this.data.channels.find((item) => item.id === id);
    if (fresh && this.ui.activeChannelId === id) this.ui.preEditSnapshot = clone(fresh);
  }
  // ---------------- Render scheduling ----------------
  _scheduleRender() {
    if (this._renderScheduled) return;
    this._renderScheduled = true;
    requestAnimationFrame(() => {
      this._renderScheduled = false;
      if (this.ui.ready) this.render();
    });
  }

  // ---------------- Render ----------------
  render() {
    if (this.ui.fatalError) {
      this._renderFatal(this.ui.fatalError);
      return;
    }
    if (!this.ui.ready) {
      this._renderLoading();
      return;
    }

    this.innerHTML = this._renderShell();

    // Seed channel card widget if we're on a detail view
    const card = this.querySelector('[data-role="channel-card"]');
    if (card) {
      const ch = this.data.channels.find((c) => c.id === this.ui.activeChannelId);
      if (ch) {
        const activeSegment = this._getActiveSegment(ch);
        const widgetState = activeSegment ? activeSegment.state : ch.state || {};

        card.setChannelState({
          ...widgetState,
          physicalPixelCount: Number(ch.params?.physicalPixelCount) || 0,
          maxPixelCount: Number(ch.params?.maxPixelCount) || 0,
          supportsAutoSense: !!ch.params?.supportsAutoSense,
          autoSenseLength: !!ch.params?.autoSenseLength,
        });
      }
    }
    const targetCard = this.querySelector('[data-role="preset-target-card"]');
    if (targetCard && typeof targetCard.setChannelState === "function") {
      const modal = this.ui.presetModal;
      if (modal?.mode === "edit-target") {
        const target = modal.draft.targets[modal.editingTargetIndex];
        const segment = this._getEditingPresetSegment();
        const channel = this.data.channels.find((item) => item.id === target?.channelId);
        if (segment && channel) targetCard.setChannelState({
          ...segment.state, running: true,
          physicalPixelCount: Number(channel.params?.physicalPixelCount) || 0,
          maxPixelCount: Number(channel.params?.maxPixelCount) || 0,
          supportsAutoSense: !!channel.params?.supportsAutoSense,
          autoSenseLength: !!channel.params?.autoSenseLength,
        });
      }
    }
  }

  _renderShell() {
    const activeChannel = this.ui.activeChannelId ? this.data.channels.find((c) => c.id === this.ui.activeChannelId) : null;

    return `
          <div class="app safe-bottom">
          ${this._renderHeader(activeChannel)}
          <div class="content">
              <div class="panel is-active">
              <div class="scroll">
                  ${this._renderMode(activeChannel)}
              </div>
              </div>
          </div>
          ${this._renderBottomNav(activeChannel)}
          ${this._renderMenuOverlay()}
          ${this._renderModal()}
          </div>
      `;
  }

  _renderHeader(activeChannel) {
    const menuIcon = this.ui.menuOpen ? icons.close : icons.menu;
    const themeIcon = this.ui.theme === "dark" ? icons.sun : icons.moon;

    return `
      <header class="topbar safe-top">
        <div class="topbar__row">
          <button class="icon-btn" data-action="toggle-menu" aria-label="${this.ui.menuOpen ? "Close menu" : "Open menu"}">${menuIcon}</button>
          <img class="topbar__logo"
              src="${this.ui.theme === "dark" ? "/Vista-Logo-Thumbnail-White.png" : "/Vista-Logo-Thumbnail-Dark.png"}"
              alt="Vista"
              draggable="false">
          <button class="icon-btn" data-action="toggle-theme" aria-label="Theme">${themeIcon}</button>
        </div>
      </header>
    `;
  }

  _renderBottomNav(activeChannel) {
    if (this.ui.menuOpen) return "";

    if (activeChannel) {
      return `
              <nav class="bottomnav">
              <div class="tabs">
                  <button class="tab-action" type="button" data-action="back-to-channels">Back</button>
                  <button class="tab-action" type="button" data-action="save-to-preset">Save Preset</button>
                  <button class="tab-action primary" type="button" data-action="confirm-channel">Confirm</button>
              </div>
              </nav>
          `;
    }

    const tab = (mode, label) => `
          <button class="tab ${this.ui.mode === mode ? "is-active" : ""}"
                  type="button" data-action="set-mode" data-mode="${mode}">${label}</button>
      `;
    return `
          <nav class="bottomnav">
          <div class="tabs">
              ${FEATURES.control ? tab("control", "Control") : ""}
              ${FEATURES.builder ? tab("builder", "Programs") : ""}
              ${FEATURES.remote ? tab("remote", "Remote") : ""}
          </div>
          </nav>
      `;
  }

  _renderMode(activeChannel) {
    if (this.ui.menuOpen) return this._renderMenuPanel();
    if (activeChannel) return this._renderChannelDetail(activeChannel);

    switch (this.ui.mode) {
      case "control":
        return this._renderControlGrid();
      case "builder":
        return this._renderBuilderPanel();
      case "remote":
        return this._renderRemotePanel();
      default:
        return "";
    }
  }

  // ---------------- Control panel: grid ----------------

  _channelCardSummary(channel) {
    const segments = channel.segments || [];

    if (channel.type !== "addressable" || !segments.length) {
      return {
        running: channel.state?.running !== false,
        brightness: `${this._brightnessFor(channel)}%`,
        speed: "—",
        animation: "—",
        mixed: false,
        colors: [],
      };
    }

    const states = segments.map((segment) => segment.state || {});
    const running = states.some((state) => state.running !== false);

    const brightnessValues = states.map((state) => Number(state.brightness) || 0);

    const speedValues = states.map((state) => Number(state.speed) || 0);

    const animationValues = states.map((state) => state.mode || "solid");

    const commonValue = (values) => (values.every((value) => value === values[0]) ? values[0] : null);

    const commonBrightness = commonValue(brightnessValues);
    const commonSpeed = commonValue(speedValues);
    const commonAnimation = commonValue(animationValues);

    const colors = states.slice(0, 4).map((state) => {
      const color = Array.isArray(state.color) ? state.color : [0, 0, 0, 0];

      const [r, g, b, w] = color;
      const whiteMix = (Number(w) || 0) / 255;

      return {
        rgb: [Math.round((Number(r) || 0) * (1 - whiteMix) + 255 * whiteMix), Math.round((Number(g) || 0) * (1 - whiteMix) + 245 * whiteMix), Math.round((Number(b) || 0) * (1 - whiteMix) + 220 * whiteMix)],
      };
    });

    return {
      running,
      brightness: commonBrightness === null ? "Mixed" : `${Math.round(commonBrightness / 2.55)}%`,
      speed: commonSpeed === null ? "Mixed" : `${Math.round(commonSpeed / 2.55)}%`,
      animation: commonAnimation === null ? "Mixed" : commonAnimation,
      mixed: commonBrightness === null || commonSpeed === null || commonAnimation === null,
      colors,
    };
  }

  _renderControlGrid() {
    const channels = this.data.channels;

    if (!channels.length) {
      return `<div class="empty">No channels configured.</div>`;
    }

    const cards = channels
      .map((ch) => {
        const glow = this._glowFor(ch);
        const summary = this._channelCardSummary(ch);

        let detailItems = [];
        let colorDots = "";

        if (ch.type === "addressable") {
          const segmentCount = ch.segments?.length || 0;

          detailItems = [summary.brightness, summary.animation, `${summary.speed} speed`, `${segmentCount} segment${segmentCount === 1 ? "" : "s"}`];

          colorDots = summary.colors
            .map(
              ({ rgb }) => `
                <span
                  class="channel-summary-dot"
                  style="--dot-color: ${rgb.join(" ")}"
                ></span>
              `
            )
            .join("");
        } else {
          detailItems = [summary.brightness];

          if (glow.strength > 0) {
            colorDots = `
              <span
                class="channel-summary-dot"
                style="--dot-color: ${glow.rgb}"
              ></span>
            `;
          }
        }

        return `
          <div
            class="channel-card-compact"
            style="
              --card-glow: ${glow.rgb};
              --card-glow-strength: ${glow.strength};
            "
          >
            <button
              class="channel-card-compact__main"
              type="button"
              data-action="open-channel"
              data-channel="${ch.id}"
            >
              <div class="channel-card-compact__identity">
                <div class="kicker">
                  ${this._typeLabel(ch.type)}
                </div>

                <div class="value">
                  ${ch.name || ch.id}
                </div>

                <div class="channel-card-compact__summary">
                  ${detailItems
                    .map(
                      (item) => `
                        <span class="channel-summary-item">
                          ${item}
                        </span>
                      `
                    )
                    .join('<span class="channel-summary-separator">·</span>')}

                  ${
                    colorDots
                      ? `
                        <span class="channel-summary-colors">
                          ${colorDots}
                        </span>
                      `
                      : ""
                  }
                </div>
              </div>
            </button>

            <div class="channel-card-compact__toggle">
              <label class="toggle" title="On/Off">
                <input
                  type="checkbox"
                  data-action="toggle-running"
                  data-channel="${ch.id}"
                  ${summary.running ? "checked" : ""}
                />
                <span class="track"></span>
                <span class="thumb"></span>
              </label>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="panel__header">
        <h1 class="h1">Channels</h1>
        <div class="hint">${channels.length} configured</div>
      </div>

      <div class="grid channels">
        ${cards}
      </div>
    `;
  }

  // ---------------- Channel detail ----------------
  _renderChannelDetail(channel) {
    const activeSegment = this._getActiveSegment(channel);
    const segmentControls =
      channel.type === "addressable"
        ? `
        <div class="card"><div class="card__pad">
          <div class="row">
            <div class="left">
              <div class="kicker">Active Segment</div>
              <div class="value">${activeSegment?.name || activeSegment?.segmentId || "None"}</div>
            </div>
            <span class="badge gray">${activeSegment ? `${activeSegment.deviceState.start ?? 0}-${activeSegment.deviceState.end ?? 0}` : ""}</span>
          </div>
          <button class="btn ghost mt-12" type="button" data-action="segment-manage">Manage Segments</button>
        </div></div>
      `
        : "";

    return `
      <div class="panel__header">
        <button class="btn ghost" type="button" data-action="back-to-channels">← Back</button>
        <h1 class="h1">${channel.name || channel.id}</h1>
        <button class="btn primary" type="button" data-action="confirm-channel">Confirm</button>
      </div>
      <div class="panel__pad">
        ${segmentControls}
        <vista-channel-card
          channel-id="${channel.id}"
          type="${channel.type === "rawPWM" ? "pwm" : channel.type}"
          data-role="channel-card"></vista-channel-card>
      </div>
    `;
  }

  // ---------------- Builder / remote / menu (porting handoff) ----------------
  _renderBuilderPanel() {
    const presets = Object.entries(this.data.scenes || {}).map(([sceneId, scene]) => ({
      id: sceneId,
      ...scene,
    }));

    return `
      <div class="panel__header">
        <h1 class="h1">Programs</h1>

        <button
          class="btn primary"
          type="button"
          data-action="preset-new"
        >
          + New Preset
        </button>
      </div>

      <div class="preset-stack">
        ${
          presets.length === 0
            ? `
              <div class="empty">
                No presets yet. Tap "+ New Preset" to create one.
              </div>
            `
            : presets.map((preset) => this._renderPresetCard(preset)).join("")
        }
      </div>
    `;
  }
  _renderPresetCard(preset) {
    const targets = Object.entries(preset.targets || {}).map(([channelId, output]) => ({
      channelId,
      output,
    }));
    const swipeState = this.ui.presetSwipe[preset.id] || null;
    const swipeClass = swipeState === "right" ? "swipe-right" : swipeState === "left" ? "swipe-left" : "";

    const binding = this._getBinding(preset.id);
    const isEnabled = !!binding?.enabled;

    // Glow dots
    const dots = targets
      .flatMap((target) => {
        const channel = this.data.channels.find((item) => item.id === target.channelId);

        if (!channel) {
          return [
            {
              rgb: "100 130 180",
              strength: 0.3,
              title: target.channelId,
            },
          ];
        }

        const segments = Object.entries(target.output || {}).filter(([key, value]) => key !== "active" && value && typeof value === "object");

        if (!segments.length) {
          return [
            {
              rgb: "100 130 180",
              strength: 0.3,
              title: channel.name || channel.id,
            },
          ];
        }

        return segments.map(([segmentId, segment]) => {
          const widgetState = deviceStateToWidget(channel.type, segment.state || {}, channel);

          const virtual = {
            ...channel,
            state: {
              ...widgetState,
              running: true,
            },
          };

          const glow = this._glowFor(virtual);

          return {
            rgb: glow.rgb,
            strength: Math.max(0.4, glow.strength),
            title: segment.name || `${channel.name || channel.id} · ${segmentId}`,
          };
        });
      })
      .map(
        (dot) => `
          <span
            class="preset-dot"
            style="
              --card-glow: ${dot.rgb};
              --card-glow-strength: ${dot.strength};
            "
            title="${dot.title}"
          ></span>
        `
      )
      .join("");

    const channelNames = targets
      .map((t) => {
        const ch = this.data.channels.find((c) => c.id === t.channelId);
        return ch ? ch.name || ch.id : t.channelId;
      })
      .join(", ");

    return `
    <div class="preset-card-wrap ${swipeClass}" data-preset-id="${preset.id}">
      <div class="preset-drawer preset-drawer--start"
           data-action="preset-drawer-toggle"
           data-preset-id="${preset.id}"
           data-side="right">
        <div class="preset-drawer__label">Start Triggers</div>
        ${swipeState === "right" ? this._renderStartDrawerContents(preset.id) : ""}
      </div>

      <div class="preset-card" data-preset-id="${preset.id}">
        <div class="preset-card__main">
          <div class="preset-card__title">${preset.name || preset.id}</div>
          <div class="preset-card__channels">${channelNames || "No targets"}</div>
          <div class="preset-card__dots">${dots}</div>
          ${isEnabled ? `<div class="preset-card__trigger">${this._summarizeBinding(binding)}</div>` : ""}
        </div>
        <div class="preset-card__actions">
          <label class="toggle preset-card__enabled" title="${isEnabled ? "Disable" : "Enable"}">
            <input type="checkbox"
                   data-action="preset-toggle-enabled"
                   data-preset-id="${preset.id}"
                   ${isEnabled ? "checked" : ""} />
            <span class="track"></span>
            <span class="thumb"></span>
          </label>
          <button class="btn ghost preset-card__edit"
                  type="button"
                  data-action="preset-edit"
                  data-preset-id="${preset.id}">Edit</button>
        </div>
      </div>

      <div class="preset-drawer preset-drawer--end"
           data-action="preset-drawer-toggle"
           data-preset-id="${preset.id}"
           data-side="left">
        <div class="preset-drawer__label">End Triggers / Action</div>
        ${swipeState === "left" ? this._renderEndDrawerContents(preset.id) : ""}
      </div>
    </div>
  `;
  }

  _renderRemotePanel() {
    return `<div class="panel__pad"><div class="empty">Remote — coming soon.</div></div>`;
  }

  _renderMenuPanel() {
    const currentPanel = this.ui.menuStack?.[this.ui.menuStack.length - 1] || "main";

    if (currentPanel === "wifi-setup") return this._renderWifiSetupPanel();
    if (currentPanel === "firmware-system") return this._renderFirmwareSystemPanel();
    if (currentPanel === "about") return this._renderAboutPanel();

    return this._renderMainMenu();
  }

  _renderMainMenu() {
    const config = this.data.config || {};
    const status = this.data.status || {};

    const MENU_ITEMS = [
      {
        id: "connection-status",
        section: "Connection",
        type: "status",
        visible: () => true,
        render: () => {
          const ap = status.ap || {},
            wifi = status.wifi || {};
          const lines = [];
          lines.push(`<div class="menu-status__detail">Device: ${status.deviceName || "VISTA"}</div>`);
          const wifiActive = wifi.active ?? wifi.enabled ?? false;
          const apActive = ap.active ?? ap.enabled ?? false;
          if (wifiActive) {
            lines.push(`<div class="menu-status__line"><span class="menu-status__dot on"></span>Wi-Fi: ${wifi.ssid || "Connected"}</div>`);
            lines.push(`<div class="menu-status__detail">IP: ${wifi.ip || "—"} • RSSI: ${wifi.rssi || "—"}dBm</div>`);
          }
          if (apActive) {
            lines.push(`<div class="menu-status__line"><span class="menu-status__dot on"></span>AP: ${ap.ssid || "Active"}</div>`);
            lines.push(`<div class="menu-status__detail">IP: ${ap.ip || "—"} • Clients: ${ap.clients ?? 0}</div>`);
          }
          if (!wifiActive && !apActive) {
            lines.push(`<div class="menu-status__line"><span class="menu-status__dot off"></span>Not connected</div>`);
          }
          return `<div class="menu-status">${lines.join("")}</div>`;
        },
      },
      { id: "wifi-toggle", section: "Connection", type: "toggle", label: "Wi-Fi", dataAction: "menu-wifi-toggle", get: () => config.wifi?.enabled ?? false, visible: () => true },
      { id: "wifi-network", section: "Connection", type: "panel", label: "Wi-Fi Network", panel: "wifi-setup", visible: () => config.wifi?.enabled ?? false },
      { id: "ap-security", section: "Connection", type: "toggle", label: "AP Password Protection", dataAction: "menu-ap-security-toggle", get: () => config.ap?.secure ?? false, visible: () => true },
      { id: "ap-password", section: "Connection", type: "action", label: "Change AP Password", dataAction: "menu-ap-password", visible: () => config.ap?.secure ?? false },
      { id: "theme", section: "Appearance", type: "toggle", label: "Dark Mode", dataAction: "menu-theme-toggle", get: () => this.ui.theme === "dark", visible: () => true },
      { id: "firmware-system", section: "System", type: "panel", label: "Firmware & System", panel: "firmware-system", visible: () => true },
      { id: "about", section: "System", type: "panel", label: "About / Help", panel: "about", visible: () => true },
    ];

    const visible = MENU_ITEMS.filter((item) => item.visible());
    const sections = {};
    for (const item of visible) {
      if (!sections[item.section]) sections[item.section] = [];
      sections[item.section].push(item);
    }

    const renderItem = (item) => {
      if (item.type === "status") return item.render();
      if (item.type === "toggle") {
        return `
              <div class="menu-item">
              <span class="menu-item__label">${item.label}</span>
              <label class="toggle">
                  <input type="checkbox" data-action="${item.dataAction}" ${item.get() ? "checked" : ""}>
                  <span class="track"></span>
                  <span class="thumb"></span>
              </label>
              </div>
          `;
      }
      if (item.type === "action") {
        return `
              <div class="menu-item menu-item--action ${item.danger ? "menu-item--danger" : ""}"
                  data-action="${item.dataAction}">
              <span class="menu-item__label">${item.label}</span>
              <span class="menu-item__arrow">›</span>
              </div>
          `;
      }
      if (item.type === "panel") {
        return `
              <div class="menu-item menu-item--panel" data-action="menu-open-panel" data-panel="${item.panel}">
              <span class="menu-item__label">${item.label}</span>
              <span class="menu-item__arrow">›</span>
              </div>
          `;
      }
      return "";
    };

    return `
          <div class="menu">
          ${Object.entries(sections)
            .map(
              ([name, items]) => `
              <div class="menu-section">
              <div class="menu-section__header">${name}</div>
              ${items.map((item) => renderItem(item)).join("")}
              </div>
          `
            )
            .join("")}
          </div>
      `;
  }
  _renderWifiSetupPanel() {
    const results = this.ui.wifiScanResults;
    const selected = this.ui.wifiSelectedSSID;
    const connecting = this.ui.wifiConnecting;
    const redirectIP = this.ui.wifiRedirectIP;

    if (redirectIP) {
      return `
        <div class="menu">
          <div class="menu-section">
            <div class="menu-section__header">Connected</div>
            <div class="menu-status">
              <div class="menu-status__line"><span class="menu-status__dot on"></span>Connected to Wi-Fi</div>
              <div class="menu-status__detail" style="margin-top: 8px; font-weight: 700;">New IP: ${redirectIP}</div>
              <div class="menu-status__detail" style="margin-top: 8px;">Redirecting in a few seconds...</div>
              <div class="menu-status__detail" style="margin-top: 4px;">If redirect fails, navigate to ${redirectIP}</div>
            </div>
          </div>
        </div>
      `;
    }

    if (connecting) {
      return `
        <div class="menu">
          <div class="menu-section">
            <div class="menu-section__header">Wi-Fi</div>
            <div class="menu-status"><div class="menu-status__line">Connecting...</div></div>
          </div>
        </div>
      `;
    }

    if (results === null) {
      return `
        <div class="menu">
          <div class="wifi-panel__header">
            <button class="btn ghost" type="button" data-action="menu-back">${icons.back} Back</button>
            <span class="wifi-panel__title">Wi-Fi Network</span>
          </div>
          <div class="menu-section">
            <div class="menu-section__header">Scanning</div>
            <div class="menu-status"><div class="menu-status__line">Searching for networks...</div></div>
          </div>
        </div>
      `;
    }

    if (results.length === 0) {
      return `
        <div class="menu">
          <div class="wifi-panel__header">
            <button class="btn ghost" type="button" data-action="menu-back">${icons.back} Back</button>
            <span class="wifi-panel__title">Wi-Fi Network</span>
          </div>
          <div class="menu-section">
            <div class="menu-section__header">Networks</div>
            <div class="menu-status"><div class="menu-status__line">No networks found</div></div>
            <div class="menu-item menu-item--action" data-action="menu-wifi-scan">
              <span class="menu-item__label">Scan Again</span>
            </div>
          </div>
        </div>
      `;
    }

    const selectedNetwork = results.find((n) => n.ssid === selected);
    const needsPassword = selectedNetwork?.secure;

    return `
      <div class="menu">
        <div class="wifi-panel__header">
          <button class="btn ghost" type="button" data-action="menu-back">${icons.back} Back</button>
          <span class="wifi-panel__title">Wi-Fi Network</span>
        </div>
        <div class="menu-section">
          <div class="menu-section__header">Available Networks</div>
          ${results
            .map(
              (n) => `
            <div class="menu-item menu-item--action ${n.ssid === selected ? "wifi-network--selected" : ""}"
                data-action="menu-wifi-select" data-ssid="${n.ssid}">
              <span class="menu-item__label">${n.secure ? "🔒 " : ""}${n.ssid}</span>
              <span class="wifi-signal">${this._rssiToLabel(n.rssi)}</span>
            </div>
          `
            )
            .join("")}
          <div class="menu-item menu-item--action" data-action="menu-wifi-scan">
            <span class="menu-item__label">Scan Again</span>
            <span class="menu-item__arrow">⟳</span>
          </div>
        </div>
        ${
          selected
            ? `
          <div class="wifi-connect-bar">
            <div class="menu-section__header" style="padding: 0;">Connect to ${selected}</div>
            ${
              needsPassword
                ? `
              <input class="input" type="password" data-action="menu-wifi-password"
                    placeholder="Enter password" value="${this.ui.wifiPassword || ""}">
            `
                : ""
            }
            <button class="btn primary" type="button" data-action="menu-wifi-connect" style="width: 100%;">Connect</button>
          </div>
        `
            : ""
        }
      </div>
    `;
  }

  _renderFirmwareSystemPanel() {
    const status = this.data.status || {};
    const fwVersion = status.firmwareVersion || "unknown";
    const otaStatus = this.ui.otaStatus;
    const otaError = this.ui.otaError;
    const updateCheck = this.ui.updateCheck;
    
    if (otaStatus === "starting") {
      return `
        <div class="menu">
          <div class="menu-section">
            <div class="menu-section__header">Preparing Update</div>

            <div class="menu-status">
              <div class="menu-status__line">
                Preparing firmware update...
              </div>

              <div class="menu-status__detail" style="margin-top: 8px;">
                The controller will restart into update mode.
              </div>
            </div>
          </div>
        </div>
      `;
    }
    if (otaStatus === "rebooting") {
      return `
        <div class="menu">
          <div class="menu-section">
            <div class="menu-section__header">Updating Firmware</div>

            <div class="menu-status">
              <div class="menu-status__line">
                Firmware update in progress
              </div>

              <div class="menu-status__detail" style="margin-top: 8px;">
                The controller is downloading and installing the update.
                It will restart automatically when finished.
              </div>

              <div class="menu-status__detail" style="margin-top: 8px;">
                Please keep the controller powered on.
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (otaStatus === "error") {
      return `
      <div class="menu">
        <div class="wifi-panel__header">
          <button class="btn ghost" type="button" data-action="menu-back">${icons.back} Back</button>
          <span class="wifi-panel__title">Firmware & System</span>
        </div>
        <div class="menu-section">
          <div class="menu-section__header">Update Failed</div>
          <div class="menu-status">
            <div class="menu-status__line"><span class="menu-status__dot off"></span>Firmware update failed</div>
            <div class="menu-status__detail" style="margin-top: 4px;">${otaError || "Unknown error."}</div>
          </div>
          <div class="menu-item menu-item--action" data-action="menu-ota-retry">
            <span class="menu-item__label">Back</span>
          </div>
        </div>
      </div>
    `;
    }

  let updateLine = "";
  let updateAction = "";

  if (updateCheck?.checking) {
    updateLine = `
      <div class="menu-status__detail">
        Checking for updates...
      </div>
    `;
  } else if (updateCheck?.error) {
    updateLine = `
      <div class="menu-status__detail">
        ${updateCheck.error}
      </div>
    `;
  } else if (updateCheck?.available) {
    updateLine = `
      <div
        class="menu-status__detail"
        style="color: var(--accent); font-weight: 700;"
      >
        Update available: v${updateCheck.availableVersion}
      </div>
    `;

    updateAction = `
      <div
        class="menu-item menu-item--action"
        data-action="menu-install-update"
      >
        <span class="menu-item__label">
          Install v${updateCheck.availableVersion}
        </span>
        <span class="menu-item__arrow">↓</span>
      </div>
    `;
  } else if (updateCheck) {
    updateLine = `
      <div class="menu-status__detail">
        Firmware is up to date.
      </div>
    `;
  }

    return `
    <div class="menu">
      <div class="wifi-panel__header">
        <button class="btn ghost" type="button" data-action="menu-back">${icons.back} Back</button>
        <span class="wifi-panel__title">Firmware & System</span>
      </div>

      <div class="menu-section">
        <div class="menu-section__header">Firmware</div>

        <div class="menu-status">
          <div class="menu-status__line">
            Current Version: v${fwVersion}
          </div>
          ${updateLine}
        </div>

        <div
          class="menu-item menu-item--action"
          data-action="menu-check-update"
        >
          <span class="menu-item__label">
            ${updateCheck?.checking ? "Checking..." : "Check for Updates"}
          </span>
          <span class="menu-item__arrow">
            ${updateCheck?.checking ? "…" : "⟳"}
          </span>
        </div>

        ${updateAction}
      </div>

      <div class="menu-section">
        <div class="menu-section__header">VISTA UI</div>
        <div class="menu-item menu-item--action" data-action="menu-update-ui">
          <span class="menu-item__label">Update UI Files</span>
          <span class="menu-item__arrow">↑</span>
        </div>
      </div>

      <div class="menu-section">
        <div class="menu-section__header">Configuration</div>
        <div class="menu-item menu-item--action" data-action="menu-export-channels">
          <span class="menu-item__label">Channels — Export</span><span class="menu-item__arrow">↓</span>
        </div>
        <div class="menu-item menu-item--action" data-action="menu-import-channels">
          <span class="menu-item__label">Channels — Import</span><span class="menu-item__arrow">↑</span>
        </div>
        <div class="menu-item menu-item--action" data-action="menu-export-programs">
          <span class="menu-item__label">Programs — Export</span><span class="menu-item__arrow">↓</span>
        </div>
        <div class="menu-item menu-item--action" data-action="menu-import-programs">
          <span class="menu-item__label">Programs — Import</span><span class="menu-item__arrow">↑</span>
        </div>
        <div class="menu-item menu-item--action" data-action="menu-export-network">
          <span class="menu-item__label">Config — Export</span><span class="menu-item__arrow">↓</span>
        </div>
        <div class="menu-item menu-item--action" data-action="menu-import-network">
          <span class="menu-item__label">Config — Import</span><span class="menu-item__arrow">↑</span>
        </div>
      </div>

      <div class="menu-section">
        <div class="menu-section__header">Device</div>
        <div class="menu-item menu-item--action" data-action="menu-reboot">
          <span class="menu-item__label">Reboot Controller</span><span class="menu-item__arrow">↻</span>
        </div>
      </div>
      <div class="menu-section">
        <div class="menu-section__header">Danger Zone</div>
        <div class="menu-item menu-item--action menu-item--danger" data-action="menu-factory-reset">
          <span class="menu-item__label">Factory Reset</span><span class="menu-item__arrow">⚠</span>
        </div>
      </div>
    </div>
  `;
  }

  _renderAboutPanel() {
    const status = this.data.status || {};
    const config = this.data.config || {};
    const fwVersion = status.firmwareVersion || "unknown";
    const deviceName = config.device?.name || status.deviceName || "VISTA";

    return `
    <div class="menu">
      <div class="wifi-panel__header">
        <button class="btn ghost" type="button" data-action="menu-back">${icons.back} Back</button>
        <span class="wifi-panel__title">About / Help</span>
      </div>

      <div class="menu-section">
        <div class="menu-section__header">About</div>
        <div class="about-block">
          <div class="about-block__title">VISTA Lighting Controller</div>
          <div class="about-block__line">Firmware: v${fwVersion}</div>
          <div class="about-block__line">Device: ${deviceName}</div>
          <div class="about-block__line">Made by <strong>Vista Manufacturing</strong></div>
          <div class="about-block__line"><a href="https://vistamfg.com" target="_blank" rel="noopener" class="about-link">vistamfg.com</a></div>
          <div class="about-block__legal">© Vista Manufacturing. All rights reserved.</div>
        </div>
      </div>

      <div class="menu-section">
        <div class="menu-section__header">Support</div>
        <div class="about-block">
          <div class="about-block__text">For additional help, documentation, and support:</div>
          <div class="about-block__text"><a href="https://vistamfg.com/support" target="_blank" rel="noopener" class="about-link">vistamfg.com/support</a></div>
        </div>
      </div>
    </div>
  `;
  }

  _renderMenuOverlay() {
    // Optional: backdrop or fixed elements that sit outside the main panel.
    return "";
  }
    
  _renderModal() {
    if (this.ui.segmentModal) {
      return this._renderSegmentModal();
    }

    if (this.ui.programSegmentModal) {
      return this._renderProgramSegmentModal();
    }

    const modal = this.ui.presetModal;
    if (!modal) return "";

    if (modal.mode === "save-to-preset") {
      return this._renderSaveToPresetModal();
    }

    if (modal.mode === "edit-target") {
      return this._renderEditTargetModal();
    }

    return this._renderPresetEditModal();
  }

  _renderSegmentModal() {
    const modal = this.ui.segmentModal;
    const channel = this.data.channels.find((item) => item.id === modal.channelId);
    if (!channel) return "";

    if (modal.mode === "create" || modal.mode === "edit") {
      return this._renderSegmentForm(channel, modal);
    }

    const segments = channel.segments || [];
    const rows = segments
      .map(
        (segment) => `
      <div class="target-card">
        <button class="target-card__main" type="button"
                data-action="segment-select" data-segment-id="${segment.segmentId}">
          <div class="target-card__title">${segment.name || segment.segmentId}</div>
          <div class="target-card__summary">
            Pixels ${segment.deviceState.start ?? 0}-${segment.deviceState.end ?? 0}
            · ${segment.deviceState.animation || "solid"}
          </div>
        </button>
        <div class="target-card__actions">
          <button class="btn ghost" type="button"
                  data-action="segment-edit" data-segment-id="${segment.segmentId}">Edit</button>
          <button class="btn ghost" type="button"
                  data-action="segment-delete" data-segment-id="${segment.segmentId}"
                  ${segments.length <= 1 ? "disabled" : ""}>Delete</button>
        </div>
      </div>
    `
      )
      .join("");

    return `
      <div class="modal-backdrop">
        <div class="modal modal--full">
          <div class="modal__header">
            <div class="modal__title">Segments · ${channel.name || channel.id}</div>
            <button class="icon-btn" type="button" data-action="segment-modal-close" aria-label="Close">${icons.close}</button>
          </div>
          <div class="modal__body">
            <div class="hint" style="margin-bottom: 12px;">
              Segments are independent ranges and may overlap. Physical strip length: ${channel.params?.physicalPixelCount || 0} pixels.
            </div>
            <div class="target-list">${rows}</div>
          </div>
          <div class="modal__footer">
            <div></div>
            <button class="btn primary" type="button" data-action="segment-create">+ Create Segment</button>
          </div>
        </div>
      </div>
    `;
  }

  _renderSegmentForm(channel, modal) {
    const draft = modal.draft;
    const creating = modal.mode === "create";
    const maxPixel = Math.max(0, Number(channel.params?.physicalPixelCount || 1) - 1);

    return `
      <div class="modal-backdrop">
        <div class="modal">
          <div class="modal__header">
            <button class="btn ghost" type="button" data-action="segment-form-back">${icons.back} Back</button>
            <div class="modal__title">${creating ? "Create Segment" : "Edit Segment"}</div>
            <button class="icon-btn" type="button" data-action="segment-modal-close" aria-label="Close">${icons.close}</button>
          </div>
          <div class="modal__body">
            <div class="field">
              <label class="field__label">Name</label>
              <input class="input" type="text" data-action="segment-name-input"
                    value="${draft.name || ""}" placeholder="Segment name">
            </div>
            <div class="field">
              <label class="field__label">Start Pixel</label>
              <input class="input" type="number" min="0" max="${maxPixel}" step="1"
                    data-action="segment-start-input" value="${draft.start}">
            </div>
            <div class="field">
              <label class="field__label">End Pixel</label>
              <input class="input" type="number" min="0" max="${maxPixel}" step="1"
                    data-action="segment-end-input" value="${draft.end}">
            </div>
            <div class="hint">Range length: ${Math.max(0, Number(draft.end) - Number(draft.start) + 1)} pixels</div>
          </div>
          <div class="modal__footer">
            <div></div>
            <button class="btn primary"
                    type="button"
                    data-action="segment-form-save"
                    ${this.ui.segmentSaving ? "disabled" : ""}>
              ${this.ui.segmentSaving ? "Saving..." : creating ? "Create Segment" : "Save Segment"}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _newProgramSegmentId(target) {
    const used = new Set(
      (target?.segments || []).map(
        (segment) => segment.segmentId
      )
    );

    let index = 1;

    while (used.has(`seg_${index}`)) {
      index++;
    }

    return `seg_${index}`;
  }

  _openCreateProgramSegment(targetIndex) {
    const target =
      this.ui.presetModal?.draft?.targets?.[targetIndex];

    const channel = this.data.channels.find(
      (item) => item.id === target?.channelId
    );

    if (!target || channel?.type !== "addressable") return;

    const maxPixel = Math.max(
      0,
      Number(channel.params?.physicalPixelCount || 1) - 1
    );

    this.ui.programSegmentModal = {
      mode: "create",
      targetIndex,
      segmentId: null,
      draft: {
        name: `Segment ${(target.segments?.length || 0) + 1}`,
        start: 0,
        end: maxPixel,
      },
    };

    this._scheduleRender();
  }

  _openEditProgramSegment(targetIndex, segmentId) {
    const target =
      this.ui.presetModal?.draft?.targets?.[targetIndex];

    const segment = target?.segments?.find(
      (item) => item.segmentId === segmentId
    );

    if (!target || !segment) return;

    this.ui.programSegmentModal = {
      mode: "edit",
      targetIndex,
      segmentId,
      draft: {
        name: segment.name || segmentId,
        start: Number(segment.deviceState?.start) || 0,
        end: Number(segment.deviceState?.end) || 0,
      },
    };

    this._scheduleRender();
  }

  _closeProgramSegmentModal() {
    this.ui.programSegmentModal = null;
    this._scheduleRender();
  }

  _renderProgramSegmentModal() {
    const modal = this.ui.programSegmentModal;
    const target =
      this.ui.presetModal?.draft?.targets?.[modal?.targetIndex];

    const channel = this.data.channels.find(
      (item) => item.id === target?.channelId
    );

    if (!modal || !target || !channel) return "";

    const creating = modal.mode === "create";
    const draft = modal.draft;
    const maxPixel = Math.max(
      0,
      Number(channel.params?.physicalPixelCount || 1) - 1
    );

    return `
      <div class="modal-backdrop">
        <div class="modal">
          <div class="modal__header">
            <button
              class="btn ghost"
              type="button"
              data-action="program-segment-cancel"
            >
              ${icons.back} Back
            </button>

            <div class="modal__title">
              ${creating ? "Create Program Segment" : "Edit Program Segment"}
            </div>

            <button
              class="icon-btn"
              type="button"
              data-action="program-segment-cancel"
              aria-label="Close"
            >
              ${icons.close}
            </button>
          </div>

          <div class="modal__body">
            <div class="hint" style="margin-bottom: 12px;">
              This range belongs only to the preset. It does not change
              the channel's Live segments.
            </div>

            <div class="field">
              <label class="field__label">Name</label>
              <input
                class="input"
                type="text"
                data-action="program-segment-name"
                value="${draft.name || ""}"
                placeholder="Segment name"
              >
            </div>

            <div class="field">
              <label class="field__label">Start Pixel</label>
              <input
                class="input"
                type="number"
                min="0"
                max="${maxPixel}"
                step="1"
                data-action="program-segment-start"
                value="${draft.start}"
              >
            </div>

            <div class="field">
              <label class="field__label">End Pixel</label>
              <input
                class="input"
                type="number"
                min="0"
                max="${maxPixel}"
                step="1"
                data-action="program-segment-end"
                value="${draft.end}"
              >
            </div>

            <div class="hint">
              Range length:
              ${Math.max(
                0,
                Number(draft.end) - Number(draft.start) + 1
              )}
              pixels
            </div>
          </div>

          <div class="modal__footer">
            <div></div>

            <button
              class="btn primary"
              type="button"
              data-action="program-segment-save"
              ${this.ui.programSegmentSaving ? "disabled" : ""}
            >
              ${
                this.ui.programSegmentSaving
                  ? "Saving..."
                  : creating
                    ? "Create Segment"
                    : "Save Segment"
              }
            </button>
          </div>
        </div>
      </div>
    `;
  }

  async _saveProgramSegmentForm() {
    if (this.ui.programSegmentSaving) {
      return;
    }

    const segmentModal =
      this.ui.programSegmentModal;

    const presetModal =
      this.ui.presetModal;

    if (
      !segmentModal ||
      !presetModal ||
      !segmentModal.draft
    ) {
      return;
    }

    const target =
      presetModal.draft.targets?.[
        segmentModal.targetIndex
      ];

    if (!target) {
      this._toast("Program target not found");
      return;
    }

    const channel = this.data.channels.find(
      (item) => item.id === target.channelId
    );

    if (!channel) {
      this._toast("Channel not found");
      return;
    }

    const maxPixel = Math.max(
      0,
      Number(
        channel.params?.physicalPixelCount || 1
      ) - 1
    );

    const start = Math.max(
      0,
      Math.min(
        maxPixel,
        Number(segmentModal.draft.start) || 0
      )
    );

    const end = Math.max(
      start,
      Math.min(
        maxPixel,
        Number(segmentModal.draft.end) || 0
      )
    );

    const name = String(
      segmentModal.draft.name || ""
    ).trim();

    if (!name) {
      this._toast("Segment name required");
      return;
    }

    this.ui.programSegmentSaving = true;
    this._scheduleRender();

    try {
      target.segments = Array.isArray(
        target.segments
      )
        ? target.segments
        : [];

      let savedSegment = null;

      if (segmentModal.mode === "create") {
        const segmentId =
          this._newProgramSegmentId(target);

        const deviceState = {
          running: true,
          brightness: 100,

          color: {
            r: 100,
            g: 100,
            b: 100,
            w: 0,
            warm: 0,
            cool: 0,
          },

          animation: "solid",
          speed: 50,
          animationSize: 25,
          reverse: false,

          start,
          end,

          brightnessFadeMs: 0,
          colorFadeMs: 0,
          onOffFadeMs: 0,
        };

        savedSegment = {
          segmentId,
          name,
          deviceState,

          state: deviceStateToWidget(
            channel.type,
            deviceState,
            channel
          ),
        };

        target.segments.push(savedSegment);

        presetModal.editingSegmentId =
          segmentId;
      }
      else {
        savedSegment =
          target.segments.find(
            (item) =>
              item.segmentId ===
              segmentModal.segmentId
          );

        if (!savedSegment) {
          throw new Error(
            "Program segment not found"
          );
        }

        savedSegment.name = name;

        savedSegment.deviceState = {
          ...clone(
            savedSegment.deviceState || {}
          ),

          start,
          end,
        };

        savedSegment.state =
          deviceStateToWidget(
            channel.type,
            savedSegment.deviceState,
            channel
          );

        presetModal.editingSegmentId =
          savedSegment.segmentId;
      }

      /*
      * The segment currently exists only in the UI draft.
      * Stage the scene, target, and any missing segments in
      * firmware before starting hardware preview.
      */
      const staged =
        await this._stageDraftTarget(
          presetModal.draft,
          target
        );

      if (!staged) {
        throw new Error(
          "Unable to stage program target"
        );
      }

      /*
      * Start a fresh preview session now that the firmware
      * knows about the scene, target, and segment.
      */
      await API.programPreview({
        action: "begin",
        presetId: presetModal.draft.id,
        channelId: target.channelId,
      });

      presetModal.previewChannelId = target.channelId;

      /*
      * Send every program segment so the complete target route
      * is visible while one segment is edited.
      */
      for (const segment of target.segments) {
        await API.programPreview({
          action: "preview",
          presetId: presetModal.draft.id,
          channelId: target.channelId,
          segmentId: segment.segmentId,

          state: {
            ...clone(
              segment.deviceState || {}
            ),
            running: true,
          },
        });
      }

      presetModal.touchedChannels.add(
        target.channelId
      );

      this.ui.programSegmentModal = null;

      this._toast(
        segmentModal.mode === "create"
          ? "Program segment created"
          : "Program segment updated"
      );
    }
    catch (error) {
      console.error(
        "[VISTA] program segment save failed",
        error
      );

      this._toast(
        "Unable to save program segment"
      );
    }
    finally {
      this.ui.programSegmentSaving = false;
      this._scheduleRender();
    }
  }

  _deleteProgramSegment(targetIndex, segmentId) {
    const target =
      this.ui.presetModal?.draft?.targets?.[targetIndex];

    const segment = target?.segments?.find(
      (item) => item.segmentId === segmentId
    );

    if (!target || !segment) return;

    if (!confirm(`Delete program segment "${segment.name || segmentId}"?`)) {
      return;
    }

    target.segments = target.segments.filter(
      (item) => item.segmentId !== segmentId
    );

    if (
      this.ui.presetModal.editingSegmentId === segmentId
    ) {
      this.ui.presetModal.editingSegmentId =
        target.segments[0]?.segmentId || null;
    }

    this._scheduleRender();
  }

  _renderPresetEditModal() {
    const m = this.ui.presetModal;
    const draft = m.draft;
    const isCreate = m.mode === "create";

    const targetCards = (draft.targets || [])
      .map((t, idx) => {
        const ch = this.data.channels.find((c) => c.id === t.channelId);
        const name = ch ? ch.name || ch.id : t.channelId;
        const segments = t.segments || [];
        const summary = segments.length > 1
          ? `${segments.length} segments`
          : segments[0] ? segments[0].name || segments[0].segmentId : "No segments";
      return `
      <div class="target-card">
        <div class="target-card__main">
          <div class="target-card__title">${name}</div>
          <div class="target-card__summary">${summary}</div>
        </div>
        <div class="target-card__actions">
          <button class="btn ghost" type="button" data-action="preset-edit-target" data-index="${idx}">Edit</button>
          <button class="btn ghost" type="button" data-action="preset-remove-target" data-index="${idx}">×</button>
        </div>
      </div>
    `;
      })
      .join("");

    // Channel picker: list of channels not yet in the preset
    const usedIds = new Set((draft.targets || []).map((t) => t.channelId));
    const availableChannels = this.data.channels.filter((c) => !usedIds.has(c.id));

    return `
    <div class="modal-backdrop">
      <div class="modal modal--full">
        <div class="modal__header">
          <div class="modal__title">${isCreate ? "New Preset" : "Edit Preset"}</div>
          <button class="icon-btn" type="button" data-action="preset-modal-close" aria-label="Close">${icons.close}</button>
        </div>
        <div class="modal__body">
          <div class="field">
            <label class="field__label">Preset Name</label>
            <input class="input" type="text"
                   data-action="preset-name-input"
                   value="${draft.name || ""}"
                   placeholder="Enter a name">
          </div>

          <div class="field">
            <label class="field__label">Targets (${(draft.targets || []).length})</label>
            <div class="target-list">
              ${targetCards || `<div class="empty">No targets yet. Add a channel below.</div>`}
            </div>
          </div>

          ${
            availableChannels.length > 0
              ? `
            <div class="field">
              <label class="field__label">Add Channel</label>
              <div class="chip-grid">
                ${availableChannels
                  .map(
                    (c) => `
                  <button class="chip" type="button" data-action="preset-add-target" data-channel="${c.id}">
                    ${c.name || c.id}
                  </button>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }
        </div>
        <div class="modal__footer">
          ${!isCreate ? `<button class="btn danger" type="button" data-action="preset-delete">Delete Preset</button>` : `<div></div>`}
          <button class="btn primary" type="button" data-action="preset-save">${isCreate ? "Create Preset" : "Save Changes"}</button>
        </div>
      </div>
    </div>
  `;
  }

  _renderEditTargetModal() {
    const modal = this.ui.presetModal;
    const target =
      modal?.draft?.targets?.[modal.editingTargetIndex];

    const channel = this.data.channels.find(
      (item) => item.id === target?.channelId
    );

    if (!modal || !target || !channel) {
      return this._renderPresetEditModal();
    }

    if (channel.type !== "addressable") {
      const segment = target.segments?.[0];

      if (!segment) {
        return this._renderPresetEditModal();
      }

      modal.editingSegmentId = segment.segmentId;
    }

    const selectedSegment = target.segments?.find(
      (segment) =>
        segment.segmentId === modal.editingSegmentId
    ) || target.segments?.[0] || null;

    if (
      selectedSegment &&
      !modal.editingSegmentId
    ) {
      modal.editingSegmentId = selectedSegment.segmentId;
    }

    const segmentRows = (target.segments || [])
      .map(
        (segment) => `
          <div class="target-card">
            <button
              class="target-card__main"
              type="button"
              data-action="preset-target-segment"
              data-segment-id="${segment.segmentId}"
            >
              <div class="target-card__title">
                ${segment.name || segment.segmentId}
              </div>

              <div class="target-card__summary">
                Pixels ${segment.deviceState?.start ?? 0}-${segment.deviceState?.end ?? 0}
                · ${segment.deviceState?.animation || "solid"}
              </div>
            </button>

            <div class="target-card__actions">
              <button
                class="btn ghost"
                type="button"
                data-action="program-segment-edit"
                data-target-index="${modal.editingTargetIndex}"
                data-segment-id="${segment.segmentId}"
              >
                Range
              </button>

              <button
                class="btn ghost"
                type="button"
                data-action="program-segment-delete"
                data-target-index="${modal.editingTargetIndex}"
                data-segment-id="${segment.segmentId}"
              >
                Delete
              </button>
            </div>
          </div>
        `
      )
      .join("");

    const editor = selectedSegment
      ? `
        <div class="hint" style="margin-bottom: 12px;">
          Editing "${selectedSegment.name || selectedSegment.segmentId}".
          Hardware updates live.
        </div>

        <vista-channel-card
          channel-id="${channel.id}"
          type="${channel.type === "rawPWM" ? "pwm" : channel.type}"
          data-role="preset-target-card"
        ></vista-channel-card>
      `
      : `
        <div class="empty">
          No program segments yet. Create one to define this preset's
          addressable output.
        </div>
      `;

    return `
      <div class="modal-backdrop">
        <div class="modal modal--full">
          <div class="modal__header">
            <button
              class="btn ghost"
              type="button"
              data-action="preset-target-back"
            >
              ${icons.back} Back to Preset
            </button>

            <div class="modal__title">
              Editing ${channel.name || channel.id}
            </div>

            <button
              class="icon-btn"
              type="button"
              data-action="preset-modal-close"
              aria-label="Close"
            >
              ${icons.close}
            </button>
          </div>

          <div class="modal__body">
            ${
              channel.type === "addressable"
                ? `
                  <div class="field">
                    <label class="field__label">
                      Program Segments (${target.segments?.length || 0})
                    </label>

                    <div class="target-list">
                      ${segmentRows}
                    </div>
                  </div>
                `
                : ""
            }

            ${editor}
          </div>

          <div class="modal__footer">
            ${
              channel.type === "addressable"
                ? `
                  <button
                    class="btn ghost"
                    type="button"
                    data-action="program-segment-create"
                    data-target-index="${modal.editingTargetIndex}"
                    ${
                      (target.segments?.length || 0) >= 16 
                        ? "disabled"
                        : ""
                    }
                  >
                    + Create Program Segment
                  </button>
                `
                : "<div></div>"
            }

            <button
              class="btn primary"
              type="button"
              data-action="preset-target-save"
              ${selectedSegment ? "" : "disabled"}
            >
              Save Target
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderSaveToPresetModal() {
    const m = this.ui.presetModal;
    const channelId = m.channelId;
    const ch = this.data.channels.find((c) => c.id === channelId);
    if (!ch) return "";

    const existing = Object.entries(this.data.scenes || {})
      .map(([sceneId, scene]) => ({ id: sceneId, ...scene }));

    return `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal__header">
          <div class="modal__title">Save to Preset</div>
          <button class="icon-btn" type="button" data-action="preset-modal-close" aria-label="Close">${icons.close}</button>
        </div>
        <div class="modal__body">
          <div class="hint" style="margin-bottom: 12px;">Saving current state of ${ch.name || ch.id}.</div>

          <div class="field">
            <label class="field__label">Create New Preset</label>
            <input class="input" type="text"
                   data-action="preset-new-name-input"
                   value="${m.newName || ""}"
                   placeholder="Enter a name">
          </div>

          ${
            existing.length > 0
              ? `
            <div class="field">
              <label class="field__label">Or Add to Existing Preset</label>
              <div class="preset-pick-list">
                ${existing
                  .map(
                    (p) => `
                  <div class="preset-pick-item ${m.selectedExistingId === p.id ? "is-selected" : ""}"
                       data-action="preset-pick-existing"
                       data-preset-id="${p.id}">
                    <div class="preset-pick-item__title">${p.name || p.id}</div>
                    <div class="preset-pick-item__summary">${Object.keys(p.targets || {}).length} channels</div>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }
        </div>
        <div class="modal__footer">
          <div></div>
          <button class="btn primary" type="button" data-action="preset-save-from-control">Save Preset</button>
        </div>
      </div>
    </div>
  `;
  }

  // ---------------- Loading / fatal ----------------
  _renderLoading() {
    this.innerHTML = `<div class="boot"><div class="boot__spinner"></div><div class="boot__msg">Loading device…</div></div>`;
  }
  _renderFatal(msg) {
    this.innerHTML = `<div class="boot boot--error"><div class="boot__msg">${msg}</div><button class="btn primary" data-action="reload">Reload</button></div>`;
  }

  // ---------------- Event delegation ----------------
  onClick(e) {
    const hasOpenDrawers = Object.values(this.ui.presetSwipe || {}).some((v) => v);
    if (hasOpenDrawers) {
      const clickedInDrawer = e.target.closest(".preset-drawer");
      if (!clickedInDrawer) {
        this.ui.presetSwipe = {};
        this._scheduleRender();
        return;
      }
      // Clicked in a drawer — close drawers on OTHER cards
      const wrap = clickedInDrawer.closest(".preset-card-wrap");
      const presetId = wrap?.getAttribute("data-preset-id");
      for (const pid of Object.keys(this.ui.presetSwipe)) {
        if (pid !== presetId) delete this.ui.presetSwipe[pid];
      }
    }

    if (e.target.closest(".toggle")) return;
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.getAttribute("data-action");
    const channel = el.getAttribute("data-channel");
    const mode = el.getAttribute("data-mode");

    switch (action) {
      case "reload":
        location.reload();
        return;
      case "set-mode":
        if (mode && mode !== this.ui.mode) {
          if (this.ui.mode === "control" && this.ui.activeChannelId) this.onConfirmChannel();
          if (mode !== "control") this.ui.activeChannelId = null;

          this.ui.mode = mode;
          this._scheduleRender();
        }
        return;
      case "open-channel":
        this.onOpenChannel(channel);
        return;

      case "segment-manage":
        this._openSegmentManager();
        return;

      case "segment-modal-close":
        this.ui.segmentModal = null;
        this._scheduleRender();
        return;

      case "segment-form-back":
        this.ui.segmentModal = {
          mode: "manage",
          channelId: this.ui.segmentModal.channelId,
          segmentId: null,
          draft: null,
        };
        this._scheduleRender();
        return;

      case "segment-create":
        this._openCreateSegment();
        return;

      case "segment-edit":
        this._openEditSegment(el.getAttribute("data-segment-id"));
        return;

      case "segment-select":
        this._chooseSegment(el.getAttribute("data-segment-id"));
        return;

      case "segment-form-save":
        this._saveSegmentForm();
        return;

      case "segment-delete":
        this._deleteSegment(el.getAttribute("data-segment-id"));
        return;
      case "back-to-channels":
        this.onBackToChannels();
        return;
      case "confirm-channel":
        this.onConfirmChannel();
        return;
      case "toggle-theme":
        this._toggleTheme();
        return;
      case "toggle-menu":
        if (this.ui.menuOpen) {
          this.ui.menuOpen = false;
          this.ui.mode = this.ui.previousMode || this.ui.mode;
          this.ui.menuStack = ["main"];
        } else {
          this.ui.previousMode = this.ui.mode;
          this.ui.menuOpen = true;
          this.ui.menuStack = ["main"];
          this._refreshStatus();
        }
        this._scheduleRender();
        return;
      case "menu-open-panel": {
        const panel = el.getAttribute("data-panel");
        if (!panel) return;
        this.ui.menuStack = [...(this.ui.menuStack || ["main"]), panel];
        if (panel === "wifi-setup") {
          this.ui.wifiScanResults = null;
          this.ui.wifiSelectedSSID = null;
          this.ui.wifiPassword = "";
          this.ui.wifiConnecting = false;
          this.ui.wifiRedirectIP = null;
        }
        this._scheduleRender();
        if (panel === "wifi-setup") this._startWifiScan();
        return;
      }
      case "menu-back": {
        const stack = this.ui.menuStack || ["main"];
        stack.pop();
        if (stack.length === 0) {
          this.ui.menuOpen = false;
          this.ui.mode = this.ui.previousMode || "control";
          this.ui.menuStack = ["main"];
        } else {
          this.ui.menuStack = stack;
        }
        this._scheduleRender();
        return;
      }

      case "menu-wifi-select": {
        const ssid = el.getAttribute("data-ssid");
        if (!ssid) return;
        this.ui.wifiSelectedSSID = ssid;
        this.ui.wifiPassword = "";
        this._scheduleRender();
        return;
      }

      case "menu-wifi-scan":
        this.ui.wifiScanResults = null;
        this.ui.wifiSelectedSSID = null;
        this.ui.wifiPassword = "";
        this._scheduleRender();
        this._startWifiScan();
        return;

      case "menu-wifi-connect": {
        const ssid = this.ui.wifiSelectedSSID;
        const password = this.ui.wifiPassword || "";
        if (!ssid) return;
        this.ui.wifiConnecting = true;
        this._scheduleRender();
        API.wifiConnect(ssid, password)
          .then((result) => {
            this.ui.wifiConnecting = false;
            if (result.connected) {
              this.ui.wifiRedirectIP = result.ip;
              this._scheduleRender();
              setTimeout(() => {
                window.location.href = "http://" + result.ip;
              }, 3000);
            } else {
              this._toast("Connection failed. Check password.");
              this._scheduleRender();
            }
          })
          .catch((err) => {
            console.error(err);
            this.ui.wifiConnecting = false;
            this._toast("Connection error");
            this._scheduleRender();
          });
        return;
      }

      case "menu-ap-password": {
        const pw = prompt("Enter new AP password (min 8 characters):");
        if (!pw || pw.length < 8) {
          this._toast("Password must be at least 8 characters");
          return;
        }
        this.data.config.ap = this.data.config.ap || {};
        this.data.config.ap.password = pw;
        API.putConfig(clone(this.data.config))
          .then(() => {
            this.data.config.ap = this.data.config.ap || {};
            this.data.config.ap.hasPassword = true;
            this._toast("AP password updated");
          })
          .catch((err) => {
            console.error(err);
            this._toast("Failed to save password");
          });
        return;
      }

      case "menu-ota-retry":
        this.ui.otaStatus = null;
        this.ui.otaError = null;
        this._scheduleRender();
        return;
      case "menu-check-update":
        this._handleUpdateCheck();
        return;
      case "menu-install-update":
        this._handleOtaInstall();
        return;
      case "menu-update-ui":
        this._handleUiUpload();
        return;
      case "menu-export-channels":
        this._handleExport("channels");
        return;
      case "menu-export-programs":
        this._handleExport("programs");
        return;
      case "menu-export-network":
        this._handleExport("network");
        return;
      case "menu-import-channels":
        this._handleImport("channels");
        return;
      case "menu-import-programs":
        this._handleImport("programs");
        return;
      case "menu-import-network":
        this._handleImport("network");
        return;
      case "menu-reboot":
        if (!confirm("Reboot the controller now?")) return;
        API.reboot().catch(() => {});
        this._showUploadOverlay("Controller is rebooting...");
        setTimeout(() => window.location.reload(), 4000);
        return;
      case "menu-factory-reset":
        alert("Factory reset is not enabled yet. The immutable factory image partition must be added before this action is safe.");
        return;
      case "preset-new":
        this._openCreatePreset();
        return;

      case "preset-edit":
        this._openEditPreset(el.getAttribute("data-preset-id"));
        return;

      case "preset-modal-close":
        this._closePresetModal();
        return;

      case "preset-add-target":
        this._addChannelToDraftPreset(el.getAttribute("data-channel"));
        return;

      case "preset-remove-target":
        this._removeTargetFromDraft(parseInt(el.getAttribute("data-index"), 10));
        return;

      case "preset-edit-target":
        this._editTargetInDraft(parseInt(el.getAttribute("data-index"), 10));
        return;

      case "program-segment-create":
        this._openCreateProgramSegment(
          parseInt(el.getAttribute("data-target-index"), 10)
        );
        return;

      case "program-segment-edit":
        this._openEditProgramSegment(
          parseInt(el.getAttribute("data-target-index"), 10),
          el.getAttribute("data-segment-id")
        );
        return;

      case "program-segment-delete":
        this._deleteProgramSegment(
          parseInt(el.getAttribute("data-target-index"), 10),
          el.getAttribute("data-segment-id")
        );
        return;

      case "program-segment-cancel":
        this._closeProgramSegmentModal();
        return;

      case "program-segment-save":
        this._saveProgramSegmentForm();
        return;

      case "preset-target-segment": {
        const segmentId = el.getAttribute("data-segment-id");
        const modal = this.ui.presetModal;
        const target = modal?.draft.targets?.[modal.editingTargetIndex];
        if (target?.segments?.some((segment) => segment.segmentId === segmentId)) {
          modal.editingSegmentId = segmentId;
          this._scheduleRender();
        }
        return;
      }

      case "preset-target-back":
        this._exitTargetEdit(false); // false = revert
        return;

      case "preset-target-save":
        this._exitTargetEdit(true); // true = save target state to draft
        return;

      case "preset-save":
        this._commitDraftPreset();
        return;

      case "preset-delete":
        this._deletePreset();
        return;

      case "save-to-preset":
        this._openSaveToPreset();
        return;

      case "preset-pick-existing":
        this.ui.presetModal.selectedExistingId = el.getAttribute("data-preset-id");
        this.ui.presetModal.newName = "";
        this._scheduleRender();
        return;

      case "preset-save-from-control":
        this._commitSaveToPreset();
        return;

      case "preset-card-swipe":
        // Cards register a swipe via pointer events (see _wireEvents addition below)
        return;

      case "preset-drawer-toggle": {
        const presetId = el.getAttribute("data-preset-id");
        const side = el.getAttribute("data-side");
        if (!presetId || !side) return;
        const current = this.ui.presetSwipe[presetId];
        this.ui.presetSwipe[presetId] = current === side ? null : side;
        this._scheduleRender();
        return;
      }

      case "preset-card-swipe":
        // Reserved for future swipe gesture
        return;

      case "preset-toggle-enabled": {
        // Handled in onChange (it's a checkbox)
        return;
      }

      case "trigger-type": {
        const presetId = el.getAttribute("data-preset-id");
        const side = el.getAttribute("data-side");
        const type = el.getAttribute("data-type");
        this._setTriggerType(presetId, side, type);
        return;
      }

      case "trigger-input-id": {
        const presetId = el.getAttribute("data-preset-id");
        const side = el.getAttribute("data-side");
        const value = el.getAttribute("data-value");
        this._updateTriggerField(presetId, side, "inputId", value);
        return;
      }

      case "trigger-edge": {
        const presetId = el.getAttribute("data-preset-id");
        const side = el.getAttribute("data-side");
        const value = el.getAttribute("data-value");
        this._updateTriggerField(presetId, side, "edge", value);
        return;
      }

      case "trigger-behavior": {
        const presetId = el.getAttribute("data-preset-id");
        const side = el.getAttribute("data-side");
        const value = el.getAttribute("data-value");
        this._updateTriggerField(presetId, side, "behavior", value);
        return;
      }

      case "trigger-clock-day": {
        const presetId = el.getAttribute("data-preset-id");
        const side = el.getAttribute("data-side");
        const day = parseInt(el.getAttribute("data-day"), 10);
        this._toggleClockDay(presetId, side, day);
        return;
      }

      case "end-action-type": {
        const presetId = el.getAttribute("data-preset-id");
        const value = el.getAttribute("data-value");
        this._updateEndAction(presetId, "action", value);
        return;
      }
    }
  }

  async onChange(e) {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.getAttribute("data-action");

    if (action === "program-segment-name") {
      if (this.ui.programSegmentModal?.draft) {
        this.ui.programSegmentModal.draft.name = el.value;
      }
      return;
    }

    if (action === "program-segment-start") {
      if (this.ui.programSegmentModal?.draft) {
        this.ui.programSegmentModal.draft.start =
          parseInt(el.value, 10) || 0;
        this._scheduleRender();
      }
      return;
    }

    if (action === "program-segment-end") {
      if (this.ui.programSegmentModal?.draft) {
        this.ui.programSegmentModal.draft.end =
          parseInt(el.value, 10) || 0;
        this._scheduleRender();
      }
      return;
    }

    if (action === "segment-name-input") {
      if (this.ui.segmentModal?.draft) this.ui.segmentModal.draft.name = el.value;
      return;
    }

    if (action === "segment-start-input") {
      if (this.ui.segmentModal?.draft) {
        this.ui.segmentModal.draft.start = parseInt(el.value, 10) || 0;
        this._scheduleRender();
      }
      return;
    }

    if (action === "segment-end-input") {
      if (this.ui.segmentModal?.draft) {
        this.ui.segmentModal.draft.end = parseInt(el.value, 10) || 0;
        this._scheduleRender();
      }
      return;
    }

    if (action === "toggle-running") {
      const id = el.getAttribute("data-channel");
      const running = !!el.checked;
      const channel = this.data.channels.find((item) => item.id === id);

      if (!channel) return;

      if (channel.type !== "addressable") {
        this.commitChannelEdit(id, { running }, { persist: true });
        return;
      }

      el.disabled = true;

      try {
        await API.setChannelRunning(id, running);

        for (const segment of channel.segments || []) {
          segment.deviceState.running = running;
          segment.state.running = running;
        }

        channel.deviceState.running = running;
        channel.state.running = running;

        this._scheduleRender();
      } catch (error) {
        console.error("[VISTA] channel toggle failed", error);
        el.checked = !running;
        this._toast("Unable to update channel");
      } finally {
        el.disabled = false;
      }

      return;
    }

    if (action === "menu-wifi-toggle") {
      const config = this.data.config;
      config.wifi = config.wifi || {};
      config.wifi.enabled = el.checked;
      API.putConfig(clone(config)).catch((err) => {
        console.error(err);
        this._toast("Failed to save Wi-Fi setting");
      });
      this._scheduleRender();
      return;
    }

    if (action === "menu-ap-security-toggle") {
      const config = this.data.config;
      config.ap = config.ap || {};
      const newValue = el.checked;
      if (newValue && !config.ap.hasPassword) {
        const pw = prompt("Set an AP password (min 8 characters):");
        if (!pw || pw.length < 8) {
          this._toast("Password must be at least 8 characters");
          el.checked = false;
          return;
        }
        config.ap.secure = true;
        config.ap.password = pw;
        API.putConfig(clone(config))
          .then(() => {
            config.ap.secure = true;
            config.ap.hasPassword = true;
            this._toast("AP secured");
            this._scheduleRender();
          })
          .catch((err) => {
            console.error(err);
            el.checked = false;
            this._toast("Failed to save");
          });
      } else {
        config.ap.secure = newValue;
        API.putConfig(clone(config)).catch((err) => {
          console.error(err);
          this._toast("Failed to save AP setting");
        });
        this._scheduleRender();
      }
      return;
    }

    if (action === "menu-theme-toggle") {
      this.ui.theme = el.checked ? "dark" : "light";
      this._applyTheme();
      try {
        localStorage.setItem("vista.theme", this.ui.theme);
      } catch (_) {}
      this._scheduleRender();
      return;
    }

    if (action === "menu-wifi-password") {
      this.ui.wifiPassword = el.value;
      return;
    }

    if (action === "preset-name-input") {
      if (this.ui.presetModal?.draft) {
        this.ui.presetModal.draft.name = el.value;
      }
      return;
    }

    if (action === "preset-new-name-input") {
      if (this.ui.presetModal) {
        this.ui.presetModal.newName = el.value;
        this.ui.presetModal.selectedExistingId = null;
      }
      return;
    }

    if (action === "preset-toggle-enabled") {
      const presetId = el.getAttribute("data-preset-id");
      const binding = this._ensureBinding(presetId);
      binding.enabled = el.checked;
      this._scheduleBuilderSave();
      this._scheduleRender();
      return;
    }

    if (action === "trigger-threshold") {
      const presetId = el.getAttribute("data-preset-id");
      const side = el.getAttribute("data-side");
      const v = parseInt(el.value, 10);
      this._updateTriggerField(presetId, side, "threshold", v);
      return;
    }

    if (action === "trigger-seconds") {
      const presetId = el.getAttribute("data-preset-id");
      const side = el.getAttribute("data-side");
      const v = parseInt(el.value, 10);
      this._updateTriggerField(presetId, side, "seconds", v);
      return;
    }

    if (action === "trigger-cycle-source") {
      const presetId = el.getAttribute("data-preset-id");
      const [countChannelId, countSegmentId] =
        String(el.value || "").split("|");

      this._updateTriggerField(
        presetId,
        "end",
        "countChannelId",
        countChannelId || ""
      );

      this._updateTriggerField(
        presetId,
        "end",
        "countSegmentId",
        countSegmentId || ""
      );

      return;
    }

    if (action === "trigger-cycles") {
      const presetId = el.getAttribute("data-preset-id");
      const side = el.getAttribute("data-side");
      const v = parseInt(el.value, 10);
      this._updateTriggerField(presetId, side, "count", v);
      return;
    }

    if (action === "trigger-clock-hour") {
      const presetId = el.getAttribute("data-preset-id");
      const side = el.getAttribute("data-side");
      const v = Math.max(0, Math.min(23, parseInt(el.value, 10) || 0));
      this._updateTriggerField(presetId, side, "hour", v);
      return;
    }

    if (action === "trigger-clock-minute") {
      const presetId = el.getAttribute("data-preset-id");
      const side = el.getAttribute("data-side");
      const v = Math.max(0, Math.min(59, parseInt(el.value, 10) || 0));
      this._updateTriggerField(presetId, side, "minute", v);
      return;
    }

    if (action === "trigger-clock-repeat") {
      const presetId = el.getAttribute("data-preset-id");
      const side = el.getAttribute("data-side");
      this._updateTriggerField(presetId, side, "repeat", el.checked);
      return;
    }

    if (action === "trigger-link-preset") {
      const presetId = el.getAttribute("data-preset-id");
      const side = el.getAttribute("data-side");
      this._updateTriggerField(presetId, side, "presetId", el.value);
      return;
    }

    if (action === "end-action-link") {
      const presetId = el.getAttribute("data-preset-id");
      this._updateEndAction(presetId, "linkName", el.value);
      return;
    }
    if (action === "trigger-link-name") {
      this._updateTriggerField(el.getAttribute("data-preset-id"), el.getAttribute("data-side"), "linkName", el.value.trim());
      return;
    }
    if (action === "end-action-link-name") {
      this._updateEndAction(el.getAttribute("data-preset-id"), "linkName", el.value.trim());
      return;
    }
  }

  onInput(e) {
    const el = e.target.closest("[data-action]");
    if (!el) return;

    const action = el.getAttribute("data-action");
    if (action === "segment-name-input" && this.ui.segmentModal?.draft) {
      this.ui.segmentModal.draft.name = el.value;
    }
  }

  async refreshAddressableLength(channelId) {
    const [config, channelsDoc] = await Promise.all([API.getConfig(), API.getChannels()]);

    this.data.config = config || {};
    this.data.channels = normalizeChannels(this.data.config, channelsDoc || {});

    const fresh = this.data.channels.find((channel) => channel.id === channelId);

    if (fresh && this.ui.activeChannelId === channelId) {
      this.ui.preEditSnapshot = clone(fresh);
    }

    this._scheduleRender();
  }

  async onRedetectLength() {
    const channelId = this.ui.activeChannelId;
    if (!channelId) return;

    try {
      this._toast("Detecting strip length...");
      await API.redetectLength(channelId);

      setTimeout(async () => {
        try {
          await this.refreshAddressableLength(channelId);
          this._toast("Strip length updated");
        } catch (error) {
          console.error("[VISTA] length refresh failed", error);
          this._toast("Detection finished, but refresh failed");
        }
      }, 5000);
    } catch (error) {
      console.error("[VISTA] length detection failed", error);
      this._toast("Unable to detect strip length");
    }
  }

  async onPhysicalPixelCountChange(event) {
    const channelId = this.ui.activeChannelId;
    const physicalPixelCount = Number(event.detail?.physicalPixelCount);

    if (!channelId || !Number.isInteger(physicalPixelCount)) {
      return;
    }

    try {
      await API.setPhysicalPixelCount(channelId, physicalPixelCount);

      await this.refreshAddressableLength(channelId);
      this._toast("Strip length saved");
    } catch (error) {
      console.error("[VISTA] physical length update failed", error);
      this._toast("Unable to save strip length");
    }
  }

  /** Channel widget emits its full state on every edit. */
  onChannelChange(e) {
    const newState = e.detail?.state;
    if (!newState) return;

    // In preset target edit mode, target the channel being edited
    if (this.ui.presetModal?.mode === "edit-target") {
      const modal = this.ui.presetModal;
      const target = modal.draft.targets[modal.editingTargetIndex];
      const segment = this._getEditingPresetSegment();
      if (target && segment) {
        const channel = this.data.channels.find((item) => item.id === target.channelId);
        segment.state = clone(newState);
        segment.deviceState = widgetStateToDevice(
          channel?.type, { ...newState, running: true }, segment.deviceState || {});
        clearTimeout(this._programPreviewTimer);
        this._programPreviewTimer = setTimeout(() => {
          API.programPreview({ action: "preview", presetId: modal.draft.id,
            channelId: target.channelId, segmentId: segment.segmentId,
            state: segment.deviceState }).catch((error) =>
              console.warn("[VISTA] program preview failed", error));
        }, Number(this.data.config.liveThrottleMs || CONFIG.liveThrottleMs));
      }
      return;
    }

    // Normal control tab flow
    const id = this.ui.activeChannelId;
    if (!id) return;
    this.commitChannelEdit(id, newState, { persist: false });
  }

  _openSegmentManager() {
    const channel = this.data.channels.find((item) => item.id === this.ui.activeChannelId);
    if (!channel || channel.type !== "addressable") return;

    this.ui.segmentModal = {
      mode: "manage",
      channelId: channel.id,
      segmentId: null,
      draft: null,
    };
    this._scheduleRender();
  }

  _openCreateSegment() {
    const channel = this.data.channels.find((item) => item.id === this.ui.segmentModal?.channelId);
    if (!channel) return;

    const maxPixel = Math.max(0, Number(channel.params?.physicalPixelCount || 1) - 1);
    this.ui.segmentModal = {
      mode: "create",
      channelId: channel.id,
      segmentId: null,
      draft: {
        name: `Segment ${(channel.segments?.length || 0) + 1}`,
        start: 0,
        end: maxPixel,
      },
    };
    this._scheduleRender();
  }

  _openEditSegment(segmentId) {
    const channel = this.data.channels.find((item) => item.id === this.ui.segmentModal?.channelId);
    const segment = channel?.segments?.find((item) => item.segmentId === segmentId);
    if (!channel || !segment) return;

    this.ui.segmentModal = {
      mode: "edit",
      channelId: channel.id,
      segmentId,
      draft: {
        name: segment.name || segmentId,
        start: Number(segment.deviceState.start) || 0,
        end: Number(segment.deviceState.end) || 0,
      },
    };
    this._scheduleRender();
  }

  _newSegmentId(channel) {
    const used = new Set((channel.segments || []).map((segment) => segment.segmentId));
    let index = 1;
    while (used.has(`seg_${index}`)) index++;
    return `seg_${index}`;
  }

  _chooseSegment(segmentId) {
    const channel = this.data.channels.find((item) => item.id === this.ui.segmentModal?.channelId);
    if (!this._selectSegment(channel, segmentId)) return;

    this.ui.segmentModal = null;
    this.ui.preEditSnapshot = clone(channel);
    this._scheduleRender();
  }

  async _saveSegmentForm() {
    if (this.ui.segmentSaving) return;
    const modal = this.ui.segmentModal;
    const channel = this.data.channels.find((item) => item.id === modal?.channelId);
    if (!modal || !channel || !modal.draft) return;

    const maxPixel = Math.max(0, Number(channel.params?.physicalPixelCount || 1) - 1);
    const start = Math.max(0, Math.min(maxPixel, Number(modal.draft.start) || 0));
    const end = Math.max(start, Math.min(maxPixel, Number(modal.draft.end) || 0));
    const name = String(modal.draft.name || "").trim();

    if (!name) {
      this._toast("Segment name required");
      return;
    }

    this.ui.segmentSaving = true;
    this._scheduleRender();

    try {
      if (modal.mode === "create") {
        const segmentId = this._newSegmentId(channel);
        const source = this._getActiveSegment(channel);
        const state = clone(source?.deviceState || {});
        state.start = start;
        state.end = end;

        await API.createSegment(channel.id, segmentId, name, start, end, state);
        await this.refreshAddressableLength(channel.id);

        const refreshed = this.data.channels.find((item) => item.id === channel.id);
        this._selectSegment(refreshed, segmentId);
        this._toast("Segment created");
      } else {
        const existing = channel.segments.find((item) => item.segmentId === modal.segmentId);
        if (!existing) throw new Error("segment not found");

        const state = clone(existing.deviceState || {});
        state.start = start;
        state.end = end;

        await API.updateSegment(channel.id, modal.segmentId, name, start, end, state);
        await this.refreshAddressableLength(channel.id);

        const refreshed = this.data.channels.find((item) => item.id === channel.id);
        this._selectSegment(refreshed, modal.segmentId);
        this._toast("Segment updated");
      }

      this.ui.segmentModal = null;
      this.ui.preEditSnapshot = clone(this.data.channels.find((item) => item.id === channel.id));
      this._scheduleRender();
    } catch (error) {
      console.error("[VISTA] segment save failed", error);

      try {
        await this.refreshAddressableLength(channel.id);

        const refreshed = this.data.channels.find((item) => item.id === channel.id);

        const expectedSegmentId = modal.mode === "create" ? this._newSegmentId(channel) : modal.segmentId;

        const savedSegment = refreshed?.segments?.find((segment) => segment.segmentId === expectedSegmentId || (segment.name === name && Number(segment.deviceState.start) === start && Number(segment.deviceState.end) === end));

        if (savedSegment) {
          this._selectSegment(refreshed, savedSegment.segmentId);

          this.ui.segmentModal = null;
          this.ui.preEditSnapshot = clone(refreshed);
          this._toast("Segment saved");
          return;
        }
      } catch (refreshError) {
        console.warn("[VISTA] segment recovery refresh failed", refreshError);
      }

      this._toast("Unable to save segment");
    } finally {
      this.ui.segmentSaving = false;
      this._scheduleRender();
    }
  }

  async _deleteSegment(segmentId) {
    const channel = this.data.channels.find((item) => item.id === this.ui.segmentModal?.channelId);
    const segment = channel?.segments?.find((item) => item.segmentId === segmentId);
    if (!channel || !segment) return;
    if ((channel.segments?.length || 0) <= 1) {
      this._toast("The final segment cannot be deleted");
      return;
    }

    if (!confirm(`Delete segment "${segment.name || segmentId}"?`)) return;

    try {
      await API.deleteSegment(channel.id, segmentId);
      await this.refreshAddressableLength(channel.id);

      const refreshed = this.data.channels.find((item) => item.id === channel.id);
      const next = refreshed?.segments?.[0];
      if (next) this._selectSegment(refreshed, next.segmentId);

      this.ui.segmentModal = {
        mode: "manage",
        channelId: channel.id,
        segmentId: null,
        draft: null,
      };
      this.ui.preEditSnapshot = clone(refreshed);
      this._toast("Segment deleted");
      this._scheduleRender();
    } catch (error) {
      console.error("[VISTA] segment delete failed", error);
      this._toast("Unable to delete segment");
    }
  }

  // ---------------- Channel actions ----------------
  async onOpenChannel(id) {
    if (!id) return;
    const ch = this.data.channels.find((item) => item.id === id);
    if (!ch) return;

    this.ui.activeChannelId = id;
    this.ui.activeSegmentId = ch.segments?.[0]?.segmentId || ch.segmentId || "seg_1";
    this._selectSegment(ch, this.ui.activeSegmentId);
    this.ui.preEditSnapshot = clone(ch);
    this.ui.liveEditBegun = false;

    if (ch.type === "addressable" && (ch.segments?.length || 0) > 1) {
      this.ui.segmentModal = {
        mode: "manage",
        channelId: ch.id,
        segmentId: null,
        draft: null,
      };
    }

    this._scheduleRender();

    try {
      await API.liveBegin(id);
      this.ui.liveEditBegun = true;
    } catch (err) {
      console.warn("[VISTA] begin live edit failed", err);
      this._toast("Unable to begin edit");
    }
  }

  async onBackToChannels() {
    const id = this.ui.activeChannelId;
    if (id && this.ui.liveEditBegun) {
      try {
        await API.liveCancel(id);
      } catch (err) {
        console.warn("[VISTA] cancel live edit failed", err);
      }
    }
    if (id && this.ui.preEditSnapshot) {
      const index = this.data.channels.findIndex((item) => item.id === id);
      if (index >= 0) this.data.channels[index] = clone(this.ui.preEditSnapshot);
    }
    this.ui.activeChannelId = null;
    this.ui.preEditSnapshot = null;
    this.ui.liveEditBegun = false;
    this.ui.activeSegmentId = null;
    this.ui.segmentModal = null;
    this._scheduleRender();
  }

  async onConfirmChannel() {
    const id = this.ui.activeChannelId;
    const ch = this.data.channels.find((item) => item.id === id);
    if (!ch) return;
    try {
      await this.commitChannelEdit(id, ch.state, { persist: true });
      this.ui.activeChannelId = null;
      this.ui.preEditSnapshot = null;
      this.ui.liveEditBegun = false;
      this.ui.activeSegmentId = null;
      this.ui.segmentModal = null;
      this._scheduleRender();
    } catch (_) {}
  }
  // ---------------- Helpers ----------------
  _typeLabel(type) {
    return (
      {
        addressable: "Addressable",
        rgbw: "RGBW",
        rgb: "RGB",
        cct: "CCT",
        dim: "Dimming",
        pwm: "PWM",
      }[type] ||
      type ||
      "Channel"
    );
  }
  _modeLabel(mode) {
    return { control: "Control", builder: "Programs", remote: "Remote" }[mode] || "";
  }
  _brightnessFor(ch) {
    const s = ch.state || {};
    if (ch.type === "pwm") {
      const res = s.resolution ?? 10;
      const maxDuty = (1 << res) - 1;
      return maxDuty > 0 ? Math.round(((s.duty ?? 0) / maxDuty) * 100) : 0;
    }
    const raw = ch.type === "dim" ? (s.level ?? 0) : (s.brightness ?? 0);
    return Math.round((raw / 255) * 100);
  }
  _glowFor(channel) {
    const s = channel.state || {};
    const running = s.running !== false;

    // Off => no glow
    if (!running) return { rgb: "100 130 180", strength: 0 };

    // Helper: blend an RGB array with white-LED warmth based on W
    const mixWhite = (r, g, b, w) => {
      const wNorm = (w || 0) / 255;
      const rOut = Math.round(r * (1 - wNorm) + 255 * wNorm);
      const gOut = Math.round(g * (1 - wNorm) + 200 * wNorm);
      const bOut = Math.round(b * (1 - wNorm) + 130 * wNorm);
      return `${rOut} ${gOut} ${bOut}`;
    };

    // Addressable: color is [r, g, b, w]
    if (channel.type === "addressable" && Array.isArray(s.color) && s.color.length >= 3) {
      const [r, g, b, w] = [s.color[0] || 0, s.color[1] || 0, s.color[2] || 0, s.color[3] || 0];
      const brightness = (s.brightness ?? 255) / 255;
      return { rgb: mixWhite(r, g, b, w), strength: Math.max(0.15, brightness) };
    }

    // RGBW: r, g, b, w as separate fields
    if (channel.type === "rgbw") {
      const r = s.r ?? 0,
        g = s.g ?? 0,
        b = s.b ?? 0,
        w = s.w ?? 0;
      const brightness = (s.brightness ?? 255) / 255;
      return { rgb: mixWhite(r, g, b, w), strength: Math.max(0.15, brightness) };
    }

    // RGB: no W
    if (channel.type === "rgb") {
      const r = s.r ?? 0,
        g = s.g ?? 0,
        b = s.b ?? 0;
      const brightness = (s.brightness ?? 255) / 255;
      return { rgb: `${r} ${g} ${b}`, strength: Math.max(0.15, brightness) };
    }

    // CCT: map warm/cool to tinted color
    if (channel.type === "cct") {
      const warm = s.warm ?? 0,
        cool = s.cool ?? 0;
      const total = Math.max(1, warm + cool);
      const warmRatio = warm / total;
      const r = Math.round(255 * warmRatio + 200 * (1 - warmRatio));
      const g = Math.round(170 * warmRatio + 230 * (1 - warmRatio));
      const b = Math.round(80 * warmRatio + 255 * (1 - warmRatio));
      const brightness = (s.brightness ?? 255) / 255;
      return { rgb: `${r} ${g} ${b}`, strength: Math.max(0.15, brightness) };
    }

    // DIM: warm amber
    if (channel.type === "dim") {
      const level = (s.level ?? 0) / 255;
      return { rgb: "255 200 140", strength: Math.max(0, level) };
    }

    // PWM: cool blue
    if (channel.type === "pwm") {
      const duty = s.duty ?? 0;
      const max = (1 << (s.resolution ?? 10)) - 1;
      const ratio = max > 0 ? duty / max : 0;
      return { rgb: "120 180 255", strength: Math.max(0, ratio) };
    }

    return { rgb: "100 130 180", strength: 0 };
  }
  _modeTitle(mode) {
    return { control: "Control", builder: "Programs", remote: "Remote" }[mode] || "VISTA";
  }

  _rssiToLabel(rssi) {
    if (rssi >= -55) return "Strong";
    if (rssi >= -70) return "Good";
    if (rssi >= -85) return "Weak";
    return "Poor";
  }

  async _refreshStatus() {
    try {
      this.data.status = await API.getStatus();
      this._scheduleRender();
    } catch (err) {
      console.warn("[VISTA] status refresh failed", err);
    }
  }

  async _startWifiScan() {
    try {
      const result = await API.scanWifi();
      const networks = Array.isArray(result?.networks) ? result.networks : [];
      networks.sort((a, b) => (b.rssi || -999) - (a.rssi || -999));
      this.ui.wifiScanResults = networks;
      this._scheduleRender();
    } catch (err) {
      console.error("[VISTA] wifi scan failed", err);
      this.ui.wifiScanResults = [];
      this._scheduleRender();
    }
  }

  _showUploadOverlay(text = "Uploading...") {
    let overlay = document.querySelector(".upload-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "upload-overlay";
      overlay.innerHTML = `
        <div class="upload-overlay__card">
          <div class="upload-overlay__spinner"></div>
          <div class="upload-overlay__text"></div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    overlay.querySelector(".upload-overlay__text").textContent = text;
    requestAnimationFrame(() => overlay.classList.add("is-active"));
  }

  _hideUploadOverlay() {
    const overlay = document.querySelector(".upload-overlay");
    if (overlay) overlay.classList.remove("is-active");
  }

  async _waitForControllerAfterOta() {
    const deadline = Date.now() + 45000;

    // Give the ESP32 time to leave the current firmware and begin rebooting.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    while (Date.now() < deadline) {
      try {
        const response = await fetch(
          `${ENDPOINTS.status}?otaReload=${Date.now()}`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache",
            },
          }
        );

        if (response.ok) {
          const url = new URL(window.location.href);
          url.searchParams.set("otaReload", String(Date.now()));
          window.location.replace(url.toString());
          return;
        }
      }
      catch (_) {
        // Connection errors are expected while the ESP32 is rebooting.
      }

      await new Promise((resolve) => setTimeout(resolve, 750));
    }

    this.ui.otaStatus = "error";
    this.ui.otaError =
      "Firmware was uploaded, but the controller did not reconnect automatically. Refresh this page after the device finishes rebooting.";
    this._scheduleRender();
  }
  async _handleUpdateCheck() {
    this.ui.updateCheck = {
      checking: true,
      available: false,
      error: null
    };

      this._scheduleRender();

      try {
        const response = await fetch(ENDPOINTS.otacheck, {
          method: "POST"
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(
            result.error || `Update check failed (${response.status})`
          );
        }

        this.ui.updateCheck = {
          checking: false,
          available: result.updateAvailable,
          currentVersion: result.currentVersion,
          availableVersion: result.availableVersion,
          releaseChannel: result.releaseChannel,
          error: null
        };

        if (result.updateAvailable) {
          this._toast(
            `Firmware ${result.availableVersion} is available`
          );
        } else {
          this._toast("Your firmware is up to date");
        }
      } catch (error) {
        console.error("Firmware update check failed:", error);

        this.ui.updateCheck = {
          checking: false,
          available: false,
          error: error.message || "Unable to check for updates"
        };

        this._toast("Unable to check for firmware updates");
      }

      this._scheduleRender();
    }
  async _handleOtaInstall() {
    const update = this.ui.updateCheck;

    if (!update?.available) {
      this._toast("No firmware update is available");
      return;
    }

    if (
      !confirm(
        `Install firmware v${update.availableVersion}? The controller will reboot during the update.`
      )
    ) {
      return;
    }

    this.ui.otaStatus = "starting";
    this.ui.otaError = null;
    this._scheduleRender();

    try {
      const response = await fetch(ENDPOINTS.otafirmware, {
        method: "POST"
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.error || `Update failed (${response.status})`
        );
      }

      this.ui.otaStatus = "rebooting";
      this._scheduleRender();

      this._waitForControllerAfterOta();
    } catch (error) {
      // The controller may reboot before the browser receives the complete
      // response. Once OTA is triggered, a connection loss is not
      // necessarily a failed update.
      console.warn("OTA connection ended:", error);

      this.ui.otaStatus = "rebooting";
      this._scheduleRender();

      this._waitForControllerAfterOta();
    }
  }

  _handleUiUpload() {
    const pathMap = {
      "index.html": "/index.html",
      "styles.css": "/styles.css",
      "app.js": "/app.js",
      "ui.js": "/components/ui.js",
      "color-wheel.js": "/components/color-wheel.js",
      "channel-cards.js": "/components/channel-cards.js",
      "Vista-Logo-Thumbnail-White.png": "/Vista-Logo-Thumbnail-White.png",
      "Vista-Logo-Thumbnail-Dark.png": "/Vista-Logo-Thumbnail-Dark.png",
    };
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".html,.css,.js,.png,.svg";
    input.onchange = async (ev) => {
      const files = Array.from(ev.target.files || []);
      if (!files.length) return;
      const invalid = files.filter((f) => !pathMap[f.name]);
      if (invalid.length) {
        this._toast(`Unknown files: ${invalid.map((f) => f.name).join(", ")}`);
        return;
      }
      if (!confirm(`Upload ${files.length} file(s)?\n${files.map((f) => f.name).join("\n")}\n\nThis replaces existing UI files.`)) return;
      this._showUploadOverlay("Uploading UI files...");
      try {
        for (const file of files) {
          const path = pathMap[file.name];
          this._showUploadOverlay(`Uploading ${file.name}...`);
          await API.otaUI(file, path);
        }
        this._showUploadOverlay("Upload complete. Reloading...");
        setTimeout(() => window.location.reload(), 2000);
      } catch (err) {
        console.error(err);
        this._hideUploadOverlay();
        this._toast("UI upload failed");
      }
    };
    input.click();
  }

  async _handleExport(kind) {
    try {
      let data;
      let filename;
      if (kind === "channels") {
        data = await API.getChannels();
        filename = "channels.json";
      } else if (kind === "programs") {
        data = await API.getPrograms();
        filename = "programs.json";
      } else if (kind === "network") {
        data = await API.getConfigRaw();
        filename = "config.json";
      } else {
        throw new Error("Unknown export type");
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      this._toast(`${filename} exported`);
    } catch (err) {
      console.error("[VISTA] export failed", err);
      this._toast("Export failed");
    }
  }

  _handleImport(kind) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (ev) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        let data;
        try {
          data = JSON.parse(e.target.result);
        } catch {
          this._toast("Invalid JSON file");
          return;
        }

        this._showUploadOverlay(`Importing ${kind}...`);
        try {
          if (kind === "channels") {
            await API.putChannels(data);
          } else if (kind === "programs") {
            await API.putPrograms(data);
          } else if (kind === "network") {
            // Full-file replace via the dedicated import endpoint, not section-merge PUT
            const res = await fetch(ENDPOINTS.configImport, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error(`import failed: ${res.status}`);
          }
          this._hideUploadOverlay();
          this._toast(`${kind} imported`);
          await this.reloadFromDevice();
          this._scheduleRender();
        } catch (err) {
          this._hideUploadOverlay();
          console.error(err);
          this._toast(`${kind} import failed`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  async _saveProgramsFromUi() {
    const payload = clone(this.data.programs || {});

    payload.$schema = payload.$schema || 1;
    payload.version = payload.version || 1;
    payload.inputs = clone(this.data.programInputs || []);
    payload.scenes = clone(this.data.scenes || {});
    payload.programs = clone(this.data.programRules || {});

    await API.putPrograms(payload);

    this.data.programs = payload;
    this.data.programInputs = payload.inputs;
    this.data.scenes = payload.scenes;
    this.data.programRules = payload.programs;
  }

  // ---------------- Preset modal lifecycle ----------------
  _sceneToDraft(sceneId, scene = {}) {
    const targets = Object.entries(scene.targets || {}).map(([channelId, output]) => {
      const channel = this.data.channels.find((item) => item.id === channelId);
      const segments = Object.entries(output || {})
        .filter(([key, value]) => key !== "active" && value && typeof value === "object")
        .map(([segmentId, segment]) => {
          const deviceState = clone(segment.state || {});
          return { segmentId, name: segment.name || segmentId, deviceState,
            state: deviceStateToWidget(channel?.type, deviceState, channel || {}) };
        });
      return { channelId, segments };
    });
    return { id: sceneId, name: scene.name || sceneId, enabled: scene.enabled !== false, targets };
  }

  _openCreatePreset() {
    this.ui.presetModal = {
      mode: "create",
      draft: { id: this._newPresetId(), name: "", enabled: true, targets: [] },
      editingTargetIndex: null, editingSegmentId: null, originalId: null,
      touchedChannels: new Set(), channelBaselines: {}, previewChannelId: null,
    };
    this._scheduleRender();
  }

  _openEditPreset(sceneId) {
    const scene = this.data.scenes?.[sceneId];
    if (!scene) return;
    const baselines = {};
    for (const channelId of Object.keys(scene.targets || {})) {
      const channel = this.data.channels.find((item) => item.id === channelId);
      if (channel) baselines[channelId] = clone(channel);
    }
    this.ui.presetModal = {
      mode: "edit", draft: this._sceneToDraft(sceneId, scene),
      editingTargetIndex: null, editingSegmentId: null, originalId: sceneId,
      touchedChannels: new Set(), channelBaselines: baselines, previewChannelId: null,
    };
    this._scheduleRender();
  }

  async _closePresetModal() {
    const touched = this.ui.presetModal?.touchedChannels;
    if (touched && touched.size > 0) {
      for (const id of touched) await this._revertChannelToBaseline(id);
    }
    try {
      await API.patchPrograms({ action: "reload" });
    } catch (_) {}
    this.ui.presetModal = null;
    await this.reloadFromDevice();
    this._scheduleRender();
  }

  _newPresetId() {
    return "preset_" + Math.random().toString(36).slice(2, 10);
  }

  _addChannelToDraftPreset(channelId) {
    const modal = this.ui.presetModal;
    if (!modal || !channelId) return;

    const channel = this.data.channels.find(
      (item) => item.id === channelId
    );

    if (!channel) return;

    const alreadyAdded = modal.draft.targets.some(
      (target) => target.channelId === channelId
    );

    if (alreadyAdded) return;

    if (channel.type === "addressable") {
      modal.draft.targets.push({
        channelId,
        segments: [],
      });
    } else {
      modal.draft.targets.push({
        channelId,
        segments: [
          {
            segmentId: "seg_1",
            name: channel.name || "Output",
            state: clone(channel.state || {}),
            deviceState: clone(channel.deviceState || {}),
          },
        ],
      });
    }

    this._scheduleRender();
  }

  _removeTargetFromDraft(idx) {
    if (!this.ui.presetModal) return;
    this.ui.presetModal.draft.targets.splice(idx, 1);
    this._scheduleRender();
  }

  async _stageDraftTarget(sceneDraft, target) {
    const sceneId = sceneDraft?.id;
    const channelId = target?.channelId;

    if (!sceneId || !channelId) {
      console.error(
        "[VISTA] Cannot stage target",
        {
          sceneId,
          channelId,
        }
      );

      return false;
    }

    try {
      this.data.programs =
        this.data.programs || {};

      this.data.programs.scenes =
        this.data.programs.scenes || {};

      let scene =
        this.data.programs.scenes[sceneId];

      /*
      * Create the scene only when the current device-backed
      * programs model does not contain it.
      */
      if (!scene) {
        await API.patchPrograms({
          action: "createScene",
          presetId: sceneId,

          changes: {
            name:
              sceneDraft.name || sceneId,

            enabled:
              sceneDraft.enabled !== false,
          },
        });

        scene = {
          name:
            sceneDraft.name || sceneId,

          enabled:
            sceneDraft.enabled !== false,

          targets: {},
        };

        this.data.programs.scenes[sceneId] =
          scene;
      }

      scene.targets =
        scene.targets || {};

      let output =
        scene.targets[channelId];

      /*
      * Create the channel target only when that target does
      * not already exist in the device-backed scene model.
      */
      if (!output) {
        await API.patchPrograms({
          action: "createTarget",
          presetId: sceneId,
          channelId,
        });

        output = {};

        scene.targets[channelId] =
          output;
      }

      /*
      * Create only program segments missing from the
      * device-backed target model.
      */
      for (const segment of target.segments || []) {
        const segmentId =
          segment.segmentId || "seg_1";

        if (output[segmentId]) {
          continue;
        }

        const state = clone(
          segment.deviceState || {}
        );

        await API.patchPrograms({
          action: "createSegment",
          presetId: sceneId,
          channelId,
          segmentId,

          changes: {
            name:
              segment.name || segmentId,

            state,
          },
        });

        output[segmentId] = {
          name:
            segment.name || segmentId,

          state,
        };
      }

      /*
      * Keep both UI references pointed to the same direct
      * programs.json scene object.
      */
      this.data.scenes =
        this.data.programs.scenes;

      return true;
    }
    catch (error) {
      console.error(
        "[VISTA] stage target failed",
        error
      );

      this._toast(
        "Unable to prepare program preview"
      );

      return false;
    }
  }

  async _editTargetInDraft(index) {
    const modal = this.ui.presetModal;

    if (!modal) {
      return;
    }

    const target = modal.draft.targets?.[index];

    if (!target) {
      return;
    }

    const channel = this.data.channels.find(
      (item) => item.id === target.channelId
    );

    if (!channel) {
      this._toast("Channel not found");
      return;
    }

    target.segments = Array.isArray(target.segments)
      ? target.segments
      : [];

    modal.editingTargetIndex = index;
    modal.editingSegmentId =
      target.segments[0]?.segmentId || null;
    modal.mode = "edit-target";

    /*
    * A blank addressable target is valid.
    *
    * Open the target editor without starting a hardware preview.
    * The user can create the first program segment from there.
    */
    if (
      channel.type === "addressable" &&
      target.segments.length === 0
    ) {
      this._scheduleRender();
      return;
    }

    /*
    * Non-addressable targets and addressable targets that already
    * contain segments can immediately begin hardware preview.
    */
    if (target.segments.length === 0) {
      this._toast("Target has no output state");
      modal.editingTargetIndex = null;
      modal.editingSegmentId = null;
      modal.mode = modal.originalId
        ? "edit"
        : "create";

      this._scheduleRender();
      return;
    }

    const staged = await this._stageDraftTarget(
      modal.draft,
      target
    );

    if (!staged) {
      modal.editingTargetIndex = null;
      modal.editingSegmentId = null;
      modal.mode = modal.originalId
        ? "edit"
        : "create";

      this._scheduleRender();
      return;
    }

    modal.touchedChannels.add(target.channelId);

    try {
      await API.programPreview({
        action: "begin",
        presetId: modal.draft.id,
        channelId: target.channelId,
      });

      modal.previewChannelId = target.channelId;

      for (const segment of target.segments) {
        await API.programPreview({
          action: "preview",
          presetId: modal.draft.id,
          channelId: target.channelId,
          segmentId: segment.segmentId,
          state: {
            ...clone(segment.deviceState || {}),
            running: true,
          },
        });
      }
    }
    catch (error) {
      console.error(
        "[VISTA] unable to begin program target preview",
        error
      );

      this._toast("Unable to preview target");
    }

    this._scheduleRender();
  }

  _getEditingPresetSegment() {
    const modal = this.ui.presetModal;
    if (!modal || modal.mode !== "edit-target") return null;
    const target = modal.draft.targets[modal.editingTargetIndex];
    return target?.segments?.find((segment) => segment.segmentId === modal.editingSegmentId)
      || target?.segments?.[0] || null;
  }

  async _exitTargetEdit(saveChanges) {
    const modal = this.ui.presetModal;

    if (!modal) {
      return;
    }

    const target =
      modal.draft.targets?.[modal.editingTargetIndex];

    const hasSegments =
      Array.isArray(target?.segments) &&
      target.segments.length > 0;

    try {
      if (target && hasSegments) {
        if (saveChanges) {
          const card = this.querySelector(
            '[data-role="preset-target-card"]'
          );

          const widgetState =
            card?.getChannelState?.();

          const channel = this.data.channels.find(
            (item) => item.id === target.channelId
          );

          const segment =
            this._getEditingPresetSegment();

          if (
            widgetState &&
            channel &&
            segment
          ) {
            segment.state = clone(widgetState);

            segment.deviceState =
              widgetStateToDevice(
                channel.type,
                {
                  ...widgetState,
                  running: true,
                },
                segment.deviceState || {}
              );

            await API.programPreview({
              action: "preview",
              presetId: modal.draft.id,
              channelId: target.channelId,
              segmentId: segment.segmentId,
              state: segment.deviceState,
            });
          }

          await API.programPreview({
            action: "save",
            presetId: modal.draft.id,
            channelId: target.channelId,
          });
          modal.previewChannelId = null;
        }
        else {
          await API.programPreview({
            action: "cancel",
            presetId: modal.draft.id,
            channelId: target.channelId,
          });
          modal.previewChannelId = null;
        }
      }
    }
    catch (error) {
      const message = String(
        error?.message || ""
      );

      if (!message.includes("no active preview")) {
        console.error(
          "[VISTA] target preview close failed",
          error
        );

        this._toast("Target update failed");
        return;
      }
    }

    modal.editingTargetIndex = null;
    modal.editingSegmentId = null;
    modal.mode = modal.originalId
      ? "edit"
      : "create";

    this._scheduleRender();
  }

  _applyTargetToHardware(target) {
    if (!target || !this.ui.presetModal) return;
    API.programPreview({ action: "preview", presetId: this.ui.presetModal.draft.id, channelId: target.channelId, segmentId: target.segmentId || "seg_1", state: target.deviceState || {} }).catch((err) => console.warn("[VISTA] target preview failed", err));
  }

  async _revertChannelToBaseline(channelId) {
    const modal = this.ui.presetModal;

    /*
    * Do not send a cancel request unless this modal currently
    * owns an active preview for this channel.
    */
    if (
      !modal ||
      modal.previewChannelId !== channelId
    ) {
      return;
    }

    try {
      await API.programPreview({
        action: "cancel",
        channelId,
      });
    }
    catch (error) {
      const message = String(
        error?.message || ""
      );

      /*
      * The preview may already have been ended by Save Target.
      * That is an expected state, not a failed preset save.
      */
      if (
        !message.includes("no active preview") &&
        !message.includes("409")
      ) {
        console.warn(
          "[VISTA] program preview cancel failed",
          error
        );
      }
    }
    finally {
      if (
        modal.previewChannelId === channelId
      ) {
        modal.previewChannelId = null;
      }
    }
  }

  async _commitDraftPreset() {
    const modal = this.ui.presetModal;
    const draft = modal?.draft;
    if (!modal || !draft) return;
    const name = String(draft.name || "").trim();
    if (!name) return this._toast("Preset name required");
    if (!draft.targets.length) return this._toast("Add at least one channel");
    const targets = {};
    for (const target of draft.targets) {
      const output = {};
      for (const segment of target.segments || []) {
        output[segment.segmentId] = {
          name: segment.name || segment.segmentId,
          state: clone(segment.deviceState || {}),
        };
      }
      targets[target.channelId] = output;
    }
    const scenes = clone(this.data.scenes || {});
    if (modal.originalId && modal.originalId !== draft.id) delete scenes[modal.originalId];
    scenes[draft.id] = { name, enabled: draft.enabled !== false, targets };
    try {
      this.data.scenes = scenes;
      await this._saveProgramsFromUi();
      for (const channelId of modal.touchedChannels) await this._revertChannelToBaseline(channelId);
      this._toast(modal.originalId ? "Preset updated" : "Preset created");
      this.ui.presetModal = null;
      this._scheduleRender();
    } catch (error) {
      console.error("[VISTA] preset save failed", error);
      this._toast("Save failed");
    }
  }

  async _deletePreset() {
    const modal = this.ui.presetModal;
    if (!modal?.originalId) return;
    if (!confirm(`Delete preset "${modal.draft.name}"?`)) return;
    const scenes = clone(this.data.scenes || {});
    delete scenes[modal.originalId];
    const rules = clone(this.data.programRules || {});
    for (const [programId, rule] of Object.entries(rules)) {
      if (rule.presetId === modal.originalId) delete rules[programId];
    }
    try {
      this.data.scenes = scenes;
      this.data.programRules = rules;
      await this._saveProgramsFromUi();
      for (const channelId of modal.touchedChannels) await this._revertChannelToBaseline(channelId);
      this._toast("Preset deleted");
      this.ui.presetModal = null;
      this._scheduleRender();
    } catch (error) {
      console.error("[VISTA] preset delete failed", error);
      this._toast("Delete failed");
    }
  }

  // ---------------- Save-to-Preset from Control tab ----------------
  _openSaveToPreset() {
    const id = this.ui.activeChannelId;
    if (!id) return;
    this.ui.presetModal = {
      mode: "save-to-preset",
      channelId: id,
      newName: "",
      selectedExistingId: null,
    };
    this._scheduleRender();
  }

  async _commitSaveToPreset() {
    const modal = this.ui.presetModal;
    const channel = this.data.channels.find((item) => item.id === modal?.channelId);
    if (!modal || !channel) return;
    const output = {};
    const sourceSegments = channel.type === "addressable" && channel.segments?.length
      ? channel.segments
      : [{ segmentId: channel.segmentId || "seg_1", name: channel.segmentName || "",
          deviceState: channel.deviceState || {} }];
    for (const segment of sourceSegments) {
      output[segment.segmentId] = {
        name: segment.name || segment.segmentId,
        state: clone(segment.deviceState || {}),
      };
    }
    const scenes = clone(this.data.scenes || {});
    if (modal.selectedExistingId) {
      const scene = scenes[modal.selectedExistingId];
      if (!scene) return this._toast("Preset not found");
      scene.targets = scene.targets || {};
      scene.targets[channel.id] = output;
    } else {
      const name = String(modal.newName || "").trim();
      if (!name) return this._toast("Preset name required");
      scenes[this._newPresetId()] = { name, enabled: true, targets: { [channel.id]: output } };
    }
    try {
      this.data.scenes = scenes;
      await this._saveProgramsFromUi();
      this._toast("Saved to preset");
      this.ui.presetModal = null;
      this._scheduleRender();
    } catch (error) {
      console.error("[VISTA] save to preset failed", error);
      this._toast("Save failed");
    }
  }

  // ---------------- Target summary for preset cards ----------------
  _summarizeTargetState(target, ch) {
    if (!ch) return "Unknown channel";
    const s = target.state || {};
    const parts = [];
    if (ch.type === "addressable") {
      if (s.mode) parts.push(s.mode);
      if (s.brightness != null) parts.push(`br ${s.brightness}`);
    } else if (ch.type === "dim") {
      if (s.level != null) parts.push(`level ${s.level}`);
    } else if (ch.type === "pwm") {
      if (s.duty != null) parts.push(`duty ${s.duty}`);
    } else if (ch.type === "cct") {
      if (s.warm != null && s.cool != null) parts.push(`W${s.warm}/C${s.cool}`);
    } else if (ch.type === "rgbw" || ch.type === "rgb") {
      if (s.r != null) parts.push(`R${s.r} G${s.g} B${s.b}${s.w != null ? ` W${s.w}` : ""}`);
    }
    return parts.join(", ") || "No state";
  }

  _summarizeBinding(binding) {
    if (!binding) return "";

    const start = binding.start || { type: "run" };
    const end = binding.end || { type: "run" };
    const endAction = binding.endAction || { action: "off" };

    const startLabel = this._triggerShortLabel(start);
    const endLabel = this._triggerShortLabel(end);
    const actionLabel = this._endActionShortLabel(endAction);

    return `${startLabel} → ${endLabel} → ${actionLabel}`;
  }

  _triggerShortLabel(trigger) {
    const type = trigger?.type || "none";
    const input = trigger?.inputId || "?";

    if (type === "manual") return "Manual";
    if (type === "none") return "No automatic stop";
    if (type === "inputActive") return `While ${input} is active`;
    if (type === "inputInactive") return `When ${input} is inactive`;
    if (type === "inputRising") return `${input} turns on`;
    if (type === "inputFalling") return `${input} turns off`;
    if (type === "inputToggle") return `Toggle with ${input}`;
    if (type === "clock") return `${trigger.hour ?? 0}:${String(trigger.minute ?? 0).padStart(2, "0")}`;
    if (type === "link") return `Link: ${trigger.linkName || "?"}`;
    if (type === "timer") return `${trigger.seconds ?? "?"}s`;
    if (type === "count") return `${trigger.count ?? "?"} cycles`;
    return type;
  }

  _endActionShortLabel(endAction) {
    const action = endAction?.action || "revert";
    if (action === "revert") return "Live";
    if (action === "off") return "Off";
    if (action === "hold") return "Hold";
    if (action === "link") return `Link: ${endAction.linkName || "?"}`;
    return action;
  }

  // ---------------- Builder binding helpers ----------------

  _getBinding(presetId) {
    const entry = Object.entries(this.data.programRules || {}).find(([, rule]) => rule.presetId === presetId);

    if (!entry) return null;

    const [programId, rule] = entry;

    return {
      ...rule,
      programId,
    };
  }

  _ensureBinding(presetId) {
    this.data.programRules = this.data.programRules || {};

    const existing = this._getBinding(presetId);

    if (existing) {
      return this.data.programRules[existing.programId];
    }

    const programId = `program_${presetId}`;

    this.data.programRules[programId] = {
      name: presetId,
      enabled: false,
      presetId,

      start: {
        type: "manual",
        inputId: "",
        linkName: "",
        hour: 0,
        minute: 0,
        repeat: false,
        days: [false, false, false, false, false, false, false],
      },

      end: {
        type: "none",
        inputId: "",
        linkName: "",
        seconds: 0,
        count: 0,
        countChannelId: "",
        countSegmentId: "",
        hour: 0,
        minute: 0,
        repeat: false,
        days: [false, false, false, false, false, false, false],
      },

      endAction: {
        action: "revert",
        linkName: "",
      },
    };

    return this.data.programRules[programId];
  }

  async _saveBuilder() {
    try {
      await this._saveProgramsFromUi();
    } catch (error) {
      console.error("[VISTA] program save failed", error);
      this._toast("Program save failed");
    }
  }

  // Debounced builder save: coalesce rapid edits
  _scheduleBuilderSave() {
    if (this._builderSaveTimer) clearTimeout(this._builderSaveTimer);
    this._builderSaveTimer = setTimeout(() => {
      this._builderSaveTimer = null;
      this._saveBuilder();
    }, 250);
  }

  // ---------------- Drawer renders ----------------
  _renderStartDrawerContents(presetId) {
    const binding = this._ensureBinding(presetId);
    const start = binding.start || { type: "run" };
    const description = this._describeTrigger(start, false);
    return `
      <div class="drawer-content">
        <div class="drawer-section">
          <div class="drawer-section__header">Start When...</div>
          ${this._renderTriggerTypePicker(presetId, "start", start.type, false)}
        </div>
        ${this._renderTriggerFields(presetId, "start", start)}
        <div class="drawer-description">${description}</div>
      </div>
    `;
  }

  _getCycleSourceOptions(presetId) {
    const options = [];

    const addOption = (
      channelId,
      segmentId,
      segmentName,
      animationId
    ) => {
      const channel = this.data.channels.find(
        (item) => item.id === channelId
      );

      if (channel?.type !== "addressable") return;

      const definition = this.data.animations.find(
        (animation) => animation.id === animationId
      );

      if (!definition?.hasCycleCount) return;

      options.push({
        channelId,
        segmentId,
        label:
          `${channel.name || channelId} · ` +
          `${segmentName || segmentId}`,
      });
    };

    const draft = this.ui.presetModal?.draft;

    if (draft?.id === presetId) {
      for (const target of draft.targets || []) {
        for (const segment of target.segments || []) {
          addOption(
            target.channelId,
            segment.segmentId,
            segment.name,
            segment.deviceState?.animation ||
              segment.state?.mode ||
              "solid"
          );
        }
      }

      return options;
    }

    const scene = this.data.scenes?.[presetId];
    if (!scene) return options;

    for (
      const [channelId, output]
      of Object.entries(scene.targets || {})
    ) {
      for (
        const [segmentId, segment]
        of Object.entries(output || {})
      ) {
        if (
          !segment ||
          typeof segment !== "object" ||
          segmentId === "active"
        ) {
          continue;
        }

        addOption(
          channelId,
          segmentId,
          segment.name,
          segment.state?.animation || "solid"
        );
      }
    }

    return options;
  }

  _renderEndDrawerContents(presetId) {
    const binding = this._ensureBinding(presetId);
    const end = binding.end || { type: "run" };
    const endAction = binding.endAction || { action: "off" };
    const description = this._describeTrigger(end, true);
    return `
      <div class="drawer-content">
        <div class="drawer-section">
          <div class="drawer-section__header">Stop When...</div>
          ${this._renderTriggerTypePicker(presetId, "end", end.type, true)}
        </div>
        ${this._renderTriggerFields(presetId, "end", end)}
        <div class="drawer-description">${description}</div>
        <div class="drawer-section">
          <div class="drawer-section__header">Then...</div>
          ${this._renderEndActionFields(presetId, endAction)}
        </div>
      </div>
    `;
  }

  _renderTriggerTypePicker(presetId, side, current, isEnd) {
    const types = isEnd
      ? [
          { id: "none", label: "No Automatic Stop" },
          { id: "inputActive", label: "Input Active" },
          { id: "inputInactive", label: "Input Inactive" },
          { id: "inputRising", label: "Input Turns On" },
          { id: "inputFalling", label: "Input Turns Off" },
          { id: "timer", label: "Timer" },
          { id: "clock", label: "Clock" },
          { id: "count", label: "Animation Count" },
          { id: "link", label: "Link Event" },
        ]
      : [
          { id: "manual", label: "Manual" },
          { id: "inputActive", label: "While Input Is Active" },
          { id: "inputRising", label: "When Input Turns On" },
          { id: "inputFalling", label: "When Input Turns Off" },
          { id: "inputToggle", label: "Toggle On Each Press" },
          { id: "clock", label: "Clock" },
          { id: "link", label: "Link Event" },
        ];

    return `
      <div class="chip-grid">
        ${types
          .map(
            (type) => `
          <button class="chip compact ${current === type.id ? "is-active" : ""}" type="button" data-action="trigger-type" data-preset-id="${presetId}" data-side="${side}" data-type="${type.id}">${type.label}</button>
        `
          )
          .join("")}
      </div>`;
  }

  _renderTriggerFields(presetId, side, trigger) {
    const type = trigger.type || (side === "start" ? "manual" : "none");

    if (type === "manual") return `<div class="drawer-hint">Starts only from the UI, API, remote, or another direct command.</div>`;
    if (type === "none") return `<div class="drawer-hint">Runs until it is stopped manually, disabled, or replaced.</div>`;

    if (["inputActive", "inputInactive", "inputRising", "inputFalling", "inputToggle"].includes(type)) {
      return `<div class="drawer-section">${this._renderInputIdField(presetId, side, trigger.inputId)}</div>`;
    }

    if (type === "clock") return `<div class="drawer-section">${this._renderClockField(presetId, side, trigger)}</div>`;
    if (type === "link") return `<div class="drawer-section">${this._renderLinkNameField(presetId, side, trigger.linkName)}</div>`;

    if (type === "timer") {
      return `
        <div class="drawer-section">
          <label class="field__label">Seconds</label>
          <input class="input" type="number" min="1" step="1" value="${trigger.seconds ?? 30}" data-action="trigger-seconds" data-preset-id="${presetId}" data-side="${side}">
        </div>`;
    }

    if (type === "count") {
      const cycleOptions =
        this._getCycleSourceOptions(presetId);

      const selectedCycleSource =
        trigger.countChannelId &&
        trigger.countSegmentId
          ? `${trigger.countChannelId}|${trigger.countSegmentId}`
          : "";

      return `
        <div class="drawer-section">
          <label class="field__label">
            Cycle Source
          </label>

          <select
            class="input"
            data-action="trigger-cycle-source"
            data-preset-id="${presetId}"
            data-side="${side}"
          >
            <option value="">
              Select a program segment
            </option>

            ${cycleOptions
              .map((option) => {
                const value =
                  `${option.channelId}|${option.segmentId}`;

                return `
                  <option
                    value="${value}"
                    ${
                      value === selectedCycleSource
                        ? "selected"
                        : ""
                    }
                  >
                    ${option.label}
                  </option>
                `;
              })
              .join("")}
          </select>
        </div>

        <div class="drawer-section">
          <label class="field__label">
            Completed Animation Cycles
          </label>

          <input
            class="input"
            type="number"
            min="1"
            step="1"
            value="${Math.max(
              1,
              Number(trigger.count) || 1
            )}"
            data-action="trigger-cycles"
            data-preset-id="${presetId}"
            data-side="${side}"
          >

          ${
            cycleOptions.length
              ? `
                <div class="drawer-hint">
                  The program ends when the selected segment
                  completes this many full animation cycles.
                </div>
              `
              : `
                <div class="drawer-hint">
                  This preset has no program segment using an animation that supports cycle counting.
                </div>
              `
          }
        </div>
      `;
    }

    return "";
  }

  _renderInputIdField(presetId, side, current) {
    const inputs = Array.isArray(this.data.programInputs) ? this.data.programInputs : [];

    if (!inputs.length) return `<div class="drawer-hint">No inputs are configured in programs.json.</div>`;

    return `
      <label class="field__label">Input</label>
      <div class="chip-grid">
        ${inputs
          .map((input) => {
            const inputId = input.inputId || "";
            const label = input.name || inputId || "Unnamed Input";
            return `<button class="chip compact ${current === inputId ? "is-active" : ""}" type="button" data-action="trigger-input-id" data-preset-id="${presetId}" data-side="${side}" data-value="${inputId}">${label}</button>`;
          })
          .join("")}
      </div>`;
  }

  _getAvailableLinkNames(current = "") {
    const names = new Set();

    for (
      const rule
      of Object.values(this.data.programRules || {})
    ) {
      const endAction = rule?.endAction;

      if (
        endAction?.action === "link" &&
        typeof endAction.linkName === "string" &&
        endAction.linkName.trim()
      ) {
        names.add(endAction.linkName.trim());
      }
    }

    if (typeof current === "string" && current.trim()) {
      names.add(current.trim());
    }

    return [...names].sort((a, b) =>
      a.localeCompare(b)
    );
  }

  _renderLinkNameField(presetId, side, current) {
    const linkNames = this._getAvailableLinkNames(current);

    if (!linkNames.length) {
      return `
        <div class="drawer-hint">
          No link events have been created yet. Set another
          program's End Action to "Emit Link and Return to Live"
          and give that event a name first.
        </div>
      `;
    }

    return `
      <label class="field__label">Link Event</label>

      <select
        class="input"
        data-action="trigger-link-name"
        data-preset-id="${presetId}"
        data-side="${side}"
      >
        <option value="">Select a link event</option>

        ${linkNames
          .map(
            (linkName) => `
              <option
                value="${linkName}"
                ${current === linkName ? "selected" : ""}
              >
                ${linkName}
              </option>
            `
          )
          .join("")}
      </select>

      <div class="drawer-hint">
        Link events are created by program end actions.
      </div>
    `;
  }

  _renderEdgeField(presetId, side, current) {
    const edges = [
      { id: "level", label: "Level" },
      { id: "rising", label: "Rising" },
      { id: "falling", label: "Falling" },
      { id: "press", label: "Press" },
      { id: "release", label: "Release" },
    ];
    const sel = current || "level";
    return `
      <label class="field__label">Edge</label>
      <div class="chip-grid">
        ${edges
          .map(
            (e) => `
          <button class="chip compact ${sel === e.id ? "is-active" : ""}"
                  type="button"
                  data-action="trigger-edge"
                  data-preset-id="${presetId}"
                  data-side="${side}"
                  data-value="${e.id}">${e.label}</button>
        `
          )
          .join("")}
      </div>
    `;
  }

  _renderBehaviorField(presetId, side, current) {
    const behaviors = [
      { id: "momentary", label: "Momentary" },
      { id: "toggle", label: "Toggle" },
      { id: "latch", label: "Latch" },
    ];
    const sel = current || "momentary";
    return `
      <label class="field__label">Behavior</label>
      <div class="chip-grid">
        ${behaviors
          .map(
            (b) => `
          <button class="chip compact ${sel === b.id ? "is-active" : ""}"
                  type="button"
                  data-action="trigger-behavior"
                  data-preset-id="${presetId}"
                  data-side="${side}"
                  data-value="${b.id}">${b.label}</button>
        `
          )
          .join("")}
      </div>
    `;
  }

  _renderThresholdField(presetId, side, current) {
    return `
      <label class="field__label">Threshold (0–4095)</label>
      <input class="input" type="number" min="0" max="4095" step="1"
            value="${current ?? 2048}"
            data-action="trigger-threshold"
            data-preset-id="${presetId}"
            data-side="${side}">
    `;
  }

  _renderClockField(presetId, side, trigger) {
    const hour = trigger.hour ?? 12;
    const minute = trigger.minute ?? 0;
    const repeat = !!trigger.repeat;
    const days = trigger.days || [false, false, false, false, false, false, false];
    const labels = ["Su", "M", "T", "W", "Th", "F", "Sa"];
    return `
      <label class="field__label">Time</label>
      <div class="clock-row">
        <input class="input clock-input" type="number" min="0" max="23" step="1"
              value="${hour}"
              data-action="trigger-clock-hour"
              data-preset-id="${presetId}"
              data-side="${side}">
        <span class="clock-sep">:</span>
        <input class="input clock-input" type="number" min="0" max="59" step="1"
              value="${String(minute).padStart(2, "0")}"
              data-action="trigger-clock-minute"
              data-preset-id="${presetId}"
              data-side="${side}">
      </div>
      <div class="menu-item" style="padding-left: 0; padding-right: 0;">
        <span class="menu-item__label">Repeat</span>
        <label class="toggle">
          <input type="checkbox"
                data-action="trigger-clock-repeat"
                data-preset-id="${presetId}"
                data-side="${side}"
                ${repeat ? "checked" : ""}>
          <span class="track"></span>
          <span class="thumb"></span>
        </label>
      </div>
      ${
        repeat
          ? `
        <label class="field__label">Days</label>
        <div class="chip-grid">
          ${labels
            .map(
              (lbl, i) => `
            <button class="chip compact ${days[i] ? "is-active" : ""}"
                    type="button"
                    data-action="trigger-clock-day"
                    data-preset-id="${presetId}"
                    data-side="${side}"
                    data-day="${i}">${lbl}</button>
          `
            )
            .join("")}
        </div>
      `
          : ""
      }
    `;
  }

  _renderLinkPresetField(presetId, side, current) {
    const others = Object.entries(this.data.scenes || {})
      .filter(([sceneId]) => sceneId !== presetId)
      .map(([sceneId, scene]) => ({ id: sceneId, ...scene }));    
    if (others.length === 0) {
      return `<div class="drawer-hint">No other presets to link to. Create another preset first.</div>`;
    }
    return `
      <label class="field__label">Target Preset</label>
      <vista-select data-action="trigger-link-preset"
                    data-preset-id="${presetId}"
                    data-side="${side}"
                    value="${current || ""}">
        <option value="">— Select preset —</option>
        ${others
          .map(
            (p) => `
          <option value="${p.id}" ${current === p.id ? "selected" : ""}>${p.name || p.id}</option>
        `
          )
          .join("")}
      </vista-select>
    `;
  }

  _renderEndActionFields(presetId, endAction) {
    const action = endAction.action || "revert";
    const actions = [
      { id: "revert", label: "Return to Live" },
      { id: "off", label: "Turn Off" },
      { id: "hold", label: "Hold Final Output" },
      { id: "link", label: "Emit Link and Return to Live" },
    ];

    return `
      <label class="field__label">End Action</label>
      <div class="chip-grid">
        ${actions
          .map(
            (item) => `
          <button class="chip compact ${action === item.id ? "is-active" : ""}" type="button" data-action="end-action-type" data-preset-id="${presetId}" data-value="${item.id}">${item.label}</button>
        `
          )
          .join("")}
      </div>
      ${
        action === "link"
          ? `
        <label class="field__label" style="margin-top: 8px;">Link Event Name</label>
        <input class="input" type="text" value="${endAction.linkName || ""}" placeholder="example: courtesy_complete" data-action="end-action-link-name" data-preset-id="${presetId}">
      `
          : ""
      }`;
  }

  _setTriggerType(presetId, side, newType) {
    const binding = this._ensureBinding(presetId);

    const fresh = {
      type: newType,
      inputId: "",
      linkName: "",
    };

    if (
      [
        "inputActive",
        "inputInactive",
        "inputRising",
        "inputFalling",
        "inputToggle",
      ].includes(newType)
    ) {
      fresh.inputId =
        this.data.programInputs?.[0]?.inputId || "";
    }
    else if (newType === "link") {
      fresh.linkName =
        this._getAvailableLinkNames()[0] || "";
    }
    else if (newType === "clock") {
      fresh.hour = 12;
      fresh.minute = 0;
      fresh.repeat = false;
      fresh.days = [
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ];
    }
    else if (newType === "timer") {
      fresh.seconds = 30;
    }
    else if (newType === "count") {
      const options =
        this._getCycleSourceOptions(presetId);

      const first = options[0];

      fresh.count = 1;
      fresh.countChannelId =
        first?.channelId || "";
      fresh.countSegmentId =
        first?.segmentId || "";
    }

    binding[side] = fresh;

    this._scheduleBuilderSave();
    this._scheduleRender();
  }

  _describeTrigger(trigger, isEnd) {
    const type = trigger?.type || (isEnd ? "none" : "manual");
    const input = trigger?.inputId || "selected input";

    if (type === "manual") return "Starts only from a direct command.";
    if (type === "none") return "Runs until stopped manually, disabled, or replaced.";
    if (type === "inputActive") return isEnd ? `Stops when ${input} is active.` : `Starts when ${input} becomes active and does not restart while it stays active.`;
    if (type === "inputInactive") return `Stops when ${input} becomes inactive. Paired with an inputActive start, this behaves as a momentary control.`;
    if (type === "inputRising") return `${isEnd ? "Stops" : "Starts"} when ${input} changes from inactive to active.`;
    if (type === "inputFalling") return `${isEnd ? "Stops" : "Starts"} when ${input} changes from active to inactive.`;
    if (type === "inputToggle") return `Each rising edge on ${input} alternates between starting and stopping the program.`;
    if (type === "timer") return `Stops after ${trigger.seconds ?? 30} seconds.`;
    if (type === "count") {return `Stops after the selected program segment completes ${trigger.count ?? 1 } full animation ${Number(trigger.count) === 1 ? "cycle" : "cycles"}.`;}
    if (type === "link") return `${isEnd ? "Stops" : "Starts"} when the link event "${trigger.linkName || "unnamed"}" is emitted.`;

    if (type === "clock") {
      const time = `${trigger.hour ?? 0}:${String(trigger.minute ?? 0).padStart(2, "0")}`;
      if (!trigger.repeat) return `${isEnd ? "Stops" : "Starts"} once at ${time} after boot or program reload.`;
      const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const activeDays = labels.filter((_, index) => trigger.days?.[index]);
      return `${isEnd ? "Stops" : "Starts"} at ${time} on ${activeDays.length ? activeDays.join(", ") : "no selected days"}.`;
    }

    return "";
  }

  _updateTriggerField(presetId, side, field, value) {
    const binding = this._ensureBinding(presetId);
    if (!binding[side]) binding[side] = { type: "run" };
    binding[side][field] = value;
    this._scheduleBuilderSave();
    this._scheduleRender();
  }

  _toggleClockDay(presetId, side, dayIndex) {
    const binding = this._ensureBinding(presetId);
    if (!binding[side]) binding[side] = { type: "clock" };
    if (!binding[side].days) binding[side].days = [false, false, false, false, false, false, false];
    binding[side].days[dayIndex] = !binding[side].days[dayIndex];
    this._scheduleBuilderSave();
    this._scheduleRender();
  }

  _updateEndAction(presetId, field, value) {
    const binding = this._ensureBinding(presetId);
    if (!binding.endAction) binding.endAction = { action: "off" };
    binding.endAction[field] = value;
    // Clean up linkName if action changed away from link
    if (field === "action" && value !== "link") {
      delete binding.endAction.linkName;
    }
    this._scheduleBuilderSave();
    this._scheduleRender();
  }

  async _refreshAllChannels() {
    try {
      const channelsDoc = await API.getChannels();
      this.data.channels = normalizeChannels(this.data.config, channelsDoc || {});
      this._scheduleRender();
    } catch (err) {
      console.warn("[VISTA] channel refresh failed", err);
    }
  }
  _loadTheme() {
    try {
      return localStorage.getItem("vista.theme");
    } catch (_) {
      return null;
    }
  }

  _toggleTheme() {
    this.ui.theme = this.ui.theme === "dark" ? "light" : "dark";
    this._applyTheme();
    try {
      localStorage.setItem("vista.theme", this.ui.theme);
    } catch (_) {}
    this._scheduleRender();
  }

  _applyTheme() {
    document.documentElement.setAttribute("data-theme", this.ui.theme);
  }

  _toast(msg) {
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = msg;
    document.body.appendChild(node);
    setTimeout(() => node.classList.add("toast--show"), 10);
    setTimeout(() => {
      node.classList.remove("toast--show");
      setTimeout(() => node.remove(), 300);
    }, CONFIG.toastDurationMs);
  }
}

customElements.define("vista-app", VistaApp);
