var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
function isVideoMedia(pathOrUrl, mimeType) {
  if (mimeType && mimeType.startsWith("video/"))
    return true;
  if (!pathOrUrl || typeof pathOrUrl !== "string")
    return false;
  const clean = pathOrUrl.split("?")[0].toLowerCase();
  return clean.endsWith(".mp4") || clean.endsWith(".webm") || clean.endsWith(".mov") || clean.endsWith(".m4v") || clean.endsWith(".ogg") || clean.endsWith(".mkv") || clean.endsWith(".avi");
}
if (typeof window !== "undefined") {
  window.__AGENT_FEEDBACK_EXTENSIONS__ = window.__AGENT_FEEDBACK_EXTENSIONS__ || [];
}
function registerExtensionTab(tab) {
  if (typeof window === "undefined")
    return;
  const list = window.__AGENT_FEEDBACK_EXTENSIONS__ || [];
  const idx = list.findIndex((t) => t.id === tab.id);
  if (idx >= 0) {
    list[idx] = tab;
  } else {
    list.push(tab);
  }
  window.__AGENT_FEEDBACK_EXTENSIONS__ = list;
  if (typeof document !== "undefined" && typeof document.querySelectorAll === "function") {
    const widgets = document.querySelectorAll("agent-feedback-widget");
    widgets.forEach((w) => {
      if (typeof w.refreshWidget === "function") {
        w.refreshWidget();
      }
    });
  }
}
let globalAccessControl = {};
let globalHostChannel = {};
let cachedAuthorized = null;
function notifyWidgetsRefresh() {
  if (typeof document !== "undefined" && typeof document.querySelectorAll === "function") {
    const widgets = document.querySelectorAll("agent-feedback-widget");
    widgets.forEach((w) => {
      if (typeof w.refreshWidget === "function") {
        w.refreshWidget();
      }
    });
  }
}
async function computeSha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
function setApiBase(url) {
  if (typeof window === "undefined")
    return;
  const clean = (url || "").trim().replace(/\/+$/, "");
  window.__AGENT_FEEDBACK_API_BASE__ = clean;
  try {
    if (typeof localStorage !== "undefined") {
      if (clean) {
        localStorage.setItem("af_api_base", clean);
      } else {
        localStorage.removeItem("af_api_base");
      }
    }
  } catch {
  }
  if (typeof document !== "undefined" && typeof document.querySelectorAll === "function") {
    const widgets = document.querySelectorAll("agent-feedback-widget");
    widgets.forEach((w) => {
      if (typeof w.setApiBase === "function") {
        w.setApiBase(clean);
      }
    });
  }
}
function getApiBase() {
  if (typeof window !== "undefined" && window.__AGENT_FEEDBACK_API_BASE__) {
    return window.__AGENT_FEEDBACK_API_BASE__;
  }
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("af_api_base");
      if (stored)
        return stored.trim().replace(/\/+$/, "");
    }
  } catch {
  }
  return "";
}
function getAuthHeaders(customConfig) {
  const config = customConfig || getAccessControl();
  const storageKey = config.storageKey || "af_access_key";
  let storedKey = "";
  let verifiedHash = "";
  try {
    if (typeof localStorage !== "undefined") {
      storedKey = localStorage.getItem(storageKey) || "";
      verifiedHash = localStorage.getItem(storageKey + "_verified_hash") || "";
    }
  } catch {
  }
  const headers = {};
  if (storedKey) {
    headers["Authorization"] = `Bearer ${storedKey}`;
    headers["X-Access-Key"] = storedKey;
  }
  if (verifiedHash) {
    headers["X-Access-Hash"] = verifiedHash;
  }
  return headers;
}
async function syncAccessControlFromServer(baseUrl) {
  if (typeof fetch === "undefined")
    return null;
  const base = (baseUrl || getApiBase() || "").trim().replace(/\/+$/, "");
  if (!base)
    return null;
  try {
    const res = await fetch(`${base}/api/__agent_feedback/auth/config`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.accessControl) {
        setAccessControl(data.accessControl);
        if (data.hostChannel) {
          setHostChannel(data.hostChannel);
        }
        return data.accessControl;
      }
    }
  } catch {
  }
  return null;
}
function setAccessControl(config) {
  globalAccessControl = { ...config || {} };
  if (typeof window !== "undefined") {
    window.__AGENT_FEEDBACK_ACCESS_CONTROL__ = globalAccessControl;
  }
  cachedAuthorized = null;
  const storageKey = globalAccessControl.storageKey || "af_access_key";
  try {
    if (typeof localStorage !== "undefined") {
      const storedKey = localStorage.getItem(storageKey);
      if (globalAccessControl.enabled && storedKey && globalAccessControl.keyHash) {
        computeSha256(storedKey).then((hash) => {
          const valid = hash.toLowerCase() === globalAccessControl.keyHash.toLowerCase();
          cachedAuthorized = valid;
          if (valid) {
            localStorage.setItem(storageKey + "_verified_hash", hash);
          } else {
            localStorage.removeItem(storageKey + "_verified_hash");
          }
          notifyWidgetsRefresh();
        }).catch(() => {
        });
      }
    }
  } catch {
  }
  notifyWidgetsRefresh();
}
function getAccessControl() {
  var _a;
  if (typeof window !== "undefined" && window.__AGENT_FEEDBACK_ACCESS_CONTROL__) {
    return window.__AGENT_FEEDBACK_ACCESS_CONTROL__;
  }
  if (typeof window !== "undefined" && ((_a = window.__AGENT_FEEDBACK_OPTIONS__) == null ? void 0 : _a.accessControl)) {
    return window.__AGENT_FEEDBACK_OPTIONS__.accessControl;
  }
  return globalAccessControl;
}
function setHostChannel(config) {
  globalHostChannel = { ...config || {} };
  if (typeof window !== "undefined") {
    window.__AGENT_FEEDBACK_HOST_CHANNEL__ = globalHostChannel;
  }
  notifyWidgetsRefresh();
}
function getHostChannel() {
  var _a;
  if (typeof window !== "undefined" && window.__AGENT_FEEDBACK_HOST_CHANNEL__) {
    return window.__AGENT_FEEDBACK_HOST_CHANNEL__;
  }
  if (typeof window !== "undefined" && ((_a = window.__AGENT_FEEDBACK_OPTIONS__) == null ? void 0 : _a.hostChannel)) {
    return window.__AGENT_FEEDBACK_OPTIONS__.hostChannel;
  }
  return globalHostChannel;
}
function isAuthorized(customConfig) {
  const config = customConfig && Object.keys(customConfig).length > 0 ? customConfig : getAccessControl();
  if (!config.enabled) {
    return true;
  }
  const storageKey = config.storageKey || "af_access_key";
  let storedKey = null;
  let verifiedHash = null;
  try {
    if (typeof localStorage !== "undefined") {
      storedKey = localStorage.getItem(storageKey);
      verifiedHash = localStorage.getItem(storageKey + "_verified_hash");
    }
  } catch {
  }
  if (!storedKey) {
    cachedAuthorized = false;
    return false;
  }
  if (config.accessKey) {
    const valid = storedKey === config.accessKey;
    cachedAuthorized = valid;
    return valid;
  }
  if (config.keyHash) {
    if (verifiedHash && verifiedHash.toLowerCase() === config.keyHash.toLowerCase()) {
      cachedAuthorized = true;
      return true;
    }
    if (cachedAuthorized !== null) {
      return cachedAuthorized;
    }
    computeSha256(storedKey).then((hash) => {
      const valid = hash.toLowerCase() === config.keyHash.toLowerCase();
      cachedAuthorized = valid;
      try {
        if (typeof localStorage !== "undefined") {
          if (valid) {
            localStorage.setItem(storageKey + "_verified_hash", hash);
          } else {
            localStorage.removeItem(storageKey + "_verified_hash");
          }
        }
      } catch {
      }
      notifyWidgetsRefresh();
    }).catch(() => {
    });
    return false;
  }
  return true;
}
async function authorize(key, customConfig) {
  const config = customConfig || getAccessControl();
  const cleanKey = (key || "").trim();
  if (!cleanKey)
    return false;
  let isValid = false;
  let computedHash = "";
  if (!config.enabled) {
    isValid = true;
  } else if (config.accessKey && cleanKey === config.accessKey) {
    isValid = true;
  } else if (config.keyHash) {
    computedHash = await computeSha256(cleanKey);
    if (computedHash.toLowerCase() === config.keyHash.toLowerCase()) {
      isValid = true;
    }
  } else if (!config.accessKey && !config.keyHash) {
    isValid = true;
  }
  if (!isValid) {
    const apiBase = getApiBase();
    if (apiBase) {
      try {
        const verifyUrl = `${apiBase.replace(/\/+$/, "")}/api/__agent_feedback/auth/verify`;
        const res = await fetch(verifyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: cleanKey })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.verified) {
            isValid = true;
            if (data.keyHash) {
              computedHash = data.keyHash;
              setAccessControl({
                ...config,
                keyHash: data.keyHash
              });
            }
          }
        }
      } catch {
      }
    }
  }
  if (isValid) {
    const storageKey = config.storageKey || "af_access_key";
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(storageKey, cleanKey);
        if (computedHash) {
          localStorage.setItem(storageKey + "_verified_hash", computedHash);
        } else if (config.keyHash) {
          const h = await computeSha256(cleanKey);
          localStorage.setItem(storageKey + "_verified_hash", h);
        }
      }
    } catch {
    }
    cachedAuthorized = true;
    notifyWidgetsRefresh();
    return true;
  }
  return false;
}
function deauthorize(customConfig) {
  const config = customConfig || getAccessControl();
  const storageKey = config.storageKey || "af_access_key";
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(storageKey + "_verified_hash");
    }
  } catch {
  }
  cachedAuthorized = false;
  notifyWidgetsRefresh();
}
function openFeedbackModal(tab = "submit") {
  if (typeof document === "undefined")
    return;
  const widget = document.querySelector("agent-feedback-widget");
  if (widget) {
    if (typeof widget.setTab === "function" && tab) {
      widget.setTab(tab);
    }
    if (typeof widget.toggleModal === "function") {
      widget.toggleModal(true);
    }
  }
}
function closeFeedbackModal() {
  if (typeof document === "undefined")
    return;
  const widget = document.querySelector("agent-feedback-widget");
  if (widget && typeof widget.toggleModal === "function") {
    widget.toggleModal(false);
  }
}
if (typeof window !== "undefined") {
  window.openAgentFeedbackModal = openFeedbackModal;
  window.closeAgentFeedbackModal = closeFeedbackModal;
  window.setAgentFeedbackAccessControl = setAccessControl;
  window.setAgentFeedbackHostChannel = setHostChannel;
  window.isAgentFeedbackAuthorized = isAuthorized;
  window.authorizeAgentFeedback = authorize;
  window.deauthorizeAgentFeedback = deauthorize;
}
const MAX_LOGS = 30;
const logRingBuffer = [];
let isConsoleProxied = false;
let origLog = null;
let origWarn = null;
let origError = null;
function formatLogArgs(args) {
  let stack = void 0;
  const parts = [];
  for (const arg of args) {
    if (arg instanceof Error) {
      if (!stack && arg.stack) {
        stack = arg.stack;
      }
      parts.push(arg.stack || arg.message || String(arg));
    } else if (typeof arg === "object" && arg !== null) {
      try {
        parts.push(JSON.stringify(arg));
      } catch {
        parts.push(String(arg));
      }
    } else {
      parts.push(String(arg));
    }
  }
  return { message: parts.join(" "), stack };
}
function pushLogToRingBuffer(type, args) {
  try {
    const { message, stack } = formatLogArgs(args);
    const entry = {
      type,
      message,
      timestamp: Date.now(),
      ...stack ? { stack } : {}
    };
    logRingBuffer.push(entry);
    if (logRingBuffer.length > MAX_LOGS) {
      logRingBuffer.shift();
    }
  } catch {
  }
}
function setupConsoleProxy() {
  if (isConsoleProxied || typeof console === "undefined") {
    return;
  }
  origLog = console.log;
  origWarn = console.warn;
  origError = console.error;
  console.log = function(...args) {
    pushLogToRingBuffer("log", args);
    origLog == null ? void 0 : origLog.apply(console, args);
  };
  console.warn = function(...args) {
    pushLogToRingBuffer("warn", args);
    origWarn == null ? void 0 : origWarn.apply(console, args);
  };
  console.error = function(...args) {
    pushLogToRingBuffer("error", args);
    origError == null ? void 0 : origError.apply(console, args);
  };
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("error", (event) => {
      pushLogToRingBuffer("error", [event.message || "Uncaught Error", event.error]);
    });
    window.addEventListener("unhandledrejection", (event) => {
      pushLogToRingBuffer("error", ["Unhandled Promise Rejection:", event.reason]);
    });
  }
  isConsoleProxied = true;
}
function getRecentLogs() {
  return logRingBuffer.map((entry) => ({ ...entry }));
}
function clearRecentLogs() {
  logRingBuffer.length = 0;
}
function detectPlatform(userAgent = "") {
  var _a;
  const ua = userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "");
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return "ios";
  }
  if (/Android/i.test(ua)) {
    return "android";
  }
  if (/Electron|Tauri|desktop/i.test(ua)) {
    return "desktop";
  }
  if (typeof window !== "undefined") {
    const win = window;
    if (win.__TAURI__ || ((_a = win.process) == null ? void 0 : _a.type) === "renderer" || win.electron) {
      return "desktop";
    }
  }
  return "web";
}
function collectTelemetry() {
  const win = typeof window !== "undefined" ? window : void 0;
  const nav = typeof navigator !== "undefined" ? navigator : void 0;
  const ua = (nav == null ? void 0 : nav.userAgent) || "";
  const route = (win == null ? void 0 : win.location) ? (win.location.pathname || "") + (win.location.search || "") + (win.location.hash || "") : "/";
  const width = (win == null ? void 0 : win.innerWidth) ?? 1920;
  const height = (win == null ? void 0 : win.innerHeight) ?? 1080;
  const dpr = (win == null ? void 0 : win.devicePixelRatio) ?? 1;
  const online = (nav == null ? void 0 : nav.onLine) ?? true;
  return {
    route: route || "/",
    viewport: {
      width,
      height,
      dpr
    },
    userAgent: ua,
    platform: detectPlatform(ua),
    network: {
      online
    }
  };
}
function formatLocalTime(item) {
  const ts = item.timestamp || (item.receivedAt ? new Date(item.receivedAt).getTime() : 0);
  if (!ts || isNaN(ts))
    return "";
  const d = new Date(ts);
  const pad = (n) => n < 10 ? `0${n}` : `${n}`;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function formatLocalDate(item) {
  if (item.date)
    return item.date;
  const ts = item.timestamp || (item.receivedAt ? new Date(item.receivedAt).getTime() : 0);
  if (!ts || isNaN(ts))
    return "今日";
  const d = new Date(ts);
  const pad = (n) => n < 10 ? `0${n}` : `${n}`;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
async function compressImage(file, maxDim = 1200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file)
      return reject(new Error("未提供有效图片"));
    if (typeof FileReader === "undefined") {
      return reject(new Error("环境不支持 FileReader"));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取图片文件失败"));
    reader.onload = (e) => {
      var _a;
      const dataUrl = (_a = e.target) == null ? void 0 : _a.result;
      if (typeof Image === "undefined") {
        return resolve(dataUrl);
      }
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round(height * maxDim / width);
              width = maxDim;
            } else {
              width = Math.round(width * maxDim / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx)
            return resolve(dataUrl);
          ctx.fillStyle = "#12151c";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", quality);
          resolve(compressed);
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
async function uploadMediaInChunks(file, fileName, apiBase = "", onProgress) {
  const chunkSize = 1024 * 1024;
  const totalChunks = Math.ceil(file.size / chunkSize) || 1;
  const uploadId = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let uploadedBytes = 0;
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    const chunkBlob = file.slice(start, end);
    const cleanBase = apiBase ? apiBase.replace(/\/+$/, "") : "";
    const chunkUrl = `${cleanBase}/api/__agent_feedback/media/chunk`;
    const res = await fetch(chunkUrl, {
      method: "POST",
      headers: {
        "X-Upload-Id": uploadId,
        "X-Chunk-Index": String(i),
        "X-Total-Chunks": String(totalChunks),
        "X-File-Name": encodeURIComponent(fileName),
        "Content-Type": "application/octet-stream",
        ...getAuthHeaders()
      },
      body: chunkBlob
    });
    if (!res.ok) {
      throw new Error(`分块 ${i + 1}/${totalChunks} 上传失败 (HTTP ${res.status})`);
    }
    uploadedBytes += chunkBlob.size;
    const percent = Math.min(100, Math.round(uploadedBytes / file.size * 100));
    onProgress == null ? void 0 : onProgress(percent);
    const result = await res.json();
    if (result.completed) {
      return {
        type: result.type || (isVideoMedia(fileName) ? "video" : "image"),
        url: result.url,
        filename: result.filename || fileName,
        size: result.size || file.size
      };
    }
  }
  throw new Error("分块上传已完成，但服务端未返回完成确认");
}
async function captureScreenshot() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }
  const widgets = Array.from(document.querySelectorAll("agent-feedback-widget"));
  const backdropsToRestore = [];
  widgets.forEach((w) => {
    var _a;
    const backdrop = (_a = w.shadowRoot) == null ? void 0 : _a.querySelector(".modal-backdrop");
    if (backdrop && (backdrop.style.display !== "none" || backdrop.classList.contains("af-modal-open"))) {
      backdrop.style.opacity = "0";
      backdrop.style.pointerEvents = "none";
      backdropsToRestore.push(backdrop);
    }
  });
  const restoreBackdrops = () => {
    backdropsToRestore.forEach((b) => {
      b.style.opacity = "1";
      b.style.pointerEvents = "";
    });
  };
  try {
    await new Promise((resolve) => setTimeout(resolve, 100));
    let html2canvasFn = window.html2canvas;
    if (!html2canvasFn) {
      try {
        const dynImport = new Function("specifier", "return import(specifier)");
        const mod = await dynImport("html2canvas");
        html2canvasFn = (mod == null ? void 0 : mod.default) || mod;
      } catch {
      }
    }
    if (typeof html2canvasFn === "function") {
      const canvas = await html2canvasFn(document.body, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        ignoreElements: (el) => el.tagName === "AGENT-FEEDBACK-WIDGET"
      });
      restoreBackdrops();
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      return await compressImage(dataUrl, 1200, 0.75);
    }
    restoreBackdrops();
    return null;
  } catch (err) {
    restoreBackdrops();
    console.warn("[agent-feedback] captureScreenshot failed:", err);
    return null;
  }
}
const CustomElementBase = typeof HTMLElement !== "undefined" ? HTMLElement : class {
};
const _AgentFeedbackWidget = class _AgentFeedbackWidget extends CustomElementBase {
  constructor() {
    super();
    __publicField(this, "shadow");
    __publicField(this, "apiBase", "");
    __publicField(this, "accessControlConfig", {});
    __publicField(this, "hostChannelConfig", {});
    __publicField(this, "isOpen", false);
    __publicField(this, "activeTab", "submit");
    __publicField(this, "hasProcessingItems", false);
    // 拖拽与磁吸边缘贴靠状态
    __publicField(this, "isDragging", false);
    __publicField(this, "startPointerX", 0);
    __publicField(this, "startPointerY", 0);
    __publicField(this, "initialLeft", 0);
    __publicField(this, "initialTop", 0);
    __publicField(this, "currentLeft", null);
    __publicField(this, "currentTop", null);
    __publicField(this, "dragThresholdMoved", false);
    __publicField(this, "modalOpenedAt", 0);
    // 表单状态
    __publicField(this, "feedbackContent", "");
    __publicField(this, "attachedScreenshots", []);
    __publicField(this, "attachedMedia", []);
    __publicField(this, "isSubmitting", false);
    __publicField(this, "submitFeedbackMessage", null);
    // 历史时间轴状态
    __publicField(this, "datesList", []);
    __publicField(this, "loadedDates", /* @__PURE__ */ new Map());
    __publicField(this, "currentDateIndex", 0);
    __publicField(this, "totalTicketsCount", 0);
    __publicField(this, "historyList", []);
    __publicField(this, "isLoadingHistory", false);
    // 大图预览 Lightbox 状态
    __publicField(this, "lightboxSrc", null);
    __publicField(this, "lightboxTitle", "");
    // 扩展槽生命周期清理钩子
    __publicField(this, "extensionCleanups", /* @__PURE__ */ new Map());
    // 实时轮询定时器
    __publicField(this, "historyPollTimer", null);
    __publicField(this, "statusPollTimer", null);
    if (typeof this.attachShadow === "function") {
      this.shadow = this.attachShadow({ mode: "open" });
    } else {
      this.shadow = this.shadowRoot || {};
    }
  }
  /**
   * 静态方法：全局切换主题
   */
  static setTheme(theme) {
    _AgentFeedbackWidget.globalTheme = theme;
    if (typeof document !== "undefined" && typeof document.querySelectorAll === "function") {
      const widgets = document.querySelectorAll("agent-feedback-widget");
      widgets.forEach((w) => {
        if (typeof w.setAttribute === "function") {
          w.setAttribute("theme", theme);
        }
      });
    }
  }
  /**
   * 静态方法：获取当前主题
   */
  static getTheme() {
    return _AgentFeedbackWidget.globalTheme;
  }
  static get observedAttributes() {
    return ["theme", "primary-color", "api-base", "access-control", "host-channel", "show-settings"];
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue)
      return;
    if (name === "theme") {
      this.render();
      this.bindEvents();
    } else if (name === "primary-color") {
      if (this.style) {
        this.style.setProperty("--af-primary", newValue || "#4edea3");
      }
    } else if (name === "api-base") {
      this.apiBase = (newValue || "").trim().replace(/\/+$/, "");
      this.fetchHistoryQuickStatus();
    } else if (name === "access-control") {
      try {
        this.accessControlConfig = JSON.parse(newValue || "{}");
        this.render();
        this.bindEvents();
      } catch {
      }
    } else if (name === "host-channel") {
      try {
        this.hostChannelConfig = JSON.parse(newValue || "{}");
        this.render();
        this.bindEvents();
      } catch {
      }
    } else if (name === "show-settings") {
      this.render();
      this.bindEvents();
    }
  }
  setAccessControl(config) {
    this.accessControlConfig = { ...this.accessControlConfig, ...config || {} };
    if (!this.isOpen) {
      this.render();
      this.bindEvents();
    }
  }
  setHostChannel(config) {
    this.hostChannelConfig = { ...this.hostChannelConfig, ...config || {} };
    if (!this.isOpen) {
      this.render();
      this.bindEvents();
    }
  }
  isAuthorized() {
    return isAuthorized(this.accessControlConfig);
  }
  async authorize(key) {
    const ok = await authorize(key, this.accessControlConfig);
    if (ok) {
      this.render();
      this.bindEvents();
    }
    return ok;
  }
  deauthorize() {
    deauthorize(this.accessControlConfig);
    this.render();
    this.bindEvents();
  }
  setApiBase(url) {
    this.apiBase = (url || "").trim().replace(/\/+$/, "");
    syncAccessControlFromServer(this.apiBase).then((cfg) => {
      if (cfg) {
        this.accessControlConfig = { ...getAccessControl() };
        this.render();
        this.bindEvents();
      }
    });
    this.fetchHistoryQuickStatus();
  }
  getAuthHeaders() {
    return getAuthHeaders(this.accessControlConfig);
  }
  getApiUrl(endpoint) {
    const base = this.apiBase || getApiBase();
    if (!base)
      return endpoint;
    const cleanBase = base.replace(/\/+$/, "");
    const cleanPath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    return `${cleanBase}${cleanPath}`;
  }
  /**
   * 规范化截图完整访问 URL (兼容日级分片、旧版路径及 cpolar 穿透基地址)
   */
  getScreenshotUrl(shot) {
    const shotPath = typeof shot === "string" ? shot : (shot == null ? void 0 : shot.path) || (shot == null ? void 0 : shot.filename) || (shot == null ? void 0 : shot.url) || "";
    if (!shotPath)
      return "";
    if (shotPath.startsWith("data:") || shotPath.startsWith("http://") || shotPath.startsWith("https://")) {
      return shotPath;
    }
    if (shotPath.startsWith("media/") || shotPath.startsWith("/media/")) {
      const cleanMedia = shotPath.replace(/^[\/\\]*media[\/\\]+/i, "");
      return this.getApiUrl(`/api/__agent_feedback/media/${cleanMedia}`);
    }
    const clean = shotPath.replace(/^[\/\\]*(api[\/\\](__agent_feedback|feedback)[\/\\])?(screenshots?[\/\\])?/i, "").replace(/^[\\\/]+/, "");
    return this.getApiUrl(`/api/__agent_feedback/screenshots/${clean}`);
  }
  /**
   * 规范化媒体完整访问 URL (针对视频与大图附件)
   */
  getMediaUrl(mediaItemOrUrl) {
    const rawUrl = typeof mediaItemOrUrl === "string" ? mediaItemOrUrl : (mediaItemOrUrl == null ? void 0 : mediaItemOrUrl.url) || (mediaItemOrUrl == null ? void 0 : mediaItemOrUrl.path) || "";
    if (!rawUrl)
      return "";
    if (rawUrl.startsWith("data:") || rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
      return rawUrl;
    }
    const clean = rawUrl.replace(/^[\/\\]*(api[\/\\](__agent_feedback|feedback)[\/\\])?(media[\/\\])?/i, "").replace(/^[\\\/]+/, "");
    return this.getApiUrl(`/api/__agent_feedback/media/${clean}`);
  }
  connectedCallback() {
    var _a, _b, _c, _d, _e;
    const injectedOptions = typeof window !== "undefined" ? window.__AGENT_FEEDBACK_OPTIONS__ : void 0;
    const initialTheme = ((_a = this.getAttribute) == null ? void 0 : _a.call(this, "theme")) || (injectedOptions == null ? void 0 : injectedOptions.theme) || _AgentFeedbackWidget.globalTheme || "dark";
    if (this.setAttribute && !((_b = this.getAttribute) == null ? void 0 : _b.call(this, "theme"))) {
      this.setAttribute("theme", initialTheme);
    }
    if ((injectedOptions == null ? void 0 : injectedOptions.primaryColor) && this.style) {
      this.style.setProperty("--af-primary", injectedOptions.primaryColor);
    }
    const storedApiBase = (typeof localStorage !== "undefined" ? localStorage.getItem("af_api_base") : null) || "";
    const initialApiBase = ((_c = this.getAttribute) == null ? void 0 : _c.call(this, "api-base")) || storedApiBase || (injectedOptions == null ? void 0 : injectedOptions.apiBase) || getApiBase() || "";
    this.apiBase = initialApiBase.trim().replace(/\/+$/, "");
    let accessControl = getAccessControl();
    if ((_d = this.getAttribute) == null ? void 0 : _d.call(this, "access-control")) {
      try {
        accessControl = { ...accessControl, ...JSON.parse(this.getAttribute("access-control")) };
      } catch {
      }
    }
    if (injectedOptions == null ? void 0 : injectedOptions.accessControl) {
      accessControl = { ...accessControl, ...injectedOptions.accessControl };
    }
    this.accessControlConfig = accessControl;
    let hostChannel = getHostChannel();
    if ((_e = this.getAttribute) == null ? void 0 : _e.call(this, "host-channel")) {
      try {
        hostChannel = { ...hostChannel, ...JSON.parse(this.getAttribute("host-channel")) };
      } catch {
      }
    }
    if (injectedOptions == null ? void 0 : injectedOptions.hostChannel) {
      hostChannel = { ...hostChannel, ...injectedOptions.hostChannel };
    }
    this.hostChannelConfig = hostChannel;
    this.render();
    this.bindEvents();
    this.fetchHistoryQuickStatus();
  }
  disconnectedCallback() {
    this.cleanupExtensionTabs();
    if (this.historyPollTimer) {
      clearInterval(this.historyPollTimer);
      this.historyPollTimer = null;
    }
    if (this.statusPollTimer) {
      clearInterval(this.statusPollTimer);
      this.statusPollTimer = null;
    }
  }
  refreshWidget() {
    const globalAC = getAccessControl();
    if (globalAC && Object.keys(globalAC).length > 0) {
      this.accessControlConfig = { ...this.accessControlConfig, ...globalAC };
    }
    const globalHC = getHostChannel();
    if (globalHC && Object.keys(globalHC).length > 0) {
      this.hostChannelConfig = { ...this.hostChannelConfig, ...globalHC };
    }
    const curApi = getApiBase();
    if (curApi) {
      this.apiBase = curApi;
    }
    const injectedOptions = typeof window !== "undefined" ? window.__AGENT_FEEDBACK_OPTIONS__ : void 0;
    if ((injectedOptions == null ? void 0 : injectedOptions.primaryColor) && this.style) {
      this.style.setProperty("--af-primary", injectedOptions.primaryColor);
    }
    this.render();
    this.bindEvents();
  }
  cleanupExtensionTabs() {
    for (const cleanup of this.extensionCleanups.values()) {
      try {
        cleanup();
      } catch {
      }
    }
    this.extensionCleanups.clear();
  }
  /**
   * 状态与历史实时轮询管理
   */
  checkAndSyncPolling() {
    var _a, _b;
    if (this.isOpen && this.activeTab === "history") {
      if (!this.historyPollTimer) {
        this.historyPollTimer = setInterval(() => {
          this.pollHistoryUpdates();
        }, 5e3);
        if (typeof ((_a = this.historyPollTimer) == null ? void 0 : _a.unref) === "function") {
          this.historyPollTimer.unref();
        }
      }
    } else {
      if (this.historyPollTimer) {
        clearInterval(this.historyPollTimer);
        this.historyPollTimer = null;
      }
    }
    if (!this.isOpen && this.hasProcessingItems) {
      if (!this.statusPollTimer) {
        this.statusPollTimer = setInterval(() => {
          this.fetchHistoryQuickStatus();
        }, 8e3);
        if (typeof ((_b = this.statusPollTimer) == null ? void 0 : _b.unref) === "function") {
          this.statusPollTimer.unref();
        }
      }
    } else {
      if (this.statusPollTimer) {
        clearInterval(this.statusPollTimer);
        this.statusPollTimer = null;
      }
    }
  }
  /**
   * 静默轮询工单状态更新并无感刷新
   */
  async pollHistoryUpdates() {
    var _a, _b;
    if (typeof fetch === "undefined" || typeof document !== "undefined" && document.hidden)
      return;
    if (!this.isOpen || this.activeTab !== "history")
      return;
    if (((_a = this.accessControlConfig) == null ? void 0 : _a.enabled) && !this.isAuthorized())
      return;
    try {
      const query = this.datesList.length > 0 ? `?date=${encodeURIComponent(this.datesList[0])}` : "";
      const res = await fetch(this.getApiUrl(`/api/__agent_feedback/list${query}`), {
        headers: this.getAuthHeaders()
      });
      if (!res.ok)
        return;
      const latestList = await res.json();
      if (!Array.isArray(latestList))
        return;
      const targetDate = this.datesList.length > 0 ? this.datesList[0] : ((_b = latestList[0]) == null ? void 0 : _b.date) || "今日";
      const currentList = this.loadedDates.get(targetDate) || [];
      const hasChanged = latestList.length !== currentList.length || latestList.some((item, idx) => {
        const old = currentList[idx];
        return !old || old.id !== item.id || old.status !== item.status || old.reply !== item.reply;
      });
      if (hasChanged) {
        this.loadedDates.set(targetDate, latestList);
        this.historyList = latestList;
        this.hasProcessingItems = latestList.some((i) => i.status === "processing" || i.status === "pending");
        this.updatePillIndicator();
        const bodyEl = this.shadow.querySelector(".modal-body");
        const prevScrollTop = bodyEl ? bodyEl.scrollTop : 0;
        this.render();
        this.bindEvents();
        const newBodyEl = this.shadow.querySelector(".modal-body");
        if (newBodyEl) {
          newBodyEl.scrollTop = prevScrollTop;
        }
      }
    } catch {
    }
  }
  /**
   * 快速检查是否有处理中状态，控制呼吸灯
   */
  async fetchHistoryQuickStatus() {
    var _a;
    if (typeof fetch === "undefined")
      return;
    if (((_a = this.accessControlConfig) == null ? void 0 : _a.enabled) && !this.isAuthorized())
      return;
    try {
      const res = await fetch(this.getApiUrl("/api/__agent_feedback/list"), {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.list || [];
        this.historyList = list;
        this.hasProcessingItems = list.some((i) => i.status === "processing" || i.status === "pending");
        this.updatePillIndicator();
        this.checkAndSyncPolling();
      }
    } catch {
    }
  }
  /**
   * 刷新呼吸灯显示
   */
  updatePillIndicator() {
    var _a, _b;
    const dots = (_b = (_a = this.shadow) == null ? void 0 : _a.querySelectorAll) == null ? void 0 : _b.call(_a, ".pill-dot");
    dots == null ? void 0 : dots.forEach((dot) => {
      var _a2, _b2;
      if (this.hasProcessingItems) {
        (_a2 = dot.classList) == null ? void 0 : _a2.add("pulsing");
      } else {
        (_b2 = dot.classList) == null ? void 0 : _b2.remove("pulsing");
      }
    });
  }
  /**
   * 切换弹窗展开/关闭 (原生局部切换，0 毫秒完成，零 DOM 销毁重构，杜绝白屏闪烁)
   */
  toggleModal(open) {
    const nextOpen = typeof open === "boolean" ? open : !this.isOpen;
    if (this.isOpen === nextOpen && this.isNativeDom())
      return;
    this.isOpen = nextOpen;
    if (this.isOpen) {
      this.modalOpenedAt = Date.now();
    }
    this.submitFeedbackMessage = null;
    const toggled = this.toggleModalDom(this.isOpen);
    if (!toggled) {
      this.render();
      this.bindEvents();
    }
    this.checkAndSyncPolling();
    if (this.isOpen && this.activeTab === "history") {
      this.loadHistory();
    }
  }
  /**
   * 原生局部模态框开关切换 (0 毫秒完成，零 DOM 销毁重构，保留所有子组件状态与事件，杜绝白屏闪烁)
   */
  toggleModalDom(open) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!this.shadow)
      return false;
    if (!this.isNativeDom())
      return false;
    const backdrop = (_b = (_a = this.shadow).querySelector) == null ? void 0 : _b.call(_a, ".modal-backdrop");
    if (!backdrop)
      return false;
    const container = (_d = (_c = this.shadow).querySelector) == null ? void 0 : _d.call(_c, ".modal-container");
    if (open) {
      if (backdrop._closeTimer) {
        clearTimeout(backdrop._closeTimer);
        backdrop._closeTimer = null;
      }
      backdrop.style.display = "flex";
      void backdrop.offsetHeight;
      backdrop.style.opacity = "1";
      backdrop.classList.add("af-modal-open");
      if (container) {
        container.style.animation = "none";
        void container.offsetHeight;
        container.style.animation = "modal-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1) both";
      }
      const activeBtn = (_f = (_e = this.shadow).querySelector) == null ? void 0 : _f.call(_e, ".tab-btn.active");
      if (activeBtn) {
        try {
          (_g = activeBtn.scrollIntoView) == null ? void 0 : _g.call(activeBtn, { behavior: "auto", block: "nearest", inline: "nearest" });
        } catch (_) {
        }
      }
    } else {
      backdrop.style.opacity = "0";
      backdrop.classList.remove("af-modal-open");
      if (backdrop._closeTimer) {
        clearTimeout(backdrop._closeTimer);
      }
      backdrop._closeTimer = setTimeout(() => {
        if (!this.isOpen && backdrop.style) {
          backdrop.style.display = "none";
        }
      }, 220);
    }
    return true;
  }
  /**
   * 切换 Tab (原生局部切换，0 毫秒完成，零 DOM 销毁重构，零入场动画重演，杜绝界面闪烁)
   */
  setTab(tab) {
    if (this.activeTab === tab)
      return;
    const prevTab = this.activeTab;
    this.activeTab = tab;
    this.submitFeedbackMessage = null;
    const switched = this.switchTabDom(tab, prevTab);
    if (!switched) {
      this.cleanupExtensionTabs();
      this.render();
      this.bindEvents();
    }
    this.checkAndSyncPolling();
    if (tab === "history") {
      this.loadHistory(this.loadedDates.size > 0);
    }
  }
  /**
   * 判断当前是否处于真实浏览器 Shadow DOM 环境 (区分 Node 单元测试环境)
   */
  isNativeDom() {
    return typeof ShadowRoot !== "undefined" && this.shadow instanceof ShadowRoot;
  }
  /**
   * 原生局部 Tab 切换 (0 毫秒完成，零 DOM 重建，零入场动画重演，杜绝界面闪烁)
   */
  switchTabDom(newTab, prevTab) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
    if (!this.shadow)
      return false;
    if (!this.isNativeDom())
      return false;
    const allTabBtns = (_b = (_a = this.shadow).querySelectorAll) == null ? void 0 : _b.call(_a, ".tab-btn");
    if (!allTabBtns || allTabBtns.length === 0)
      return false;
    allTabBtns.forEach((btn) => {
      var _a2, _b2, _c2, _d2, _e2, _f2, _g2;
      (_b2 = (_a2 = btn.classList) == null ? void 0 : _a2.remove) == null ? void 0 : _b2.call(_a2, "active");
      if ((_d2 = (_c2 = btn.classList) == null ? void 0 : _c2.contains) == null ? void 0 : _d2.call(_c2, `tab-btn-${newTab}`)) {
        (_f2 = (_e2 = btn.classList) == null ? void 0 : _e2.add) == null ? void 0 : _f2.call(_e2, "active");
        try {
          (_g2 = btn.scrollIntoView) == null ? void 0 : _g2.call(btn, { behavior: "smooth", block: "nearest", inline: "nearest" });
        } catch (_) {
        }
      }
    });
    if (prevTab !== "submit" && prevTab !== "history" && prevTab !== "settings") {
      const cleanup = this.extensionCleanups.get(prevTab);
      if (typeof cleanup === "function") {
        try {
          cleanup();
        } catch (err) {
          console.error(`[agent-feedback] Error cleaning up extension tab ${prevTab}:`, err);
        }
        this.extensionCleanups.delete(prevTab);
      }
    }
    const panelSubmit = (_d = (_c = this.shadow).querySelector) == null ? void 0 : _d.call(_c, ".af-tab-panel-submit");
    const panelHistory = (_f = (_e = this.shadow).querySelector) == null ? void 0 : _f.call(_e, ".af-tab-panel-history");
    const panelSettings = (_h = (_g = this.shadow).querySelector) == null ? void 0 : _h.call(_g, ".af-tab-panel-settings");
    const allExtPanels = (_j = (_i = this.shadow).querySelectorAll) == null ? void 0 : _j.call(_i, ".af-tab-panel-ext");
    if (panelSubmit) {
      panelSubmit.style.display = newTab === "submit" ? "block" : "none";
    }
    if (panelHistory) {
      panelHistory.style.display = newTab === "history" ? "block" : "none";
    }
    if (panelSettings) {
      panelSettings.style.display = newTab === "settings" ? "block" : "none";
    }
    if (allExtPanels) {
      allExtPanels.forEach((p) => {
        var _a2;
        const id = (_a2 = p.getAttribute) == null ? void 0 : _a2.call(p, "data-tab-id");
        p.style.display = id === newTab ? "block" : "none";
      });
    }
    if (newTab !== "submit" && newTab !== "history" && newTab !== "settings") {
      const extensions = typeof window !== "undefined" ? window.__AGENT_FEEDBACK_EXTENSIONS__ || [] : [];
      const currentExt = extensions.find((e) => e.id === newTab);
      const container = (_l = (_k = this.shadow).querySelector) == null ? void 0 : _l.call(_k, `.ext-tab-container[data-tab-id="${newTab}"]`);
      if (currentExt && container) {
        try {
          const context = {
            closeModal: () => this.toggleModal(false),
            openTab: (id) => this.setTab(id),
            theme: ((_m = this.getAttribute) == null ? void 0 : _m.call(this, "theme")) || "dark"
          };
          const cleanup = currentExt.render(container, context);
          if (typeof cleanup === "function") {
            this.extensionCleanups.set(currentExt.id, cleanup);
          }
        } catch (err) {
          console.error(`[agent-feedback] Error rendering extension tab ${currentExt.id}:`, err);
        }
      }
    }
    return true;
  }
  /**
   * 局部更新历史面板 DOM (不重建整个 Shadow DOM，平滑流畅)
   */
  updateHistoryDom() {
    var _a, _b, _c, _d, _e, _f;
    if (!this.shadow)
      return;
    if (!this.isNativeDom()) {
      this.render();
      this.bindEvents();
      return;
    }
    const historyPanel = (_b = (_a = this.shadow).querySelector) == null ? void 0 : _b.call(_a, ".af-tab-panel-history");
    if (!historyPanel) {
      this.render();
      this.bindEvents();
      return;
    }
    const countEl = (_c = historyPanel.querySelector) == null ? void 0 : _c.call(historyPanel, ".history-controls span");
    if (countEl) {
      countEl.textContent = `共 ${this.totalTicketsCount || this.historyList.length} 条记录`;
    }
    const historyTabBtn = (_e = (_d = this.shadow).querySelector) == null ? void 0 : _e.call(_d, ".tab-btn-history");
    if (historyTabBtn) {
      historyTabBtn.textContent = `历史与进度 ${this.totalTicketsCount > 0 ? `(${this.totalTicketsCount})` : ""}`;
    }
    const wrapper = (_f = historyPanel.querySelector) == null ? void 0 : _f.call(historyPanel, ".timeline-view-wrapper");
    if (wrapper) {
      wrapper.innerHTML = this.renderTimelineView();
      this.bindHistoryEvents(wrapper);
    }
  }
  /**
   * 加载历史时间轴数据 (首屏极速并发，1 次往返搞定)
   */
  async loadHistory(silent = false) {
    var _a;
    if (typeof fetch === "undefined")
      return;
    if (((_a = this.accessControlConfig) == null ? void 0 : _a.enabled) && !this.isAuthorized()) {
      this.isLoadingHistory = false;
      this.historyList = [];
      this.datesList = [];
      this.totalTicketsCount = 0;
      this.updateHistoryDom();
      return;
    }
    if (!silent || this.loadedDates.size === 0) {
      this.isLoadingHistory = true;
      this.updateHistoryDom();
    }
    try {
      const [datesRes, listRes] = await Promise.all([
        fetch(this.getApiUrl("/api/__agent_feedback/dates"), { headers: this.getAuthHeaders() }).catch(() => null),
        fetch(this.getApiUrl("/api/__agent_feedback/list"), { headers: this.getAuthHeaders() }).catch(() => null)
      ]);
      if (datesRes && datesRes.ok) {
        const datesData = await datesRes.json();
        this.datesList = Array.isArray(datesData == null ? void 0 : datesData.dates) ? datesData.dates : [];
        this.totalTicketsCount = typeof (datesData == null ? void 0 : datesData.totalCount) === "number" ? datesData.totalCount : 0;
      }
      if (listRes && listRes.ok) {
        const data = await listRes.json();
        const list = Array.isArray(data) ? data : data.list || [];
        this.loadedDates.clear();
        this.currentDateIndex = 0;
        if (this.datesList.length > 0) {
          this.loadedDates.set(this.datesList[0], list);
        } else if (list.length > 0) {
          for (const item of list) {
            const d = item.date || formatLocalDate(item);
            if (!this.loadedDates.has(d))
              this.loadedDates.set(d, []);
            this.loadedDates.get(d).push(item);
          }
        }
        this.historyList = list;
        this.hasProcessingItems = list.some((i) => i.status === "processing" || i.status === "pending");
        if (this.totalTicketsCount === 0) {
          this.totalTicketsCount = list.length;
        }
      }
    } catch (err) {
      console.warn("[agent-feedback] Failed to load history:", err);
    } finally {
      this.isLoadingHistory = false;
      this.updateHistoryDom();
      this.checkAndSyncPolling();
    }
  }
  /**
   * 加载前一天历史记录 (保持滚动条位置，彻底解决跳顶问题)
   */
  async loadPreviousDay() {
    var _a;
    if (typeof fetch === "undefined")
      return;
    if (((_a = this.accessControlConfig) == null ? void 0 : _a.enabled) && !this.isAuthorized())
      return;
    if (this.currentDateIndex + 1 >= this.datesList.length)
      return;
    this.currentDateIndex++;
    const prevDate = this.datesList[this.currentDateIndex];
    const bodyEl = this.shadow.querySelector(".modal-body");
    const prevScrollTop = bodyEl ? bodyEl.scrollTop : 0;
    try {
      const res = await fetch(this.getApiUrl(`/api/__agent_feedback/list?date=${encodeURIComponent(prevDate)}`), {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          this.loadedDates.set(prevDate, list);
        }
      }
    } catch (err) {
      console.warn("[agent-feedback] Failed to load previous day:", err);
    } finally {
      this.updateHistoryDom();
      const newBodyEl = this.shadow.querySelector(".modal-body");
      if (newBodyEl) {
        newBodyEl.scrollTop = prevScrollTop;
      }
    }
  }
  /**
   * 提交反馈至 DevServer
   */
  async submitFeedback() {
    if (!this.isAuthorized()) {
      this.submitFeedbackMessage = {
        type: "error",
        text: "受限访问保护：当前环境未授权，禁止提交反馈。"
      };
      this.render();
      this.bindEvents();
      return;
    }
    const content = this.feedbackContent.trim();
    if (!content) {
      this.submitFeedbackMessage = { type: "error", text: "请填写反馈内容" };
      this.render();
      this.bindEvents();
      return;
    }
    this.isSubmitting = true;
    this.submitFeedbackMessage = null;
    this.render();
    this.bindEvents();
    try {
      const telemetry = collectTelemetry();
      const consoleLogs = getRecentLogs();
      const cleanMedia = this.attachedMedia.filter((m) => !m.isUploading && m.url).map(({ isUploading, uploadProgress, ...m }) => m);
      const allScreenshots = [...this.attachedScreenshots];
      cleanMedia.forEach((m) => {
        if (!allScreenshots.includes(m.url)) {
          allScreenshots.push(m.url);
        }
      });
      const payload = {
        id: Date.now(),
        type: "user_feedback",
        timestamp: Date.now(),
        receivedAt: (/* @__PURE__ */ new Date()).toISOString(),
        content,
        status: "pending",
        telemetry,
        consoleLogs,
        ...allScreenshots.length > 0 ? { screenshots: allScreenshots } : {},
        ...cleanMedia.length > 0 ? { media: cleanMedia } : {}
      };
      const res = await fetch(this.getApiUrl("/api/__agent_feedback/submit"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });
      let resJson = null;
      try {
        resJson = await res.json();
      } catch {
        resJson = null;
      }
      if (!res.ok || !resJson || resJson.success !== true) {
        throw new Error((resJson == null ? void 0 : resJson.error) || (resJson == null ? void 0 : resJson.message) || `提交异常 (HTTP ${res.status})`);
      }
      this.feedbackContent = "";
      this.attachedScreenshots = [];
      this.attachedMedia = [];
      this.submitFeedbackMessage = {
        type: "success",
        text: "反馈已递交！AI Agent 哨兵将在 10 秒防抖后自动唤醒分析修复。"
      };
      this.hasProcessingItems = true;
      this.isSubmitting = false;
      this.render();
      this.bindEvents();
      const autoSwitchTimer = setTimeout(() => {
        if (this.isOpen) {
          this.setTab("history");
        }
      }, 1500);
      if (typeof (autoSwitchTimer == null ? void 0 : autoSwitchTimer.unref) === "function") {
        autoSwitchTimer.unref();
      }
    } catch (err) {
      this.isSubmitting = false;
      this.submitFeedbackMessage = {
        type: "error",
        text: `提交失败: ${err.message || "网络连接异常"}`
      };
      this.render();
      this.bindEvents();
    }
  }
  /**
   * 绑定 DOM 事件（包括手势拖拽、磁吸贴边与各按钮交互）
   */
  bindEvents() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O, _P, _Q, _R, _S, _T, _U, _V, _W, _X, _Y, _Z, __, _$, _aa, _ba, _ca, _da, _ea, _fa, _ga, _ha, _ia, _ja, _ka, _la, _ma, _na, _oa, _pa, _qa, _ra, _sa, _ta, _ua, _va, _wa, _xa, _ya, _za, _Aa, _Ba;
    if (!this.shadow)
      return;
    const pill = (_b = (_a = this.shadow).querySelector) == null ? void 0 : _b.call(_a, ".pill-trigger");
    if (pill) {
      let isPointerActive = false;
      let hasMoved = false;
      let touchStartTime = 0;
      let totalMoveDist = 0;
      let startX = 0;
      let startY = 0;
      let initLeft = 0;
      let initTop = 0;
      let pillWidth = 120;
      let pillHeight = 40;
      const onPointerStart = (clientX, clientY) => {
        isPointerActive = true;
        hasMoved = false;
        touchStartTime = Date.now();
        totalMoveDist = 0;
        startX = clientX;
        startY = clientY;
        const rect = pill.getBoundingClientRect ? pill.getBoundingClientRect() : { left: 0, top: 0, width: 120, height: 40 };
        initLeft = rect.left;
        initTop = rect.top;
        pillWidth = rect.width || 120;
        pillHeight = rect.height || 40;
        if (pill.style)
          pill.style.transition = "none";
      };
      const onPointerMove = (clientX, clientY) => {
        if (!isPointerActive)
          return;
        const dx = clientX - startX;
        const dy = clientY - startY;
        totalMoveDist = Math.hypot(dx, dy);
        if (totalMoveDist > 18 && Date.now() - touchStartTime > 100) {
          hasMoved = true;
        }
        if (!hasMoved)
          return;
        const winW = typeof window !== "undefined" ? window.innerWidth : 400;
        const winH = typeof window !== "undefined" ? window.innerHeight : 800;
        let newLeft = Math.max(10, Math.min(winW - pillWidth - 10, initLeft + dx));
        let newTop = Math.max(10, Math.min(winH - pillHeight - 10, initTop + dy));
        this.currentLeft = newLeft;
        this.currentTop = newTop;
        if (pill.style) {
          pill.style.left = `${newLeft}px`;
          pill.style.top = `${newTop}px`;
          pill.style.right = "auto";
          pill.style.bottom = "auto";
        }
      };
      const onPointerEnd = (e) => {
        if (!isPointerActive)
          return;
        isPointerActive = false;
        const elapsed = Date.now() - touchStartTime;
        if (hasMoved && elapsed > 180 && totalMoveDist > 20) {
          if (pill.style) {
            pill.style.transition = "left 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1)";
            const winW = typeof window !== "undefined" ? window.innerWidth : 400;
            const centerX = (this.currentLeft ?? initLeft) + pillWidth / 2;
            if (centerX < winW / 2) {
              this.currentLeft = 16;
              pill.style.left = "16px";
            } else {
              const rightSnap = winW - pillWidth - 16;
              this.currentLeft = rightSnap;
              pill.style.left = `${rightSnap}px`;
            }
          }
          setTimeout(() => {
            hasMoved = false;
          }, 250);
        } else {
          hasMoved = false;
          if (e && typeof e.preventDefault === "function") {
            try {
              e.preventDefault();
            } catch {
            }
          }
          this.toggleModal(true);
        }
      };
      pill.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 && e.pointerType === "mouse")
          return;
        onPointerStart(e.clientX, e.clientY);
        if (typeof pill.setPointerCapture === "function") {
          try {
            pill.setPointerCapture(e.pointerId);
          } catch {
          }
        }
      });
      pill.addEventListener("pointermove", (e) => {
        onPointerMove(e.clientX, e.clientY);
      });
      const handlePointerUp = (e) => {
        if (typeof pill.releasePointerCapture === "function") {
          try {
            pill.releasePointerCapture(e.pointerId);
          } catch {
          }
        }
        if (!hasMoved && typeof e.preventDefault === "function") {
          try {
            e.preventDefault();
          } catch {
          }
        }
        onPointerEnd(e);
      };
      pill.addEventListener("pointerup", handlePointerUp);
      pill.addEventListener("pointercancel", handlePointerUp);
      pill.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!this.isOpen && (!hasMoved || totalMoveDist < 20)) {
          this.toggleModal(true);
        }
      });
    }
    const closeBtn = (_d = (_c = this.shadow).querySelector) == null ? void 0 : _d.call(_c, ".modal-close");
    if (closeBtn) {
      (_e = closeBtn.addEventListener) == null ? void 0 : _e.call(closeBtn, "click", () => this.toggleModal(false));
    }
    const backdrop = (_g = (_f = this.shadow).querySelector) == null ? void 0 : _g.call(_f, ".modal-backdrop");
    if (backdrop) {
      (_h = backdrop.addEventListener) == null ? void 0 : _h.call(backdrop, "click", (e) => {
        if (Date.now() - this.modalOpenedAt < 450) {
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        if (e.target === backdrop)
          this.toggleModal(false);
      });
      (_i = backdrop.addEventListener) == null ? void 0 : _i.call(backdrop, "pointerup", (e) => {
        if (Date.now() - this.modalOpenedAt < 450) {
          e.stopPropagation();
        }
      });
    }
    const tabSubmit = (_k = (_j = this.shadow).querySelector) == null ? void 0 : _k.call(_j, ".tab-btn-submit");
    if (tabSubmit) {
      (_l = tabSubmit.addEventListener) == null ? void 0 : _l.call(tabSubmit, "click", () => this.setTab("submit"));
    }
    const tabHistory = (_n = (_m = this.shadow).querySelector) == null ? void 0 : _n.call(_m, ".tab-btn-history");
    if (tabHistory) {
      (_o = tabHistory.addEventListener) == null ? void 0 : _o.call(tabHistory, "click", () => this.setTab("history"));
    }
    const tabSettings = (_q = (_p = this.shadow).querySelector) == null ? void 0 : _q.call(_p, ".tab-btn-settings");
    if (tabSettings) {
      (_r = tabSettings.addEventListener) == null ? void 0 : _r.call(tabSettings, "click", () => this.setTab("settings"));
    }
    const extensions = typeof window !== "undefined" ? window.__AGENT_FEEDBACK_EXTENSIONS__ || [] : [];
    for (const ext of extensions) {
      const extBtn = (_t = (_s = this.shadow).querySelector) == null ? void 0 : _t.call(_s, `.tab-btn-${ext.id}`);
      if (extBtn) {
        (_u = extBtn.addEventListener) == null ? void 0 : _u.call(extBtn, "click", () => this.setTab(ext.id));
      }
    }
    if (this.activeTab !== "submit" && this.activeTab !== "history" && this.activeTab !== "settings") {
      const currentExt = extensions.find((e) => e.id === this.activeTab);
      const container = (_w = (_v = this.shadow).querySelector) == null ? void 0 : _w.call(_v, `.ext-tab-container[data-tab-id="${this.activeTab}"]`);
      if (currentExt && container) {
        try {
          const context = {
            closeModal: () => this.toggleModal(false),
            openTab: (id) => this.setTab(id),
            theme: ((_x = this.getAttribute) == null ? void 0 : _x.call(this, "theme")) || "dark"
          };
          const cleanup = currentExt.render(container, context);
          if (typeof cleanup === "function") {
            this.extensionCleanups.set(currentExt.id, cleanup);
          }
        } catch (err) {
          console.error(`[agent-feedback] Error rendering extension tab ${currentExt.id}:`, err);
        }
      }
    }
    const textarea = (_z = (_y = this.shadow).querySelector) == null ? void 0 : _z.call(_y, ".feedback-textarea");
    if (textarea) {
      try {
        textarea.blur();
        if (typeof document !== "undefined" && document.activeElement === textarea) {
          (_B = (_A = document.activeElement) == null ? void 0 : _A.blur) == null ? void 0 : _B.call(_A);
        }
      } catch {
      }
      (_C = textarea.addEventListener) == null ? void 0 : _C.call(textarea, "click", (e) => {
        if (Date.now() - this.modalOpenedAt < 450) {
          e.preventDefault();
          e.stopPropagation();
          try {
            textarea.blur();
          } catch {
          }
        }
      });
      (_D = textarea.addEventListener) == null ? void 0 : _D.call(textarea, "pointerdown", (e) => {
        if (Date.now() - this.modalOpenedAt < 450) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
      (_E = textarea.addEventListener) == null ? void 0 : _E.call(textarea, "input", () => {
        this.feedbackContent = textarea.value;
      });
    }
    const submitBtn = (_G = (_F = this.shadow).querySelector) == null ? void 0 : _G.call(_F, ".btn-submit");
    if (submitBtn) {
      (_H = submitBtn.addEventListener) == null ? void 0 : _H.call(submitBtn, "click", () => this.submitFeedback());
    }
    this.bindHistoryEvents();
    const captureBtn = (_J = (_I = this.shadow).querySelector) == null ? void 0 : _J.call(_I, ".btn-capture-screen");
    if (captureBtn) {
      (_K = captureBtn.addEventListener) == null ? void 0 : _K.call(captureBtn, "click", async () => {
        if (this.attachedScreenshots.length >= 6)
          return;
        const originalText = captureBtn.innerHTML;
        captureBtn.setAttribute("disabled", "true");
        captureBtn.innerHTML = "📸 正在全景截屏...";
        try {
          const shot = await captureScreenshot();
          if (shot) {
            this.attachedScreenshots.push(shot);
            this.render();
            this.bindEvents();
          } else {
            captureBtn.removeAttribute("disabled");
            captureBtn.innerHTML = originalText;
            alert("当前运行环境自动截屏受限（或存在跨域安全保护），建议使用手机自带快捷键截屏后，点击「上传本地截图」添加图片。");
          }
        } catch {
          captureBtn.removeAttribute("disabled");
          captureBtn.innerHTML = originalText;
        }
      });
    }
    const removeShotBtns = (_M = (_L = this.shadow).querySelectorAll) == null ? void 0 : _M.call(_L, ".btn-remove-shot");
    removeShotBtns == null ? void 0 : removeShotBtns.forEach((btn) => {
      var _a2;
      (_a2 = btn.addEventListener) == null ? void 0 : _a2.call(btn, "click", (e) => {
        var _a3;
        e.stopPropagation();
        const idxStr = (_a3 = btn.getAttribute) == null ? void 0 : _a3.call(btn, "data-index");
        const idx = parseInt(idxStr || "0", 10);
        if (!isNaN(idx) && idx >= 0 && idx < this.attachedScreenshots.length) {
          this.attachedScreenshots.splice(idx, 1);
          this.render();
          this.bindEvents();
        }
      });
    });
    const removeMediaBtns = (_O = (_N = this.shadow).querySelectorAll) == null ? void 0 : _O.call(_N, ".btn-remove-media");
    removeMediaBtns == null ? void 0 : removeMediaBtns.forEach((btn) => {
      var _a2;
      (_a2 = btn.addEventListener) == null ? void 0 : _a2.call(btn, "click", (e) => {
        var _a3;
        e.stopPropagation();
        const idxStr = (_a3 = btn.getAttribute) == null ? void 0 : _a3.call(btn, "data-index");
        const idx = parseInt(idxStr || "0", 10);
        if (!isNaN(idx) && idx >= 0 && idx < this.attachedMedia.length) {
          this.attachedMedia.splice(idx, 1);
          this.render();
          this.bindEvents();
        }
      });
    });
    const fileInput = (_Q = (_P = this.shadow).querySelector) == null ? void 0 : _Q.call(_P, ".screenshot-file-input");
    if (fileInput) {
      (_R = fileInput.addEventListener) == null ? void 0 : _R.call(fileInput, "change", async () => {
        const files = Array.from(fileInput.files || []);
        if (files.length === 0)
          return;
        const remaining = Math.max(0, 6 - (this.attachedScreenshots.length + this.attachedMedia.length));
        const filesToRead = files.slice(0, remaining);
        for (const file of filesToRead) {
          const isVideo = file.type.startsWith("video/") || isVideoMedia(file.name);
          if (isVideo) {
            if (file.size > 50 * 1024 * 1024) {
              alert("单个录屏视频请勿超过 50MB");
              continue;
            }
            const mediaPlaceholder = {
              type: "video",
              url: "",
              filename: file.name,
              size: file.size,
              isUploading: true,
              uploadProgress: 0
            };
            this.attachedMedia.push(mediaPlaceholder);
            this.render();
            this.bindEvents();
            try {
              const uploaded = await uploadMediaInChunks(file, file.name, this.apiBase, (percent) => {
                var _a2, _b2;
                mediaPlaceholder.uploadProgress = percent;
                const progressEl = (_b2 = (_a2 = this.shadow).querySelector) == null ? void 0 : _b2.call(_a2, `.media-upload-tag[data-filename="${file.name}"]`);
                if (progressEl) {
                  progressEl.textContent = `上传中 ${percent}%`;
                }
              });
              mediaPlaceholder.url = uploaded.url;
              mediaPlaceholder.filename = uploaded.filename;
              mediaPlaceholder.isUploading = false;
              mediaPlaceholder.uploadProgress = 100;
            } catch (err) {
              console.error("[agent-feedback] Video chunk upload failed:", err);
              const idx = this.attachedMedia.indexOf(mediaPlaceholder);
              if (idx >= 0)
                this.attachedMedia.splice(idx, 1);
              alert(`视频上传失败: ${(err == null ? void 0 : err.message) || "网络连接中断"}`);
            }
            this.render();
            this.bindEvents();
          } else {
            try {
              const compressed = await compressImage(file, 1200, 0.75);
              if (compressed) {
                this.attachedScreenshots.push(compressed);
              }
            } catch (err) {
              console.error("[agent-feedback] Failed to compress screenshot file:", err);
            }
          }
        }
        this.render();
        this.bindEvents();
      });
    }
    const allThumbs = (_T = (_S = this.shadow).querySelectorAll) == null ? void 0 : _T.call(_S, ".ticket-screenshot-thumb, .screenshot-img");
    allThumbs == null ? void 0 : allThumbs.forEach((thumb) => {
      var _a2;
      (_a2 = thumb.addEventListener) == null ? void 0 : _a2.call(thumb, "click", (e) => {
        var _a3, _b2, _c2, _d2;
        e.stopPropagation();
        const src = ((_a3 = thumb.getAttribute) == null ? void 0 : _a3.call(thumb, "data-full")) || ((_b2 = thumb.getAttribute) == null ? void 0 : _b2.call(thumb, "src"));
        const title = ((_c2 = thumb.getAttribute) == null ? void 0 : _c2.call(thumb, "data-title")) || ((_d2 = thumb.getAttribute) == null ? void 0 : _d2.call(thumb, "alt")) || "截图放大预览";
        if (src) {
          this.lightboxSrc = src;
          this.lightboxTitle = title;
          this.render();
          this.bindEvents();
        }
      });
    });
    const videoLightboxBtns = (_V = (_U = this.shadow).querySelectorAll) == null ? void 0 : _V.call(_U, ".btn-video-lightbox");
    videoLightboxBtns == null ? void 0 : videoLightboxBtns.forEach((btn) => {
      var _a2;
      (_a2 = btn.addEventListener) == null ? void 0 : _a2.call(btn, "click", (e) => {
        var _a3;
        e.stopPropagation();
        const videoSrc = (_a3 = btn.getAttribute) == null ? void 0 : _a3.call(btn, "data-video-src");
        if (videoSrc) {
          this.lightboxSrc = videoSrc;
          this.lightboxTitle = "真机录屏播放";
          this.render();
          this.bindEvents();
        }
      });
    });
    const lightbox = (_X = (_W = this.shadow).querySelector) == null ? void 0 : _X.call(_W, ".af-lightbox");
    if (lightbox) {
      (_Y = lightbox.addEventListener) == null ? void 0 : _Y.call(lightbox, "click", () => {
        this.lightboxSrc = null;
        this.render();
        this.bindEvents();
      });
    }
    const jumpBtns = (__ = (_Z = this.shadow).querySelectorAll) == null ? void 0 : __.call(_Z, ".btn-jump-to-settings");
    jumpBtns == null ? void 0 : jumpBtns.forEach((btn) => {
      var _a2;
      (_a2 = btn.addEventListener) == null ? void 0 : _a2.call(btn, "click", () => {
        this.setTab("settings");
      });
    });
    const btnVerifyAccess = (_aa = (_$ = this.shadow).querySelector) == null ? void 0 : _aa.call(_$, ".btn-verify-access");
    const inputAccessKey = (_ca = (_ba = this.shadow).querySelector) == null ? void 0 : _ca.call(_ba, ".access-key-input");
    const verifyMsg = (_ea = (_da = this.shadow).querySelector) == null ? void 0 : _ea.call(_da, ".verify-feedback-msg");
    if (btnVerifyAccess && inputAccessKey) {
      const doVerify = async () => {
        const key = (inputAccessKey.value || "").trim();
        if (!key) {
          if (verifyMsg) {
            verifyMsg.textContent = "请输入配对密钥";
            verifyMsg.className = "verify-feedback-msg error";
            verifyMsg.style.display = "block";
          }
          return;
        }
        btnVerifyAccess.disabled = true;
        btnVerifyAccess.textContent = "验证中...";
        try {
          const ok = await this.authorize(key);
          if (ok) {
            if (verifyMsg) {
              verifyMsg.textContent = "✅ 解锁成功！";
              verifyMsg.className = "verify-feedback-msg success";
              verifyMsg.style.display = "block";
            }
            setTimeout(() => {
              this.render();
              this.bindEvents();
            }, 400);
          } else {
            btnVerifyAccess.disabled = false;
            btnVerifyAccess.textContent = "验证解锁";
            if (verifyMsg) {
              verifyMsg.textContent = "❌ 密钥验证失败，请核对后重试";
              verifyMsg.className = "verify-feedback-msg error";
              verifyMsg.style.display = "block";
            }
          }
        } catch (e) {
          btnVerifyAccess.disabled = false;
          btnVerifyAccess.textContent = "验证解锁";
          if (verifyMsg) {
            verifyMsg.textContent = `❌ 验证出错: ${e.message || "网络异常"}`;
            verifyMsg.className = "verify-feedback-msg error";
            verifyMsg.style.display = "block";
          }
        }
      };
      (_fa = btnVerifyAccess.addEventListener) == null ? void 0 : _fa.call(btnVerifyAccess, "click", doVerify);
      (_ga = inputAccessKey.addEventListener) == null ? void 0 : _ga.call(inputAccessKey, "keydown", (e) => {
        if (e.key === "Enter")
          doVerify();
      });
    }
    const btnTestConn = (_ia = (_ha = this.shadow).querySelector) == null ? void 0 : _ia.call(_ha, ".btn-test-connection");
    const inputSettingsApiBase = (_ka = (_ja = this.shadow).querySelector) == null ? void 0 : _ka.call(_ja, ".settings-api-base-input");
    const connResult = (_ma = (_la = this.shadow).querySelector) == null ? void 0 : _ma.call(_la, ".settings-conn-result");
    if (btnTestConn && inputSettingsApiBase) {
      (_na = btnTestConn.addEventListener) == null ? void 0 : _na.call(btnTestConn, "click", async () => {
        const url = (inputSettingsApiBase.value || "").trim().replace(/\/+$/, "");
        btnTestConn.disabled = true;
        btnTestConn.textContent = "测试中...";
        if (connResult) {
          connResult.style.display = "block";
          connResult.textContent = "正在发起服务连通性探测...";
          connResult.className = "settings-conn-result info";
        }
        const startTime = Date.now();
        try {
          const testEndpoint = url ? `${url}/api/__agent_feedback/auth/config` : this.getApiUrl("/api/__agent_feedback/auth/config");
          const res = await fetch(testEndpoint, { method: "GET" });
          const latency = Date.now() - startTime;
          if (res.ok) {
            try {
              const authData = await res.json();
              if (authData == null ? void 0 : authData.accessControl) {
                setAccessControl(authData.accessControl);
                this.accessControlConfig = { ...getAccessControl() };
              }
            } catch {
            }
            if (connResult) {
              connResult.textContent = `✅ 连通良好！服务响应正常 (延迟: ${latency}ms)`;
              connResult.className = "settings-conn-result success";
            }
          } else {
            if (connResult) {
              connResult.textContent = `⚠️ 服务已响应，但返回状态码 HTTP ${res.status}`;
              connResult.className = "settings-conn-result warn";
            }
          }
        } catch (e) {
          if (connResult) {
            connResult.textContent = `❌ 连接失败: ${e.message || "网络无法达"}`;
            connResult.className = "settings-conn-result error";
          }
        } finally {
          btnTestConn.disabled = false;
          btnTestConn.textContent = "🔌 测试连通性";
        }
      });
    }
    const btnSaveApiBase = (_pa = (_oa = this.shadow).querySelector) == null ? void 0 : _pa.call(_oa, ".btn-save-api-base");
    if (btnSaveApiBase && inputSettingsApiBase) {
      (_qa = btnSaveApiBase.addEventListener) == null ? void 0 : _qa.call(btnSaveApiBase, "click", () => {
        const url = (inputSettingsApiBase.value || "").trim().replace(/\/+$/, "");
        setApiBase(url);
        this.apiBase = url;
        if (connResult) {
          connResult.style.display = "block";
          connResult.textContent = "✅ API 基地址已更新并持久化至本地存储";
          connResult.className = "settings-conn-result success";
        }
        syncAccessControlFromServer(url).then((cfg) => {
          if (cfg) {
            this.accessControlConfig = { ...getAccessControl() };
            this.render();
            this.bindEvents();
          }
        });
        this.fetchHistoryQuickStatus();
      });
    }
    const btnDeauth = (_sa = (_ra = this.shadow).querySelector) == null ? void 0 : _sa.call(_ra, ".btn-deauthorize");
    if (btnDeauth) {
      (_ta = btnDeauth.addEventListener) == null ? void 0 : _ta.call(btnDeauth, "click", () => {
        this.deauthorize();
      });
    }
    const btnVerifySettingsKey = (_va = (_ua = this.shadow).querySelector) == null ? void 0 : _va.call(_ua, ".btn-verify-settings-key");
    const inputSettingsKey = (_xa = (_wa = this.shadow).querySelector) == null ? void 0 : _xa.call(_wa, ".settings-access-key-input");
    const authResult = (_za = (_ya = this.shadow).querySelector) == null ? void 0 : _za.call(_ya, ".settings-auth-result");
    if (btnVerifySettingsKey && inputSettingsKey) {
      const verifySettingsKey = async () => {
        const key = (inputSettingsKey.value || "").trim();
        if (!key) {
          if (authResult) {
            authResult.style.display = "block";
            authResult.textContent = "请输入配对密钥";
            authResult.className = "settings-auth-result error";
          }
          return;
        }
        btnVerifySettingsKey.disabled = true;
        btnVerifySettingsKey.textContent = "验证中...";
        try {
          const ok = await this.authorize(key);
          if (ok) {
            if (authResult) {
              authResult.style.display = "block";
              authResult.textContent = "✅ 授权成功！当前设备已绑定。";
              authResult.className = "settings-auth-result success";
            }
            setTimeout(() => {
              this.render();
              this.bindEvents();
            }, 400);
          } else {
            btnVerifySettingsKey.disabled = false;
            btnVerifySettingsKey.textContent = "🔐 验证并保存授权";
            if (authResult) {
              authResult.style.display = "block";
              authResult.textContent = "❌ 密钥验证失败，请核对后重试";
              authResult.className = "settings-auth-result error";
            }
          }
        } catch (e) {
          btnVerifySettingsKey.disabled = false;
          btnVerifySettingsKey.textContent = "🔐 验证并保存授权";
          if (authResult) {
            authResult.style.display = "block";
            authResult.textContent = `❌ 验证出错: ${e.message || "网络异常"}`;
            authResult.className = "settings-auth-result error";
          }
        }
      };
      (_Aa = btnVerifySettingsKey.addEventListener) == null ? void 0 : _Aa.call(btnVerifySettingsKey, "click", verifySettingsKey);
      (_Ba = inputSettingsKey.addEventListener) == null ? void 0 : _Ba.call(inputSettingsKey, "keydown", (e) => {
        if (e.key === "Enter")
          verifySettingsKey();
      });
    }
  }
  /**
   * 绑定历史面板专用交互事件 (刷新、加载前一天、缩略图大图预览)
   */
  bindHistoryEvents(container) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const root = container || this.shadow;
    if (!root)
      return;
    const refreshHistoryBtn = (_a = root.querySelector) == null ? void 0 : _a.call(root, ".btn-refresh-history");
    if (refreshHistoryBtn) {
      (_b = refreshHistoryBtn.addEventListener) == null ? void 0 : _b.call(refreshHistoryBtn, "click", () => this.loadHistory());
    }
    const loadPrevDayBtn = (_c = root.querySelector) == null ? void 0 : _c.call(root, ".btn-load-previous-day");
    if (loadPrevDayBtn) {
      (_d = loadPrevDayBtn.addEventListener) == null ? void 0 : _d.call(loadPrevDayBtn, "click", () => this.loadPreviousDay());
    }
    const historyThumbs = (_e = root.querySelectorAll) == null ? void 0 : _e.call(root, ".ticket-screenshot-thumb");
    historyThumbs == null ? void 0 : historyThumbs.forEach((thumb) => {
      var _a2;
      (_a2 = thumb.addEventListener) == null ? void 0 : _a2.call(thumb, "click", (e) => {
        var _a3, _b2, _c2, _d2;
        e.stopPropagation();
        const src = ((_a3 = thumb.getAttribute) == null ? void 0 : _a3.call(thumb, "data-full")) || ((_b2 = thumb.getAttribute) == null ? void 0 : _b2.call(thumb, "src"));
        const title = ((_c2 = thumb.getAttribute) == null ? void 0 : _c2.call(thumb, "data-title")) || ((_d2 = thumb.getAttribute) == null ? void 0 : _d2.call(thumb, "alt")) || "截图放大预览";
        if (src) {
          this.lightboxSrc = src;
          this.lightboxTitle = title;
          this.render();
          this.bindEvents();
        }
      });
    });
    const activeBtn = (_g = (_f = this.shadow).querySelector) == null ? void 0 : _g.call(_f, ".tab-btn.active");
    if (activeBtn) {
      try {
        (_h = activeBtn.scrollIntoView) == null ? void 0 : _h.call(activeBtn, { behavior: "auto", block: "nearest", inline: "nearest" });
      } catch (_) {
      }
    }
  }
  /**
   * 格式化状态徽标
   */
  renderStatusBadge(status) {
    switch (status) {
      case "processing":
        return `<span class="badge badge-processing"><span class="badge-dot pulse"></span>AI 修复中</span>`;
      case "completed":
        return `<span class="badge badge-completed">✓ 修复完成</span>`;
      case "rejected":
        return `<span class="badge badge-rejected">✕ 安全驳回</span>`;
      case "ignored":
        return `<span class="badge badge-ignored">已忽略</span>`;
      case "pending":
      default:
        return `<span class="badge badge-pending">⏱ 排队中</span>`;
    }
  }
  /**
   * 渲染单个工单卡片
   */
  renderTicketCard(item) {
    const isNotice = item.type === "agent_notice";
    const cardClass = isNotice ? "history-card card-agent-notice" : "history-card";
    const timeStr = formatLocalTime(item);
    return `
      <div class="${cardClass}">
        <div class="card-header">
          <span>#${item.id} · ${timeStr}</span>
          ${isNotice ? `<span class="badge badge-notice">🤖 Agent 系统通知</span>` : this.renderStatusBadge(item.status)}
        </div>
        <div class="card-content">${item.content}</div>
        ${(() => {
      const allMediaUrls = [];
      if (Array.isArray(item.media)) {
        item.media.forEach((m) => {
          const fullUrl = this.getMediaUrl(m.url || m);
          if (fullUrl) {
            allMediaUrls.push({
              type: m.type || (isVideoMedia(fullUrl) ? "video" : "image"),
              url: fullUrl,
              title: m.filename || item.content || "媒体"
            });
          }
        });
      }
      if (Array.isArray(item.screenshots)) {
        item.screenshots.forEach((s) => {
          const fullUrl = this.getScreenshotUrl(s);
          if (fullUrl && !allMediaUrls.some((m) => m.url === fullUrl)) {
            allMediaUrls.push({
              type: isVideoMedia(fullUrl) ? "video" : "image",
              url: fullUrl,
              title: item.content || "截图"
            });
          }
        });
      }
      const videoItems = allMediaUrls.filter((m) => m.type === "video");
      const imageItems = allMediaUrls.filter((m) => m.type === "image");
      let mediaHtml = "";
      if (videoItems.length > 0) {
        mediaHtml += `
              <div class="ticket-videos-container">
                ${videoItems.map((v) => `
                  <div class="ticket-video-card">
                    <video
                      class="ticket-video-player"
                      src="${v.url}"
                      controls
                      playsinline
                      preload="metadata"
                    ></video>
                    <div class="video-meta-bar">
                      <span class="video-badge">🎬 录屏演示</span>
                      <button class="btn-video-lightbox" data-video-src="${v.url}">全屏播放</button>
                    </div>
                  </div>
                `).join("")}
              </div>
            `;
      }
      if (imageItems.length > 0) {
        mediaHtml += `
              <div class="ticket-screenshots">
                ${imageItems.map((img, sIdx) => {
          const safeTitle = img.title.replace(/"/g, "&quot;");
          return `<img src="${img.url}" data-full="${img.url}" data-title="${safeTitle}" class="ticket-screenshot-thumb" alt="截图凭证 ${sIdx + 1}" loading="lazy" title="点击查看大图" />`;
        }).join("")}
              </div>
            `;
      }
      return mediaHtml;
    })()}
        ${item.reply ? `
          <div class="agent-reply-box">
            <div class="agent-reply-header">🤖 Agent 修复说明:</div>
            <div>${item.reply}</div>
          </div>
        ` : ""}
      </div>
    `;
  }
  /**
   * 渲染时间轴视图
   */
  renderTimelineView() {
    if (this.isLoadingHistory) {
      return `<div style="text-align: center; padding: 30px; color: var(--af-text-muted, #9ca3af);">正在获取进度...</div>`;
    }
    if (this.loadedDates.size === 0) {
      return `<div class="empty-history">暂无反馈记录。点击“新建反馈”提交第一条反馈！</div>`;
    }
    const daySections = [];
    for (const [date, items] of this.loadedDates.entries()) {
      daySections.push(`
        <div class="timeline-day-group">
          <div class="timeline-day-header">
            <span class="timeline-dot"></span>
            <span class="timeline-date-title">${date}</span>
            <span class="timeline-date-badge">当日共 ${items.length} 条</span>
          </div>
          <div class="timeline-day-content">
            <div class="timeline-v-line"></div>
            <div class="timeline-cards">
              ${items.map((item) => this.renderTicketCard(item)).join("")}
            </div>
          </div>
        </div>
      `);
    }
    const hasMore = this.currentDateIndex + 1 < this.datesList.length;
    const nextDate = hasMore ? this.datesList[this.currentDateIndex + 1] : "";
    return `
      <div class="timeline-container">
        ${daySections.join("")}
        ${hasMore ? `<button class="btn-load-previous-day">📅 加载前一天记录 (${nextDate})</button>` : ""}
      </div>
    `;
  }
  /**
   * 渲染 Shadow DOM 全景 HTML 与 Scoped CSS
   */
  render() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    if (!this.shadow)
      return;
    const globalAC = getAccessControl();
    if (globalAC && Object.keys(globalAC).length > 0) {
      this.accessControlConfig = { ...this.accessControlConfig, ...globalAC };
    }
    const globalHC = getHostChannel();
    if (globalHC && Object.keys(globalHC).length > 0) {
      this.hostChannelConfig = { ...this.hostChannelConfig, ...globalHC };
    }
    const telemetry = collectTelemetry();
    const logs = getRecentLogs();
    const extensions = typeof window !== "undefined" ? window.__AGENT_FEEDBACK_EXTENSIONS__ || [] : [];
    const injectedOptions = typeof window !== "undefined" ? window.__AGENT_FEEDBACK_OPTIONS__ : void 0;
    const hasSettings = !!(((_a = this.accessControlConfig) == null ? void 0 : _a.enabled) || ((_b = this.accessControlConfig) == null ? void 0 : _b.accessKey) || ((_c = this.accessControlConfig) == null ? void 0 : _c.keyHash) || this.apiBase || getApiBase() || (injectedOptions == null ? void 0 : injectedOptions.showSettings) || ((_d = this.getAttribute) == null ? void 0 : _d.call(this, "show-settings")) === "true");
    const pillPositionStyle = this.currentLeft !== null && this.currentTop !== null ? `left: ${this.currentLeft}px; top: ${this.currentTop}px; right: auto; bottom: auto;` : `right: 16px; bottom: 84px;`;
    this.shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
          --af-primary: #4edea3;
          --af-bg-base: #12151c;
          --af-bg-surface: #181f2a;
          --af-text-main: #f3f4f6;
          --af-text-muted: #9ca3af;
          --af-border: rgba(255, 255, 255, 0.08);
          --af-radius: 12px;
          color: var(--af-text-main, #f3f4f6);
          line-height: 1.5;
          font-size: 14px;
        }

        :host([theme="light"]) {
          --af-primary: #2563eb;
          --af-bg-base: #ffffff;
          --af-bg-surface: #f8fafc;
          --af-text-main: #0f172a;
          --af-text-muted: #64748b;
          --af-border: rgba(0, 0, 0, 0.08);
        }

        :host([theme="dark"]) {
          --af-primary: #4edea3;
          --af-bg-base: #12151c;
          --af-bg-surface: #181f2a;
          --af-text-main: #f3f4f6;
          --af-text-muted: #9ca3af;
          --af-border: rgba(255, 255, 255, 0.08);
        }

        @media (prefers-color-scheme: light) {
          :host([theme="auto"]) {
            --af-primary: #2563eb;
            --af-bg-base: #ffffff;
            --af-bg-surface: #f8fafc;
            --af-text-main: #0f172a;
            --af-text-muted: #64748b;
            --af-border: rgba(0, 0, 0, 0.08);
          }
        }

        @media (prefers-color-scheme: dark) {
          :host([theme="auto"]) {
            --af-primary: #4edea3;
            --af-bg-base: #12151c;
            --af-bg-surface: #181f2a;
            --af-text-main: #f3f4f6;
            --af-text-muted: #9ca3af;
            --af-border: rgba(255, 255, 255, 0.08);
          }
        }

        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        /* 悬浮磁吸胶囊 */
        .pill-trigger {
          position: fixed;
          ${pillPositionStyle}
          z-index: 2147483640;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: var(--af-bg-base, #12151c);
          color: var(--af-primary, #4edea3);
          border: 1px solid var(--af-primary, rgba(78, 222, 163, 0.4));
          border-radius: 9999px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 12px rgba(78, 222, 163, 0.2);
          cursor: grab;
          user-select: none;
          touch-action: none;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.3px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .pill-trigger:active {
          cursor: grabbing;
          transform: scale(0.97);
        }

        .pill-trigger:hover {
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.7), 0 0 16px rgba(78, 222, 163, 0.35);
        }

        .pill-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--af-primary, #4edea3);
          box-shadow: 0 0 8px var(--af-primary, #4edea3);
          flex-shrink: 0;
        }

        .pill-dot.pulsing {
          background: #f59e0b;
          box-shadow: 0 0 10px #f59e0b;
          animation: pulse-ring 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse-ring {
          0% { transform: scale(0.9); opacity: 0.8; }
          50% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.8; }
        }

        /* 模态框遮罩与弹窗 (采用硬件加速平滑过渡，杜绝 DOM 销毁重构与白屏闪烁) */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2147483645;
          background: rgba(0, 0, 0, 0.75);
          -webkit-backdrop-filter: blur(8px);
          backdrop-filter: blur(8px);
          display: ${this.isOpen ? "flex" : "none"};
          align-items: flex-start;
          justify-content: center;
          padding: max(env(safe-area-inset-top, 0px) + 20px, 32px) 16px 16px;
          opacity: ${this.isOpen ? "1" : "0"};
          transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity;
        }

        .modal-backdrop.af-modal-open {
          opacity: 1;
        }

        .modal-container {
          background: var(--af-bg-base, #161922);
          border: 1px solid var(--af-border, #2a303c);
          border-radius: var(--af-radius, 12px);
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.8);
          width: 100%;
          max-width: 480px;
          height: min(82vh, 700px);
          max-height: calc(100vh - 48px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          will-change: transform, opacity;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          transform: translateZ(0);
          animation: modal-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes modal-pop {
          from { opacity: 0; transform: scale(0.96) translateY(8px) translateZ(0); }
          to { opacity: 1; transform: scale(1) translateY(0) translateZ(0); }
        }

        /* 头部与 Tab 切换 (flex-shrink: 0 保证历史长列表滚动或加载时永不被压缩或截断) */
        .modal-header {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--af-border, #222734);
          background: var(--af-bg-surface, #12151c);
        }

        .modal-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--af-text-main, #f3f4f6);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .modal-close {
          background: transparent;
          border: none;
          color: var(--af-text-muted, #9ca3af);
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
        }

        .modal-close:hover {
          color: var(--af-text-main, #fff);
          background: rgba(255, 255, 255, 0.1);
        }

        .tabs {
          flex-shrink: 0;
          display: flex;
          background: var(--af-bg-surface, #12151c);
          border-bottom: 1px solid var(--af-border, #222734);
          padding: 0 8px;
          gap: 4px;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
        }

        .tabs::-webkit-scrollbar {
          display: none;
        }

        .tab-btn {
          background: none;
          border: none;
          color: var(--af-text-muted, #9ca3af);
          font-size: 12px;
          font-weight: 600;
          padding: 10px 4px;
          cursor: pointer;
          position: relative;
          transition: color 0.2s;
          white-space: nowrap;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }

        .tab-btn.active {
          color: var(--af-primary, #4edea3);
        }

        .tab-btn.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--af-primary, #4edea3);
          border-radius: 2px;
        }

        .tab-badge {
          background: var(--af-primary, #4edea3);
          color: var(--af-bg-base, #12151c);
          font-size: 10px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 9999px;
        }

        /* 视图内容容器 */
        .modal-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
          color: var(--af-text-main, #f3f4f6);
        }

        /* 多面板容器：保持在 DOM 中平滑切换，杜绝全屏重绘闪烁 */
        .af-tab-panel {
          width: 100%;
          min-height: 100%;
        }

        .af-tab-panel-submit,
        .af-tab-panel-history,
        .af-tab-panel-ext {
          width: 100%;
        }

        /* 遥测徽标区 */
        .telemetry-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 16px;
        }

        .tele-chip {
          background: var(--af-bg-surface, #1e2430);
          color: var(--af-text-muted, #9ca3af);
          font-size: 11px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          padding: 4px 8px;
          border-radius: calc(var(--af-radius, 12px) - 6px);
          border: 1px solid var(--af-border, #283040);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .tele-chip strong {
          color: var(--af-primary, #4edea3);
        }

        /* 反馈表单 */
        .form-group {
          margin-bottom: 16px;
        }

        .form-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--af-text-main, #d1d5db);
          margin-bottom: 6px;
        }

        .feedback-textarea {
          width: 100%;
          min-height: 100px;
          background: var(--af-bg-surface, #0f1218);
          border: 1px solid var(--af-border, #2a303c);
          border-radius: calc(var(--af-radius, 12px) - 4px);
          padding: 10px 12px;
          color: var(--af-text-main, #f3f4f6);
          font-size: 13px;
          resize: vertical;
          outline: none;
          transition: border-color 0.2s;
        }

        .feedback-textarea:focus {
          border-color: var(--af-primary, #4edea3);
          box-shadow: 0 0 0 2px rgba(78, 222, 163, 0.2);
        }

        /* 截图附件区 */
        .screenshot-section {
          background: var(--af-bg-surface, #11141b);
          border: 1px dashed var(--af-border, #283040);
          border-radius: calc(var(--af-radius, 12px) - 4px);
          padding: 12px;
          margin-bottom: 16px;
        }

        .screenshot-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .btn-secondary {
          background: var(--af-bg-surface, #1e2430);
          border: 1px solid var(--af-border, #2e374a);
          color: var(--af-text-main, #d1d5db);
          padding: 6px 12px;
          border-radius: calc(var(--af-radius, 12px) - 6px);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--af-text-main, #fff);
        }

        .screenshot-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 12px;
        }

        .screenshot-item {
          position: relative;
          width: 72px;
          height: 72px;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--af-border, #283040);
          background: #000;
          flex-shrink: 0;
        }

        .screenshot-img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          cursor: pointer;
          transition: transform 0.15s ease, filter 0.15s ease;
        }

        .screenshot-img:hover {
          transform: scale(1.06);
          filter: brightness(1.1);
        }

        .screenshot-img:active {
          transform: scale(0.96);
        }

        .btn-remove-shot {
          position: absolute;
          top: 3px;
          right: 3px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.75);
          color: #ef4444;
          border: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 11px;
          line-height: 1;
          padding: 0;
          transition: background 0.15s ease;
        }

        .btn-remove-shot:hover {
          background: #ef4444;
          color: #fff;
        }

        /* 提示信息 */
        .alert {
          padding: 10px 12px;
          border-radius: calc(var(--af-radius, 12px) - 4px);
          font-size: 12px;
          margin-bottom: 14px;
        }

        .alert-success {
          background: rgba(78, 222, 163, 0.15);
          color: var(--af-primary, #4edea3);
          border: 1px solid var(--af-primary, rgba(78, 222, 163, 0.3));
        }

        .alert-error {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        /* 提交操作按钮 */
        .btn-submit {
          width: 100%;
          background: var(--af-primary, #4edea3);
          color: #0b0e14;
          border: none;
          padding: 10px 16px;
          border-radius: calc(var(--af-radius, 12px) - 4px);
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: filter 0.15s, transform 0.1s;
        }

        .btn-submit:hover:not(:disabled) {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }

        .btn-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* 时间轴样式 */
        .history-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }

        .timeline-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .timeline-day-group {
          position: relative;
        }

        .timeline-day-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }

        .timeline-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--af-primary, #4edea3);
          box-shadow: 0 0 10px var(--af-primary, #4edea3);
          flex-shrink: 0;
        }

        .timeline-date-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--af-text-main, #f3f4f6);
        }

        .timeline-date-badge {
          font-size: 11px;
          background: var(--af-bg-surface, #1e2430);
          color: var(--af-text-muted, #9ca3af);
          padding: 2px 8px;
          border-radius: 9999px;
          border: 1px solid var(--af-border, rgba(255,255,255,0.08));
        }

        .timeline-day-content {
          position: relative;
          padding-left: 20px;
        }

        .timeline-v-line {
          position: absolute;
          left: 4px;
          top: -4px;
          bottom: 0;
          width: 2px;
          background: var(--af-border, rgba(255,255,255,0.12));
        }

        .timeline-cards {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .history-card {
          background: var(--af-bg-surface, #11141b);
          border: 1px solid var(--af-border, #222734);
          border-radius: calc(var(--af-radius, 12px) - 2px);
          padding: 12px 14px;
        }

        .card-agent-notice {
          border: 1px solid var(--af-primary, #4edea3);
          box-shadow: 0 0 12px rgba(78, 222, 163, 0.15);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 12px;
          color: var(--af-text-muted, #6b7280);
        }

        .card-content {
          font-size: 13px;
          color: var(--af-text-main, #e5e7eb);
          margin-bottom: 10px;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .agent-reply-box {
          background: var(--af-bg-base, #181f2a);
          border-left: 3px solid var(--af-primary, #4edea3);
          border-radius: 4px;
          padding: 8px 10px;
          font-size: 12px;
          color: var(--af-text-main, #cbd5e1);
          margin-top: 8px;
        }

        .ticket-screenshots {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          margin-bottom: 4px;
          flex-wrap: wrap;
        }

        .ticket-screenshot-thumb {
          width: 54px;
          height: 54px;
          object-fit: cover;
          border-radius: 6px;
          border: 1px solid var(--af-border, rgba(255, 255, 255, 0.15));
          background: rgba(0, 0, 0, 0.4);
          cursor: pointer;
          transition: transform 0.15s ease, border-color 0.15s ease;
        }

        .ticket-screenshot-thumb:hover {
          border-color: var(--af-primary, #4edea3);
          transform: scale(1.05);
        }

        .ticket-screenshot-thumb:active {
          transform: scale(0.95);
        }

        /* 全屏 Lightbox 大图预览 */
        .af-lightbox {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          background: rgba(0, 0, 0, 0.92);
          backdrop-filter: blur(12px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 16px;
          cursor: zoom-out;
          animation: modal-pop 0.18s ease-out;
        }

        .af-lightbox-header {
          position: absolute;
          top: 16px;
          left: 16px;
          right: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #fff;
          z-index: 10;
        }

        .af-lightbox-title {
          font-size: 13px;
          font-weight: 600;
          color: #e5e7eb;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 80%;
        }

        .af-lightbox-close {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .af-lightbox-img {
          max-width: 95vw;
          max-height: 85vh;
          object-fit: contain;
          border-radius: 8px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
          cursor: default;
        }

        .af-lightbox-video {
          max-width: 95vw;
          max-height: 85vh;
          border-radius: 8px;
          outline: none;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
          background: #000;
        }

        .ticket-videos-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 8px;
          margin-bottom: 6px;
        }

        .ticket-video-card {
          width: 100%;
          box-sizing: border-box;
          border-radius: 8px;
          background: #000;
          border: 1px solid var(--af-border, rgba(255, 255, 255, 0.15));
          overflow: hidden;
        }

        .ticket-video-player {
          width: 100%;
          height: auto;
          aspect-ratio: 16 / 9;
          max-height: 260px;
          object-fit: contain;
          display: block;
          background: #000;
          outline: none;
        }

        .video-meta-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          background: rgba(18, 21, 28, 0.9);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 11px;
        }

        .video-badge {
          color: var(--af-primary, #4edea3);
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .btn-video-lightbox {
          background: rgba(255, 255, 255, 0.1);
          color: var(--af-text-main, #e2e8f0);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          padding: 2px 8px;
          font-size: 11px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .btn-video-lightbox:hover {
          background: var(--af-primary, #4edea3);
          color: #000;
        }

        .attached-media-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 8px;
        }

        .attached-media-card {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid var(--af-border, rgba(255, 255, 255, 0.12));
        }

        .media-icon-box {
          font-size: 16px;
        }

        .media-info-box {
          flex: 1;
          min-width: 0;
        }

        .media-name {
          font-size: 12px;
          color: var(--af-text-main, #e2e8f0);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .media-sub {
          font-size: 10px;
          color: var(--af-text-muted, #94a3b8);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .media-upload-tag {
          color: #38bdf8;
        }

        .media-ready-tag {
          color: var(--af-primary, #4edea3);
        }

        .btn-remove-media {
          background: transparent;
          border: none;
          color: #ef4444;
          font-size: 14px;
          cursor: pointer;
          padding: 2px 6px;
        }

        .agent-reply-header {
          font-weight: 600;
          color: var(--af-primary, #4edea3);
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* 状态徽章 */
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
        }

        .badge-pending {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
        }

        .badge-processing {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
        }

        .badge-completed {
          background: rgba(78, 222, 163, 0.15);
          color: var(--af-primary, #4edea3);
        }

        .badge-rejected {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }

        .badge-ignored {
          background: rgba(156, 163, 175, 0.15);
          color: #9ca3af;
        }

        .badge-notice {
          background: rgba(78, 222, 163, 0.15);
          color: var(--af-primary, #4edea3);
          border: 1px solid var(--af-primary, rgba(78, 222, 163, 0.3));
        }

        .badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .btn-load-previous-day {
          width: 100%;
          background: var(--af-bg-surface, #1e2430);
          border: 1px dashed var(--af-border, #2e374a);
          color: var(--af-text-muted, #9ca3af);
          padding: 8px 12px;
          border-radius: calc(var(--af-radius, 12px) - 4px);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          text-align: center;
          margin-top: 12px;
        }

        .btn-load-previous-day:hover {
          color: var(--af-text-main, #fff);
          border-color: var(--af-primary, #4edea3);
        }

        .empty-history {
          text-align: center;
          padding: 40px 20px;
          color: var(--af-text-muted, #6b7280);
          font-size: 13px;
        }

        .ext-tab-container {
          width: 100%;
          min-height: 200px;
        }

        /* 受限访问保护屏障 (Lockout Shield) */
        .lockout-shield-container {
          padding: 30px 16px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .lockout-shield-icon {
          font-size: 42px;
          margin-bottom: 2px;
          filter: drop-shadow(0 0 12px rgba(78, 222, 163, 0.4));
        }

        .lockout-shield-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--af-text-main, #f3f4f6);
        }

        .lockout-shield-msg {
          font-size: 13px;
          line-height: 1.6;
          color: var(--af-text-muted, #9ca3af);
          max-width: 340px;
          margin: 0 auto;
        }

        .lockout-host-action {
          margin-top: 6px;
          margin-bottom: 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .btn-host-channel-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          background: linear-gradient(135deg, rgba(78, 222, 163, 0.2), rgba(37, 99, 235, 0.2));
          border: 1px solid var(--af-primary, #4edea3);
          color: var(--af-text-main, #f3f4f6);
          text-decoration: none;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
          transition: all 0.2s ease;
        }

        .btn-host-channel-primary:hover {
          filter: brightness(1.15);
          transform: translateY(-1px);
        }

        .host-channel-desc {
          font-size: 11px;
          color: var(--af-text-muted, #9ca3af);
        }

        .lockout-verify-box {
          width: 100%;
          max-width: 340px;
          margin-top: 10px;
          padding: 14px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid var(--af-border, rgba(255, 255, 255, 0.08));
          border-radius: 8px;
        }

        .verify-header {
          font-size: 12px;
          font-weight: 600;
          color: var(--af-text-muted, #9ca3af);
          margin-bottom: 8px;
          text-align: left;
        }

        .verify-input-group {
          display: flex;
          gap: 8px;
        }

        .access-key-input {
          flex: 1;
          padding: 8px 10px;
          border-radius: 6px;
          background: var(--af-bg-surface, #181f2a);
          border: 1px solid var(--af-border, rgba(255, 255, 255, 0.12));
          color: var(--af-text-main, #f3f4f6);
          font-size: 13px;
          outline: none;
        }

        .access-key-input:focus {
          border-color: var(--af-primary, #4edea3);
        }

        .btn-verify-access {
          padding: 8px 14px;
          border-radius: 6px;
          background: var(--af-primary, #4edea3);
          color: #0b0e14;
          font-weight: 600;
          font-size: 12px;
          border: none;
          cursor: pointer;
          white-space: nowrap;
        }

        .btn-verify-access:hover:not(:disabled) {
          filter: brightness(1.08);
        }

        .verify-feedback-msg {
          font-size: 11px;
          padding: 6px 8px;
          border-radius: 4px;
          margin-top: 8px;
          text-align: left;
        }

        .verify-feedback-msg.success {
          background: rgba(78, 222, 163, 0.15);
          color: var(--af-primary, #4edea3);
          border: 1px solid rgba(78, 222, 163, 0.3);
        }

        .verify-feedback-msg.error {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        /* 联调设置面板 (Settings) */
        .settings-card {
          background: var(--af-bg-surface, #181f2a);
          border: 1px solid var(--af-border, rgba(255, 255, 255, 0.08));
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 14px;
        }

        .settings-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .settings-card-icon {
          font-size: 16px;
        }

        .settings-card-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--af-text-main, #f3f4f6);
          flex: 1;
        }

        .settings-header-badge {
          margin-left: auto;
        }

        .settings-card-desc {
          font-size: 11px;
          line-height: 1.5;
          color: var(--af-text-muted, #9ca3af);
          margin-bottom: 10px;
        }

        .settings-form-row {
          margin-bottom: 10px;
        }

        .settings-api-base-input,
        .settings-access-key-input {
          width: 100%;
          padding: 8px 10px;
          border-radius: 6px;
          background: var(--af-bg-base, #12151c);
          border: 1px solid var(--af-border, rgba(255, 255, 255, 0.12));
          color: var(--af-text-main, #f3f4f6);
          font-size: 13px;
          outline: none;
        }

        .settings-api-base-input:focus,
        .settings-access-key-input:focus {
          border-color: var(--af-primary, #4edea3);
        }

        .settings-btn-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn-primary {
          background: var(--af-primary, #4edea3);
          color: #0b0e14;
          border: none;
          padding: 7px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: filter 0.15s ease;
        }

        .btn-primary:hover:not(:disabled) {
          filter: brightness(1.08);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-test-connection,
        .btn-deauthorize,
        .btn-host-jump {
          background: rgba(255, 255, 255, 0.08);
          color: var(--af-text-main, #f3f4f6);
          border: 1px solid var(--af-border, rgba(255, 255, 255, 0.15));
          padding: 7px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease;
        }

        .btn-test-connection:hover,
        .btn-deauthorize:hover,
        .btn-host-jump:hover {
          background: rgba(255, 255, 255, 0.14);
        }

        .settings-conn-result,
        .settings-auth-result {
          font-size: 11px;
          padding: 6px 8px;
          border-radius: 4px;
          margin-top: 8px;
        }

        .settings-conn-result.success,
        .settings-auth-result.success {
          background: rgba(78, 222, 163, 0.15);
          color: var(--af-primary, #4edea3);
          border: 1px solid rgba(78, 222, 163, 0.3);
        }

        .settings-conn-result.error,
        .settings-auth-result.error {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .settings-conn-result.info {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .settings-conn-result.warn {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .settings-auth-status-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          background: var(--af-bg-base, #12151c);
          border: 1px solid var(--af-border, rgba(255, 255, 255, 0.1));
          border-radius: 6px;
        }

        .auth-status-info {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--af-text-main, #f3f4f6);
        }
      </style>

      <!-- 悬浮触发胶囊 -->
      <div class="pill-trigger" title="点击呼出 AI Coding 反馈桥">
        <span class="pill-dot ${this.hasProcessingItems ? "pulsing" : ""}"></span>
        <span>反馈给 AI</span>
      </div>

      <!-- 弹窗遮罩 -->
      <div class="modal-backdrop ${this.isOpen ? "af-modal-open" : ""}">
        <div class="modal-container">
          <!-- 弹窗顶栏 -->
          <div class="modal-header">
            <div class="modal-title">
              <span class="pill-dot ${this.hasProcessingItems ? "pulsing" : ""}"></span>
              <span>AI Coding Feedback Bridge</span>
            </div>
            <button class="modal-close" title="关闭">&times;</button>
          </div>

          <!-- Tab 选项卡 (包含原生 Tab 与动态注册的扩展槽) -->
          <div class="tabs">
            <button class="tab-btn tab-btn-submit ${this.activeTab === "submit" ? "active" : ""}">新建反馈</button>
            <button class="tab-btn tab-btn-history ${this.activeTab === "history" ? "active" : ""}">
              历史与进度 ${this.totalTicketsCount > 0 ? `(${this.totalTicketsCount})` : ""}
            </button>
            ${hasSettings ? `<button class="tab-btn tab-btn-settings ${this.activeTab === "settings" ? "active" : ""}">⚙️ 联调设置</button>` : ""}
            ${extensions.map((ext) => `
              <button class="tab-btn tab-btn-${ext.id} ${this.activeTab === ext.id ? "active" : ""}">
                ${ext.icon ? `<span>${ext.icon}</span>` : ""}
                <span>${ext.label}</span>
                ${ext.badge !== void 0 ? `<span class="tab-badge">${ext.badge}</span>` : ""}
              </button>
            `).join("")}
          </div>

          <!-- 弹窗主体 -->
          <div class="modal-body">
            <!-- 1. 新建反馈面板 -->
            <div class="af-tab-panel af-tab-panel-submit" style="display: ${this.activeTab === "submit" ? "block" : "none"};">
              ${((_e = this.accessControlConfig) == null ? void 0 : _e.enabled) && !this.isAuthorized() ? `
                <div class="lockout-shield-container">
                  <div class="lockout-shield-icon">🛡️</div>
                  <div class="lockout-shield-title">${this.accessControlConfig.promptTitle || "受限访问保护"}</div>
                  <div class="lockout-shield-msg">${this.accessControlConfig.promptMessage || "此即时反馈通道仅对开发团队与受邀测试员开放。普通用户如遇问题或建议，欢迎前往宿主官方渠道反馈。"}</div>

                  ${((_f = this.hostChannelConfig) == null ? void 0 : _f.url) ? `
                    <div class="lockout-host-action">
                      <a href="${this.hostChannelConfig.url}" target="_blank" rel="noopener noreferrer" class="btn-host-channel-primary">
                        <span>🚀</span>
                        <span>前往 ${this.hostChannelConfig.name || "官方渠道"} 反馈 ↗</span>
                      </a>
                      ${this.hostChannelConfig.description ? `<div class="host-channel-desc">${this.hostChannelConfig.description}</div>` : ""}
                    </div>
                  ` : ""}

                  <div class="lockout-verify-box">
                    <div class="verify-header">🔐 开发者 / 测试员配对解锁</div>
                    <div class="verify-input-group">
                      <input type="password" class="access-key-input" placeholder="输入访问密钥 (Access Key)..." />
                      <button type="button" class="btn-verify-access">验证解锁</button>
                    </div>
                    <div class="verify-feedback-msg" style="display: none;"></div>
                  </div>
                </div>
              ` : `
                <!-- 遥测快照徽标预览 -->
                <div class="telemetry-bar">
                  <div class="tele-chip">📍 <strong>${telemetry.route}</strong></div>
                  <div class="tele-chip">📱 <strong>${telemetry.viewport.width}×${telemetry.viewport.height}</strong> (DPR ${telemetry.viewport.dpr})</div>
                  <div class="tele-chip">💻 <strong>${telemetry.platform.toUpperCase()}</strong></div>
                  <div class="tele-chip">📝 <strong>${logs.length}</strong> 条日志</div>
                </div>

                ${this.submitFeedbackMessage ? `<div class="alert alert-${this.submitFeedbackMessage.type}">${this.submitFeedbackMessage.text}</div>` : ""}

                <div class="form-group">
                  <label class="form-label">问题描述 / 优化建议</label>
                  <textarea
                    class="feedback-textarea"
                    placeholder="描述你在真机或浏览器中发现的问题、样式走位、交互异常或建议..."
                  >${this.feedbackContent}</textarea>
                </div>

                <!-- 截图/录屏附件 (支持多张上传，最多 6 项) -->
                <div class="screenshot-section">
                  <div class="screenshot-actions">
                    <button class="btn-secondary btn-capture-screen" ${this.attachedScreenshots.length + this.attachedMedia.length >= 6 ? "disabled" : ""}>
                      📸 截取当前界面
                    </button>
                    <label class="btn-secondary ${this.attachedScreenshots.length + this.attachedMedia.length >= 6 ? "disabled" : ""}" style="margin: 0; cursor: pointer;">
                      📁 上传截图/录屏 ${this.attachedScreenshots.length + this.attachedMedia.length > 0 ? `(${this.attachedScreenshots.length + this.attachedMedia.length}/6)` : ""}
                      <input
                        type="file"
                        accept="image/*,video/mp4,video/webm,video/quicktime"
                        multiple
                        class="screenshot-file-input"
                        style="display: none;"
                        ${this.attachedScreenshots.length + this.attachedMedia.length >= 6 ? "disabled" : ""}
                      />
                    </label>
                  </div>
                  ${this.attachedMedia.length > 0 ? `
                    <div class="attached-media-list">
                      ${this.attachedMedia.map((media, idx) => `
                        <div class="attached-media-card">
                          <div class="media-icon-box">🎬</div>
                          <div class="media-info-box">
                            <div class="media-name">${media.filename}</div>
                            <div class="media-sub">
                              ${media.size ? `${(media.size / (1024 * 1024)).toFixed(1)} MB` : ""}
                              ${media.isUploading ? `<span class="media-upload-tag" data-filename="${media.filename}">上传中 ${media.uploadProgress || 0}%</span>` : '<span class="media-ready-tag">已就绪</span>'}
                            </div>
                          </div>
                          <button class="btn-remove-media" data-index="${idx}" title="移除此附件">✕</button>
                        </div>
                      `).join("")}
                    </div>
                  ` : ""}
                  ${this.attachedScreenshots.length > 0 ? `
                    <div class="screenshot-grid">
                      ${this.attachedScreenshots.map((shot, idx) => `
                        <div class="screenshot-item">
                          <img src="${shot}" class="screenshot-img" alt="截图预览 ${idx + 1}" title="点击查看大图" />
                          <button class="btn-remove-shot" data-index="${idx}" title="移除此截图">✕</button>
                        </div>
                      `).join("")}
                    </div>
                  ` : ""}
                </div>

                <button class="btn-submit" ${this.isSubmitting ? "disabled" : ""}>
                  ${this.isSubmitting ? "正在提交..." : "🚀 提交并通知 AI Agent"}
                </button>
              `}
            </div>

            <!-- 2. 历史与进度面板 -->
            <div class="af-tab-panel af-tab-panel-history" style="display: ${this.activeTab === "history" ? "block" : "none"};">
              ${((_g = this.accessControlConfig) == null ? void 0 : _g.enabled) && !this.isAuthorized() ? `
                <div class="lockout-shield-container">
                  <div class="lockout-shield-icon">🛡️</div>
                  <div class="lockout-shield-title">${this.accessControlConfig.promptTitle || "受限访问保护"}</div>
                  <div class="lockout-shield-msg">未获得授权前，禁止查看历史工单与排查进度。请前往「⚙️ 联调设置」输入内测密钥解锁设备。</div>
                  <div style="margin-top: 14px; display: flex; justify-content: center;">
                    <button type="button" class="btn-primary btn-jump-to-settings" style="width: auto; padding: 6px 18px; font-size: 12px;">⚙️ 前往联调设置</button>
                  </div>
                </div>
              ` : `
                <div class="history-controls">
                  <span style="font-size: 12px; color: var(--af-text-muted, #9ca3af);">共 ${this.totalTicketsCount || this.historyList.length} 条记录</span>
                  <button class="btn-secondary btn-refresh-history">🔄 刷新</button>
                </div>
                <div class="timeline-view-wrapper">
                  ${this.renderTimelineView()}
                </div>
              `}
            </div>

            <!-- 3. 联调设置面板 -->
            ${hasSettings ? `
              <div class="af-tab-panel af-tab-panel-settings" style="display: ${this.activeTab === "settings" ? "block" : "none"};">
                <!-- Settings Card 1: API 服务基地址 -->
                <div class="settings-card">
                  <div class="settings-card-header">
                    <span class="settings-card-icon">🌐</span>
                    <span class="settings-card-title">API 服务基地址 (内网穿透 / 调试地址)</span>
                  </div>
                  <div class="settings-card-desc">
                    支持动态指定内网穿透公网域名 (如 cpolar / ngrok) 或局域网调试地址。修改后即时生效并持久化至本地存储。
                  </div>
                  <div class="settings-form-row">
                    <input
                      type="text"
                      class="settings-api-base-input"
                      value="${this.apiBase || ""}"
                      placeholder="例如 https://xxx.cpolar.top 或 http://192.168.1.100:5173"
                    />
                  </div>
                  <div class="settings-btn-row">
                    <button type="button" class="btn-secondary btn-test-connection">🔌 测试连通性</button>
                    <button type="button" class="btn-primary btn-save-api-base">💾 保存地址</button>
                  </div>
                  <div class="settings-conn-result" style="display: none;"></div>
                </div>

                <!-- Settings Card 2: 访问控制门禁与身份凭证 -->
                <div class="settings-card">
                  <div class="settings-card-header">
                    <span class="settings-card-icon">🔐</span>
                    <span class="settings-card-title">受限访问门禁与身份凭证</span>
                    <div class="settings-header-badge">
                      ${!((_h = this.accessControlConfig) == null ? void 0 : _h.enabled) ? '<span class="badge badge-notice"><span class="badge-dot"></span>未开启门禁</span>' : this.isAuthorized() ? '<span class="badge badge-completed"><span class="badge-dot"></span>已授权配对</span>' : '<span class="badge badge-rejected"><span class="badge-dot"></span>未授权 (受限)</span>'}
                    </div>
                  </div>
                  <div class="settings-card-desc">
                    控制移动端与外部环境的工单提交权限。未授权状态下禁止调用反馈递交接口。
                  </div>
                  ${this.isAuthorized() ? `
                    <div class="settings-auth-status-box">
                      <div class="auth-status-info">
                        <span class="auth-icon">✅</span>
                        <span class="auth-text">当前设备已授权 (凭证已加密保存)</span>
                      </div>
                      <button type="button" class="btn-secondary btn-deauthorize" style="color: #f87171;">🔓 解除授权</button>
                    </div>
                  ` : `
                    <div class="settings-form-row">
                      <input
                        type="password"
                        class="settings-access-key-input"
                        placeholder="输入配对密钥 (Access Key)..."
                      />
                    </div>
                    <div class="settings-btn-row">
                      <button type="button" class="btn-primary btn-verify-settings-key">🔐 验证并保存授权</button>
                    </div>
                    <div class="settings-auth-result" style="display: none;"></div>
                  `}
                </div>

                <!-- Settings Card 3: 宿主官方反馈渠道 -->
                ${((_i = this.hostChannelConfig) == null ? void 0 : _i.url) ? `
                  <div class="settings-card">
                    <div class="settings-card-header">
                      <span class="settings-card-icon">🚀</span>
                      <span class="settings-card-title">${this.hostChannelConfig.name || "宿主官方反馈渠道"}</span>
                    </div>
                    <div class="settings-card-desc">
                      ${this.hostChannelConfig.description || "前往宿主官方工单平台提出建议、缺陷反馈与特性诉求。"}
                    </div>
                    <div class="settings-btn-row">
                      <a href="${this.hostChannelConfig.url}" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-host-jump">
                        访问 ${this.hostChannelConfig.name || "官方渠道"} ↗
                      </a>
                    </div>
                  </div>
                ` : ""}
              </div>
            ` : ""}

            <!-- 3. 自定义扩展 Tab 面板 -->
            ${extensions.map((ext) => `
              <div
                class="af-tab-panel af-tab-panel-ext ext-tab-container"
                data-tab-id="${ext.id}"
                style="display: ${this.activeTab === ext.id ? "block" : "none"};"
              ></div>
            `).join("")}
          </div>
        </div>
        ${this.lightboxSrc ? `
          <div class="af-lightbox" title="点击任意空白处关闭">
            <div class="af-lightbox-header">
              <span class="af-lightbox-title">${this.lightboxTitle || "附件详情"}</span>
              <button class="af-lightbox-close" type="button" aria-label="关闭">&times;</button>
            </div>
            ${isVideoMedia(this.lightboxSrc) ? `<video src="${this.lightboxSrc}" class="af-lightbox-video" controls autoplay playsinline></video>` : `<img src="${this.lightboxSrc}" class="af-lightbox-img" alt="大图预览" />`}
          </div>
        ` : ""}
      </div>
    `;
  }
};
__publicField(_AgentFeedbackWidget, "globalTheme", "dark");
let AgentFeedbackWidget = _AgentFeedbackWidget;
function registerAgentFeedbackWidget() {
  if (typeof window !== "undefined" && typeof customElements !== "undefined") {
    if (!customElements.get("agent-feedback-widget")) {
      customElements.define("agent-feedback-widget", AgentFeedbackWidget);
    }
  }
}
function autoMountWidget() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  setupConsoleProxy();
  registerAgentFeedbackWidget();
  const mount = () => {
    let widget = document.querySelector("agent-feedback-widget");
    if (!widget) {
      widget = document.createElement("agent-feedback-widget");
      document.body.appendChild(widget);
    } else if (typeof widget.refreshWidget === "function") {
      widget.refreshWidget();
    }
  };
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
}
function initAgentFeedback(options = {}) {
  if (options.apiBase)
    setApiBase(options.apiBase);
  if (options.accessControl)
    setAccessControl(options.accessControl);
  if (options.hostChannel)
    setHostChannel(options.hostChannel);
  if (options.theme) {
    AgentFeedbackWidget.setTheme(options.theme);
  }
  if (options.primaryColor && typeof document !== "undefined") {
    const widgets = document.querySelectorAll("agent-feedback-widget");
    widgets.forEach((w) => {
      if (w.style) {
        w.style.setProperty("--af-primary", options.primaryColor);
      }
    });
  }
  if (typeof window !== "undefined") {
    window.__AGENT_FEEDBACK_OPTIONS__ = {
      showSettings: true,
      // 只要显式初始化或配置，默认允许展示设置
      ...window.__AGENT_FEEDBACK_OPTIONS__ || {},
      ...options
    };
  }
  autoMountWidget();
}
if (typeof window !== "undefined") {
  autoMountWidget();
}
export {
  AgentFeedbackWidget,
  authorize,
  autoMountWidget,
  captureScreenshot,
  clearRecentLogs,
  closeFeedbackModal,
  collectTelemetry,
  compressImage,
  computeSha256,
  deauthorize,
  detectPlatform,
  formatLocalDate,
  formatLocalTime,
  getAccessControl,
  getApiBase,
  getAuthHeaders,
  getHostChannel,
  getRecentLogs,
  initAgentFeedback,
  isAuthorized,
  isVideoMedia,
  openFeedbackModal,
  registerAgentFeedbackWidget,
  registerExtensionTab,
  setAccessControl,
  setApiBase,
  setHostChannel,
  setupConsoleProxy,
  syncAccessControlFromServer,
  uploadMediaInChunks
};
