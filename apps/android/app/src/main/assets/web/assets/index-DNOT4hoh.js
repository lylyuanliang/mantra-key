const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./devApkExtensionTab-DDnwAN03.js","./dist-B6armV2R.js"])))=>i.map(i=>d[i]);
(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
const scriptRel = "modulepreload";
const assetsURL = function(dep, importerUrl) {
  return new URL(dep, importerUrl).href;
};
const seen = {};
const __vitePreload = function preload(baseModule, deps, importerUrl) {
  let promise = Promise.resolve();
  if (deps && deps.length > 0) {
    const links = document.getElementsByTagName("link");
    const cspNonceMeta = document.querySelector(
      "meta[property=csp-nonce]"
    );
    const cspNonce = (cspNonceMeta == null ? void 0 : cspNonceMeta.nonce) || (cspNonceMeta == null ? void 0 : cspNonceMeta.getAttribute("nonce"));
    promise = Promise.allSettled(
      deps.map((dep) => {
        dep = assetsURL(dep, importerUrl);
        if (dep in seen) return;
        seen[dep] = true;
        const isCss = dep.endsWith(".css");
        const cssSelector = isCss ? '[rel="stylesheet"]' : "";
        const isBaseRelative = !!importerUrl;
        if (isBaseRelative) {
          for (let i = links.length - 1; i >= 0; i--) {
            const link2 = links[i];
            if (link2.href === dep && (!isCss || link2.rel === "stylesheet")) {
              return;
            }
          }
        } else if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) {
          return;
        }
        const link = document.createElement("link");
        link.rel = isCss ? "stylesheet" : scriptRel;
        if (!isCss) {
          link.as = "script";
        }
        link.crossOrigin = "";
        link.href = dep;
        if (cspNonce) {
          link.setAttribute("nonce", cspNonce);
        }
        document.head.appendChild(link);
        if (isCss) {
          return new Promise((res, rej) => {
            link.addEventListener("load", res);
            link.addEventListener(
              "error",
              () => rej(new Error(`Unable to preload CSS for ${dep}`))
            );
          });
        }
      })
    );
  }
  function handlePreloadError(err) {
    const e = new Event("vite:preloadError", {
      cancelable: true
    });
    e.payload = err;
    window.dispatchEvent(e);
    if (!e.defaultPrevented) {
      throw err;
    }
  }
  return promise.then((res) => {
    for (const item of res || []) {
      if (item.status !== "rejected") continue;
      handlePreloadError(item.reason);
    }
    return baseModule().catch(handlePreloadError);
  });
};
const acceleratorPrefix = "https://ghproxy.net/";
const version = "0.1.6.202611271527";
const defaultConfig = {
  acceleratorPrefix,
  version
};
const GITHUB_REPO = "lylyuanliang/mantra-key".trim();
const ACCELERATOR_PREFIX = defaultConfig.acceleratorPrefix.trim();
const CURRENT_APP_VERSION = defaultConfig.version.trim();
function compareVersions(current, latest) {
  if (!current || !latest) return 0;
  const clean = (v) => v.replace(/^v/i, "").trim();
  const cParts = clean(current).split(".").map((n) => parseInt(n, 10) || 0);
  const lParts = clean(latest).split(".").map((n) => parseInt(n, 10) || 0);
  const maxLen = Math.max(cParts.length, lParts.length);
  for (let i = 0; i < maxLen; i++) {
    const cVal = cParts[i] || 0;
    const lVal = lParts[i] || 0;
    if (lVal > cVal) return 1;
    if (lVal < cVal) return -1;
  }
  return 0;
}
async function fetchSha256Sums(verTag) {
  if (!verTag) return null;
  const urls = [
    `https://ghproxy.net/https://github.com/${GITHUB_REPO}/releases/download/${verTag}/SHA256SUMS.txt`,
    `https://gh-proxy.com/https://github.com/${GITHUB_REPO}/releases/download/${verTag}/SHA256SUMS.txt`,
    `https://mirror.ghproxy.com/https://github.com/${GITHUB_REPO}/releases/download/${verTag}/SHA256SUMS.txt`,
    `https://github.com/${GITHUB_REPO}/releases/download/${verTag}/SHA256SUMS.txt`
  ];
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const text = await res.text();
        const map = {};
        for (const line of text.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2) {
            const hash = parts[0].toLowerCase();
            const filename = parts[1].replace(/^\*/, "");
            map[filename] = hash;
            if (filename.includes("release")) {
              map.release = hash;
            } else if (filename.includes("debug")) {
              map.debug = hash;
            }
          }
        }
        return map;
      }
    } catch {
    }
  }
  return null;
}
async function fetchLatestRelease(isDebug = false) {
  const timestamp = Date.now();
  const savedTunnel = typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem("af_api_base") || window.localStorage.getItem("mk_debug_tunnel_url") || "" : "";
  const cleanTunnel = savedTunnel.replace(/\/+$/, "");
  const tunnelVersionUrl = cleanTunnel ? `${cleanTunnel}/version.json?t=${timestamp}` : null;
  const candidateUrls = [
    // 0. 穿透联调高速通道 (若已配置 cpolar/局域网，优先获取本机热打包版本)
    tunnelVersionUrl,
    // 1. 国内代理镜像 (实时直连 GitHub Raw，无 CDN 边缘缓存延迟)
    `https://ghproxy.net/https://raw.githubusercontent.com/${GITHUB_REPO}/main/public/version.json?t=${timestamp}`,
    `https://gh-proxy.com/https://raw.githubusercontent.com/${GITHUB_REPO}/main/public/version.json?t=${timestamp}`,
    // 2. GitHub Raw 直连
    `https://raw.githubusercontent.com/${GITHUB_REPO}/main/public/version.json?t=${timestamp}`,
    // 3. jsDelivr 全球加速 CDN
    `https://cdn.jsdelivr.net/gh/${GITHUB_REPO}@main/public/version.json?t=${timestamp}`,
    // 4. 同源静态路径
    typeof window !== "undefined" ? `/version.json?t=${timestamp}` : null
  ].filter(Boolean);
  let releaseData = null;
  for (const url of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4e3);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (json && (json.version || json.versionTag)) {
          if (!releaseData || compareVersions(releaseData.version || releaseData.versionTag, json.version || json.versionTag) > 0) {
            releaseData = json;
          }
          if (url === tunnelVersionUrl || url.includes("ghproxy.net") || url.includes("gh-proxy.com") || url.includes("raw.githubusercontent.com")) {
            break;
          }
        }
      }
    } catch {
    }
  }
  if (!releaseData || !releaseData.version && !releaseData.versionTag) {
    throw new Error("网络连接超时或无法解析最新版本信息");
  }
  const ver = releaseData.version || releaseData.versionTag.replace(/^v/i, "");
  const verTag = releaseData.versionTag || `v${ver}`;
  const rawReleaseUrl = releaseData.releaseDownloadUrl || `https://github.com/${GITHUB_REPO}/releases/download/${verTag}/mantra-key-${verTag}-release.apk`;
  const rawDebugUrl = releaseData.debugDownloadUrl || `https://github.com/${GITHUB_REPO}/releases/download/${verTag}/mantra-key-${verTag}-debug.apk`;
  const acceleratedReleaseUrl = rawReleaseUrl.startsWith("http") ? `${ACCELERATOR_PREFIX}${rawReleaseUrl}` : rawReleaseUrl;
  const acceleratedDebugUrl = rawDebugUrl.startsWith("http") ? `${ACCELERATOR_PREFIX}${rawDebugUrl}` : rawDebugUrl;
  const rawDownloadUrl = isDebug ? rawDebugUrl : rawReleaseUrl;
  const acceleratedUrl = isDebug ? acceleratedDebugUrl : acceleratedReleaseUrl;
  const assetName = isDebug ? `mantra-key-${verTag}-debug.apk` : `mantra-key-${verTag}-release.apk`;
  let releaseSha256 = "";
  let debugSha256 = "";
  try {
    const shaMap = await fetchSha256Sums(verTag);
    if (shaMap) {
      releaseSha256 = shaMap.release || shaMap[`mantra-key-${verTag}-release.apk`] || "";
      debugSha256 = shaMap.debug || shaMap[`mantra-key-${verTag}-debug.apk`] || "";
    }
  } catch {
  }
  if (!releaseSha256) {
    releaseSha256 = (releaseData.releaseSha256 || "").trim().toLowerCase();
  }
  if (!debugSha256) {
    debugSha256 = (releaseData.debugSha256 || "").trim().toLowerCase();
  }
  const activeSha256 = isDebug ? debugSha256 : releaseSha256;
  return {
    version: ver,
    versionTag: verTag,
    title: releaseData.title || `密诀 MantraKey ${verTag}`,
    changelog: releaseData.changelog || "常规功能优化与性能稳定性提升。",
    publishedAt: releaseData.publishedAt || (/* @__PURE__ */ new Date()).toLocaleDateString("zh-CN"),
    assetName,
    assetSizeText: releaseData.assetSizeText || "约 15 MB",
    downloadUrl: acceleratedUrl,
    rawDownloadUrl,
    releaseDownloadUrl: acceleratedReleaseUrl,
    debugDownloadUrl: acceleratedDebugUrl,
    rawReleaseDownloadUrl: rawReleaseUrl,
    rawDebugDownloadUrl: rawDebugUrl,
    releaseSha256,
    debugSha256,
    sha256: activeSha256,
    htmlUrl: `https://github.com/${GITHUB_REPO}/releases/tag/${verTag}`
  };
}
const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{}|;:,.<>?";
const CHARSET_STANDARD = UPPERCASE + LOWERCASE + DIGITS + SYMBOLS;
const CHARSET_ALPHANUMERIC = UPPERCASE + LOWERCASE + DIGITS;
const CHARSET_PIN = "0123456789";
const UNIVERSAL_SALT = "mantra_key_salt_universal_2026";
const RULE_PRESETS = {
  "standard-16": {
    name: "16位标准",
    length: 16,
    charset: CHARSET_STANDARD,
    description: "字母+数字+特殊符号 (16位)"
  },
  "secure-20": {
    name: "20位高强",
    length: 20,
    charset: CHARSET_STANDARD,
    description: "字母+数字+特殊符号 (20位)"
  },
  "super-32": {
    name: "32位极高安全",
    length: 32,
    charset: CHARSET_STANDARD,
    description: "特权/高密凭据 (32位)"
  },
  "alphanumeric-16": {
    name: "16位无符号",
    length: 16,
    charset: CHARSET_ALPHANUMERIC,
    description: "仅字母与数字，适配限制特殊符号的旧网站"
  },
  "pin-6": {
    name: "6位PIN",
    length: 6,
    charset: CHARSET_PIN,
    description: "纯数字 6 位 PIN 码"
  }
};
async function computeCanary(mantra) {
  if (!mantra) return "";
  const enc = new TextEncoder();
  const hashBuf = await crypto.subtle.digest("SHA-256", enc.encode(mantra));
  const hashHex = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex.slice(0, 8).toUpperCase();
}
async function deriveMasterSeed(mantra, salt = UNIVERSAL_SALT) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(mantra),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derivedBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 1e5,
      hash: "SHA-256"
    },
    keyMaterial,
    256
    // 256 bits = 32 bytes
  );
  return new Uint8Array(derivedBuffer);
}
function rejectionSampling(entropy, alphabet, targetLen) {
  if (!alphabet || targetLen <= 0 || entropy.length === 0) {
    return "";
  }
  const alphabetLen = alphabet.length;
  const limit = Math.floor(256 / alphabetLen) * alphabetLen;
  let result = "";
  let idx = 0;
  while (result.length < targetLen && idx < entropy.length) {
    const b = entropy[idx++];
    if (b < limit) {
      result += alphabet[b % alphabetLen];
    }
  }
  if (result.length < targetLen) {
    let loopIdx = 0;
    while (result.length < targetLen) {
      const b = entropy[loopIdx % entropy.length];
      loopIdx++;
      if (b < limit) {
        result += alphabet[b % alphabetLen];
      }
    }
  }
  return result;
}
async function deriveSitePassword(masterMantra, canonicalDomain, username = "", version2 = 1, preset = "standard-16") {
  if (!masterMantra.trim() || !canonicalDomain.trim()) {
    return "";
  }
  const seed = await deriveMasterSeed(masterMantra);
  const enc = new TextEncoder();
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    seed,
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );
  const infoStr = `mantra_v1:${canonicalDomain.toLowerCase().trim()}:${username.trim()}:${version2}`;
  const infoBytes = enc.encode(infoStr);
  const okmBuffer = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(),
      info: infoBytes
    },
    hkdfKey,
    512
    // 64 bytes
  );
  const okmBytes = new Uint8Array(okmBuffer);
  const rule = RULE_PRESETS[preset] || RULE_PRESETS["standard-16"];
  return rejectionSampling(okmBytes, rule.charset, rule.length);
}
const STORAGE_KEY_CONFIG = "mk_webdav_config";
const STORAGE_KEY_MANIFEST = "mk_local_manifest";
const STORAGE_KEY_SYNC_INFO = "mk_sync_status_info";
function normalizeWebDAVUrl(rawUrl) {
  if (!rawUrl) return "";
  const trimmed = rawUrl.trim();
  if (/^https?:\/\/dav\.jianguoyun\.com\/dav\/?$/i.test(trimmed)) {
    return "https://dav.jianguoyun.com/dav/mantra-key";
  }
  return trimmed;
}
function createEmptyManifest() {
  return {
    schemaVersion: 1,
    canaryHash: "",
    domains: {},
    updatedAt: Date.now()
  };
}
function getSavedWebDAVConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      const cfg = JSON.parse(raw);
      return {
        ...cfg,
        serverUrl: normalizeWebDAVUrl(cfg.serverUrl || "")
      };
    }
  } catch {
  }
  return {
    serverUrl: "",
    username: "",
    password: "",
    remoteFileName: "mantra_sync.mkey"
  };
}
function saveWebDAVConfig(config) {
  try {
    const normalized = {
      ...config,
      serverUrl: normalizeWebDAVUrl(config.serverUrl)
    };
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(normalized));
  } catch {
  }
}
function getLocalManifest() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MANIFEST);
    if (raw) return JSON.parse(raw);
  } catch {
  }
  return createEmptyManifest();
}
function saveLocalManifest(manifest) {
  try {
    localStorage.setItem(STORAGE_KEY_MANIFEST, JSON.stringify(manifest));
  } catch {
  }
}
function getSyncStatusInfo() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SYNC_INFO);
    if (raw) return JSON.parse(raw);
  } catch {
  }
  return {
    status: "idle",
    lastSyncTime: "",
    message: "尚未同步",
    syncedDomainsCount: Object.keys(getLocalManifest().domains).length
  };
}
function saveSyncStatusInfo(info) {
  try {
    localStorage.setItem(STORAGE_KEY_SYNC_INFO, JSON.stringify(info));
  } catch {
  }
}
function recordDomainRule(canonicalDomain, rulePreset, displayName = "", serviceKey) {
  const manifest = getLocalManifest();
  const domainKey = canonicalDomain.trim().toLowerCase();
  if (!domainKey) return manifest;
  const now = Date.now();
  const existing = manifest.domains[domainKey];
  manifest.domains[domainKey] = {
    canonicalDomain: domainKey,
    displayName: displayName !== "" ? displayName : (existing == null ? void 0 : existing.displayName) || domainKey,
    rulePreset: rulePreset || (existing == null ? void 0 : existing.rulePreset) || "standard-16",
    serviceKey: existing == null ? void 0 : existing.serviceKey,
    associatedDomains: existing == null ? void 0 : existing.associatedDomains,
    accounts: (existing == null ? void 0 : existing.accounts) || {},
    updatedAt: now
  };
  manifest.updatedAt = now;
  saveLocalManifest(manifest);
  return manifest;
}
function recordDomainAccount(canonicalDomain, username, version2 = 1, rulePreset, displayName = "", serviceKey, aliases) {
  const manifest = getLocalManifest();
  const domainKey = canonicalDomain.trim().toLowerCase();
  if (!domainKey) return manifest;
  const now = Date.now();
  const existing = manifest.domains[domainKey];
  const accounts = { ...(existing == null ? void 0 : existing.accounts) || {} };
  const userKey = username.trim() || "default";
  const existingAcc = accounts[userKey];
  accounts[userKey] = {
    username: username.trim(),
    version: version2 > 0 ? version2 : 1,
    serviceKey: existingAcc == null ? void 0 : existingAcc.serviceKey,
    aliases: existingAcc == null ? void 0 : existingAcc.aliases,
    updatedAt: now,
    isDeleted: false
  };
  manifest.domains[domainKey] = {
    canonicalDomain: domainKey,
    displayName: displayName !== "" ? displayName : (existing == null ? void 0 : existing.displayName) || domainKey,
    rulePreset: rulePreset || (existing == null ? void 0 : existing.rulePreset) || "standard-16",
    serviceKey: existing == null ? void 0 : existing.serviceKey,
    associatedDomains: existing == null ? void 0 : existing.associatedDomains,
    accounts,
    updatedAt: now
  };
  manifest.updatedAt = now;
  saveLocalManifest(manifest);
  return manifest;
}
function removeDomainRule(canonicalDomain) {
  const manifest = getLocalManifest();
  const domainKey = canonicalDomain.trim().toLowerCase();
  if (manifest.domains[domainKey]) {
    delete manifest.domains[domainKey];
    manifest.updatedAt = Date.now();
    saveLocalManifest(manifest);
  }
  return manifest;
}
function decodePunycodePart(input) {
  const maxInt = 2147483647;
  const base = 36;
  const tMin = 1;
  const tMax = 26;
  const skew = 38;
  const damp = 700;
  let n = 128;
  let i = 0;
  let bias = 72;
  const adapt = (delta, numPoints, firstTime) => {
    let k = 0;
    let d = firstTime ? Math.floor(delta / damp) : delta >> 1;
    d += Math.floor(d / numPoints);
    for (; d > (base - tMin) * tMax >> 1; k += base) {
      d = Math.floor(d / (base - tMin));
    }
    return Math.floor(k + (base - tMin + 1) * d / (d + skew));
  };
  const decodeDigit = (cp) => cp - 48 < 10 ? cp - 22 : cp - 65 < 26 ? cp - 65 : cp - 97 < 26 ? cp - 97 : base;
  const output = [];
  const basic = input.lastIndexOf("-");
  if (basic > 0) {
    for (let j = 0; j < basic; ++j) output.push(input.charCodeAt(j));
  }
  let index = basic > 0 ? basic + 1 : 0;
  while (index < input.length) {
    const oldi = i;
    let w = 1;
    for (let k = base; ; k += base) {
      if (index >= input.length) return input;
      const digit = decodeDigit(input.charCodeAt(index++));
      if (digit >= base) return input;
      if (digit > Math.floor((maxInt - i) / w)) return input;
      i += digit * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (digit < t) break;
      if (w > Math.floor(maxInt / (base - t))) return input;
      w *= base - t;
    }
    const out = output.length + 1;
    bias = adapt(i - oldi, out, oldi === 0);
    if (Math.floor(i / out) > maxInt - n) return input;
    n += Math.floor(i / out);
    i %= out;
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
}
function toUnicodeDomain(domain) {
  if (!domain || typeof domain !== "string") return "";
  return domain.split(".").map((part) => part.startsWith("xn--") ? decodePunycodePart(part.slice(4)) : part).join(".");
}
function normalizeAliasInput(raw) {
  if (!raw || typeof raw !== "string") return "";
  let value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).hostname;
    } catch {
      value = value.replace(/^https?:\/\//i, "");
    }
  } else {
    value = value.split("/")[0];
  }
  value = value.replace(/:\d+$/, "").trim().toLowerCase();
  if (!value || value.includes(" ")) return "";
  return toUnicodeDomain(value);
}
function getEntryAssociatedDomains(manifest, entry) {
  const selfRaw = (entry.canonicalDomain || "").trim().toLowerCase();
  const selfUnicode = toUnicodeDomain(selfRaw);
  const result = /* @__PURE__ */ new Set();
  const addIfOther = (raw) => {
    const clean = toUnicodeDomain((raw || "").trim().toLowerCase());
    if (clean && clean !== selfRaw && clean !== selfUnicode) {
      result.add(clean);
    }
  };
  if (Array.isArray(entry.associatedDomains)) {
    entry.associatedDomains.forEach(addIfOther);
  }
  const serviceKeys = /* @__PURE__ */ new Set();
  if (entry.serviceKey) serviceKeys.add(entry.serviceKey.trim().toLowerCase());
  for (const acc of Object.values(entry.accounts || {})) {
    if (acc.isDeleted) continue;
    if (acc.serviceKey) serviceKeys.add(acc.serviceKey.trim().toLowerCase());
    if (Array.isArray(acc.aliases)) {
      acc.aliases.forEach(addIfOther);
    }
  }
  if (serviceKeys.size > 0) {
    for (const [otherKey, otherEntry] of Object.entries(manifest.domains || {})) {
      if (otherKey.toLowerCase() === selfRaw) continue;
      const otherKeys = [];
      if (otherEntry.serviceKey) otherKeys.push(otherEntry.serviceKey.trim().toLowerCase());
      for (const acc of Object.values(otherEntry.accounts || {})) {
        if (!acc.isDeleted && acc.serviceKey) {
          otherKeys.push(acc.serviceKey.trim().toLowerCase());
        }
      }
      if (otherKeys.some((sk) => serviceKeys.has(sk))) {
        addIfOther(otherEntry.canonicalDomain || otherKey);
      }
    }
  }
  return Array.from(result);
}
function addManifestDomainAlias(canonicalDomain, rawAlias) {
  const manifest = getLocalManifest();
  const domainKey = canonicalDomain.trim().toLowerCase();
  const entry = manifest.domains[domainKey];
  const alias = normalizeAliasInput(rawAlias);
  if (!entry) {
    return { ok: false, message: "未找到该站点记录" };
  }
  if (!alias) {
    return { ok: false, message: "请输入有效的关联域名或通配符" };
  }
  if (alias === domainKey || alias === toUnicodeDomain(domainKey)) {
    return { ok: false, message: "无需关联当前站点自身" };
  }
  const now = Date.now();
  const assocSet = new Set(
    (entry.associatedDomains || []).map((d) => toUnicodeDomain(d.trim().toLowerCase()))
  );
  const alreadyExists = assocSet.has(alias);
  assocSet.add(alias);
  const updatedAccounts = { ...entry.accounts || {} };
  for (const [userKey, acc] of Object.entries(updatedAccounts)) {
    if (acc.isDeleted) continue;
    const accAliases = new Set(
      (acc.aliases || []).map((d) => toUnicodeDomain(d.trim().toLowerCase()))
    );
    accAliases.add(alias);
    updatedAccounts[userKey] = {
      ...acc,
      serviceKey: acc.serviceKey || entry.serviceKey || domainKey,
      aliases: Array.from(accAliases),
      updatedAt: now
    };
  }
  manifest.domains[domainKey] = {
    ...entry,
    serviceKey: entry.serviceKey || domainKey,
    associatedDomains: Array.from(assocSet),
    accounts: updatedAccounts,
    updatedAt: now
  };
  manifest.updatedAt = now;
  saveLocalManifest(manifest);
  return {
    ok: true,
    alias,
    message: alreadyExists ? `关联域名 [${alias}] 已存在` : `已添加关联域名 [${alias}]`
  };
}
function removeManifestDomainAlias(canonicalDomain, rawAlias) {
  const manifest = getLocalManifest();
  const domainKey = canonicalDomain.trim().toLowerCase();
  const domainUnicode = toUnicodeDomain(domainKey);
  const entry = manifest.domains[domainKey];
  const targetAlias = normalizeAliasInput(rawAlias);
  if (!entry || !targetAlias) return false;
  const now = Date.now();
  const isTarget = (candidate) => toUnicodeDomain(candidate.trim().toLowerCase()) === targetAlias;
  const nextAssoc = (entry.associatedDomains || []).filter((d) => !isTarget(d));
  const nextAccounts = {};
  for (const [userKey, acc] of Object.entries(entry.accounts || {})) {
    nextAccounts[userKey] = {
      ...acc,
      aliases: Array.isArray(acc.aliases) ? acc.aliases.filter((d) => !isTarget(d)) : void 0,
      updatedAt: now
    };
  }
  manifest.domains[domainKey] = {
    ...entry,
    associatedDomains: nextAssoc.length > 0 ? nextAssoc : void 0,
    accounts: nextAccounts,
    updatedAt: now
  };
  for (const [otherKey, otherEntry] of Object.entries(manifest.domains)) {
    if (otherKey.toLowerCase() === domainKey || !isTarget(otherKey)) continue;
    const cleanedOtherAssoc = (otherEntry.associatedDomains || []).filter((d) => {
      const n = toUnicodeDomain(d.trim().toLowerCase());
      return n !== domainKey && n !== domainUnicode;
    });
    const otherAccs = {};
    for (const [uKey, acc] of Object.entries(otherEntry.accounts || {})) {
      const cleanedAliases = Array.isArray(acc.aliases) ? acc.aliases.filter((d) => {
        const n = toUnicodeDomain(d.trim().toLowerCase());
        return n !== domainKey && n !== domainUnicode;
      }) : void 0;
      otherAccs[uKey] = {
        ...acc,
        aliases: cleanedAliases,
        serviceKey: acc.serviceKey === (entry.serviceKey || domainKey) ? otherKey : acc.serviceKey,
        updatedAt: now
      };
    }
    manifest.domains[otherKey] = {
      ...otherEntry,
      serviceKey: otherEntry.serviceKey === (entry.serviceKey || domainKey) ? otherKey : otherEntry.serviceKey,
      associatedDomains: cleanedOtherAssoc.length > 0 ? cleanedOtherAssoc : void 0,
      accounts: otherAccs,
      updatedAt: now
    };
  }
  manifest.updatedAt = now;
  saveLocalManifest(manifest);
  return true;
}
function isCustomDisplayName(name, canonicalDomain) {
  const trimmed = (name || "").trim();
  if (!trimmed) return false;
  const rawDom = canonicalDomain.trim().toLowerCase();
  const unicodeDom = toUnicodeDomain(rawDom).toLowerCase();
  const normalizedName = toUnicodeDomain(trimmed.toLowerCase());
  return trimmed.toLowerCase() !== rawDom && normalizedName !== unicodeDom;
}
function pickMergedDisplayName(localDomain, remoteDomain) {
  const canonical = remoteDomain.canonicalDomain || localDomain.canonicalDomain || "";
  const localCustom = isCustomDisplayName(localDomain.displayName, canonical);
  const remoteCustom = isCustomDisplayName(remoteDomain.displayName, canonical);
  if (localCustom && remoteCustom) {
    return remoteDomain.updatedAt > localDomain.updatedAt ? remoteDomain.displayName : localDomain.displayName;
  }
  if (remoteCustom) return remoteDomain.displayName;
  if (localCustom) return localDomain.displayName;
  return remoteDomain.updatedAt > localDomain.updatedAt ? remoteDomain.displayName || localDomain.displayName || canonical : localDomain.displayName || remoteDomain.displayName || canonical;
}
function mergeManifests(local, remote) {
  const merged = {
    schemaVersion: Math.max(local.schemaVersion || 1, remote.schemaVersion || 1),
    canaryHash: (remote.updatedAt > local.updatedAt ? remote.canaryHash : local.canaryHash) || local.canaryHash || remote.canaryHash,
    domains: { ...local.domains },
    updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0, Date.now())
  };
  for (const [domainKey, remoteDomain] of Object.entries(remote.domains || {})) {
    const localDomain = merged.domains[domainKey];
    if (!localDomain) {
      merged.domains[domainKey] = remoteDomain;
    } else {
      const newerDomain = remoteDomain.updatedAt > localDomain.updatedAt ? remoteDomain : localDomain;
      const combinedAccounts = { ...localDomain.accounts };
      for (const [userKey, remoteAcc] of Object.entries(remoteDomain.accounts || {})) {
        const localAcc = combinedAccounts[userKey];
        if (!localAcc) {
          combinedAccounts[userKey] = remoteAcc;
        } else {
          const mergedAliases = Array.from(/* @__PURE__ */ new Set([
            ...Array.isArray(localAcc.aliases) ? localAcc.aliases : [],
            ...Array.isArray(remoteAcc.aliases) ? remoteAcc.aliases : []
          ]));
          if (remoteAcc.version > localAcc.version || remoteAcc.version === localAcc.version && remoteAcc.updatedAt > localAcc.updatedAt) {
            combinedAccounts[userKey] = {
              ...remoteAcc,
              serviceKey: remoteAcc.serviceKey || localAcc.serviceKey,
              aliases: mergedAliases.length > 0 ? mergedAliases : void 0
            };
          } else {
            combinedAccounts[userKey] = {
              ...localAcc,
              serviceKey: localAcc.serviceKey || remoteAcc.serviceKey,
              aliases: mergedAliases.length > 0 ? mergedAliases : void 0
            };
          }
        }
      }
      const mergedAssoc = Array.from(/* @__PURE__ */ new Set([
        ...Array.isArray(localDomain.associatedDomains) ? localDomain.associatedDomains : [],
        ...Array.isArray(remoteDomain.associatedDomains) ? remoteDomain.associatedDomains : []
      ]));
      merged.domains[domainKey] = {
        canonicalDomain: newerDomain.canonicalDomain,
        displayName: pickMergedDisplayName(localDomain, remoteDomain),
        rulePreset: newerDomain.rulePreset || localDomain.rulePreset,
        serviceKey: newerDomain.serviceKey || localDomain.serviceKey,
        associatedDomains: mergedAssoc.length > 0 ? mergedAssoc : void 0,
        accounts: combinedAccounts,
        updatedAt: Math.max(localDomain.updatedAt, remoteDomain.updatedAt)
      };
    }
  }
  return merged;
}
async function packSyncEnvelope(manifest, syncPassword) {
  const enc = new TextEncoder();
  const manifestBytes = enc.encode(JSON.stringify(manifest));
  if (!syncPassword || !syncPassword.trim()) {
    const envelope2 = new Uint8Array(3 + manifestBytes.length);
    envelope2[0] = 77;
    envelope2[1] = 75;
    envelope2[2] = 0;
    envelope2.set(manifestBytes, 3);
    return envelope2;
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(syncPassword.trim()),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 1e5,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    manifestBytes
  );
  const cipherBytes = new Uint8Array(cipherBuffer);
  const envelope = new Uint8Array(3 + 16 + 12 + cipherBytes.length);
  envelope[0] = 77;
  envelope[1] = 75;
  envelope[2] = 1;
  envelope.set(salt, 3);
  envelope.set(iv, 3 + 16);
  envelope.set(cipherBytes, 3 + 16 + 12);
  return envelope;
}
async function unpackSyncEnvelope(envelope, syncPassword) {
  if (envelope.length === 0) {
    throw new Error("同步数据为空");
  }
  const dec = new TextDecoder();
  if (envelope[0] === 123 || envelope[0] === 91) {
    return {
      manifest: JSON.parse(dec.decode(envelope)),
      isEncrypted: false
    };
  }
  if (envelope.length < 3 || envelope[0] !== 77 || envelope[1] !== 75) {
    throw new Error("无效的同步信封格式魔数");
  }
  const flag = envelope[2];
  if (flag === 0) {
    const jsonStr = dec.decode(envelope.slice(3));
    return {
      manifest: JSON.parse(jsonStr),
      isEncrypted: false
    };
  }
  if (flag === 1) {
    if (!syncPassword || !syncPassword.trim()) {
      const err = new Error("检测到云端文件已启用端到端加密，请输入同步加密密码");
      err.code = "NEED_SYNC_PASSWORD";
      throw err;
    }
    if (envelope.length < 3 + 16 + 12 + 16) {
      throw new Error("加密信封数据损坏: 字节长度不足");
    }
    const salt = envelope.slice(3, 3 + 16);
    const iv = envelope.slice(3 + 16, 3 + 16 + 12);
    const cipherBytes = envelope.slice(3 + 16 + 12);
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(syncPassword.trim()),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
    const aesKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 1e5,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    try {
      const plainBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        aesKey,
        cipherBytes
      );
      return {
        manifest: JSON.parse(dec.decode(plainBuffer)),
        isEncrypted: true
      };
    } catch (e) {
      const err = new Error("同步加密密码不匹配，无法解密云端数据");
      err.code = "PASSWORD_MISMATCH";
      throw err;
    }
  }
  throw new Error(`不支持的同步信封版本: 0x${flag.toString(16)}`);
}
async function safeFetch(url, init) {
  const native = window.MantraNative || window.AlpineNative;
  if (native && typeof native.nativeHttpRequest === "function") {
    let bodyBase64 = "";
    if (init == null ? void 0 : init.body) {
      if (init.body instanceof Uint8Array || init.body instanceof ArrayBuffer) {
        const u8 = init.body instanceof Uint8Array ? init.body : new Uint8Array(init.body);
        let binary = "";
        for (let i = 0; i < u8.length; i++) {
          binary += String.fromCharCode(u8[i]);
        }
        bodyBase64 = btoa(binary);
      } else if (typeof init.body === "string") {
        bodyBase64 = btoa(unescape(encodeURIComponent(init.body)));
      }
    }
    const headersObj = {};
    if (init == null ? void 0 : init.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => {
          headersObj[k] = v;
        });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([k, v]) => {
          headersObj[k] = v;
        });
      } else {
        Object.assign(headersObj, init.headers);
      }
    }
    const reqPayload = {
      url,
      method: ((init == null ? void 0 : init.method) || "GET").toUpperCase(),
      headers: headersObj,
      bodyBase64,
      timeoutMs: 15e3
    };
    const rawResp = native.nativeHttpRequest(JSON.stringify(reqPayload));
    const parsed = JSON.parse(rawResp);
    if (parsed.status === 0 && !parsed.ok) {
      throw new TypeError(`Failed to fetch (原生网络穿透代理异常: ${parsed.error || "Connection Failed"})`);
    }
    const byteStr = parsed.bodyBase64 ? atob(parsed.bodyBase64) : "";
    const bytes = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) {
      bytes[i] = byteStr.charCodeAt(i);
    }
    return {
      status: parsed.status,
      statusText: parsed.statusText,
      ok: parsed.ok,
      headers: new Headers(parsed.headers || {}),
      arrayBuffer: async () => bytes.buffer,
      text: async () => new TextDecoder().decode(bytes),
      json: async () => JSON.parse(new TextDecoder().decode(bytes))
    };
  }
  return fetch(url, init);
}
async function testWebDAVConnection(config) {
  let url = config.serverUrl.trim().replace(/\/+$/, "");
  if (!url) return { ok: false, message: "WebDAV 服务器地址不能为空" };
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  const authHeader = "Basic " + btoa(`${config.username}:${config.password}`);
  try {
    const res = await safeFetch(url + "/", {
      method: "PROPFIND",
      headers: {
        "Authorization": authHeader,
        "Depth": "0",
        "Content-Type": "application/xml; charset=utf-8"
      },
      signal: AbortSignal.timeout(6e3)
    }).catch(async () => {
      return safeFetch(url + "/", {
        method: "GET",
        headers: { "Authorization": authHeader },
        signal: AbortSignal.timeout(6e3)
      });
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: "认证失败: 用户名或密码/应用 Token 错误" };
    }
    if (res.status >= 200 && res.status < 400 || res.status === 207) {
      return { ok: true, message: `连接成功 (HTTP ${res.status})` };
    }
    return { ok: false, message: `服务器返回状态异常: HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, message: `网络连接异常: ${(err == null ? void 0 : err.message) || "无法访问该地址，请检查网络或 CORS 跨域"}` };
  }
}
async function performWebDAVSync(config, onNeedPassword) {
  var _a, _b;
  const cfg = config || getSavedWebDAVConfig();
  let base = cfg.serverUrl.trim().replace(/\/+$/, "");
  if (!base) return { ok: false, message: "尚未配置 WebDAV 服务器地址", mergedCount: 0 };
  if (!/^https?:\/\//i.test(base)) base = "https://" + base;
  const filename = (cfg.remoteFileName || "mantra_sync.mkey").replace(/^\/+/, "");
  const remoteFileUrl = `${base}/${filename}`;
  const authHeader = "Basic " + btoa(`${cfg.username}:${cfg.password}`);
  const localManifest = getLocalManifest();
  let remoteManifest = null;
  let remoteIsEncrypted = false;
  let activeSyncPassword = cfg.syncPassword;
  try {
    const getRes = await safeFetch(remoteFileUrl, {
      method: "GET",
      headers: { "Authorization": authHeader },
      signal: AbortSignal.timeout(8e3)
    });
    if (getRes.status === 401 || getRes.status === 403) {
      return { ok: false, message: "WebDAV 认证失败，请检查用户名与应用密码", mergedCount: 0 };
    }
    if (getRes.ok) {
      const buffer = await getRes.arrayBuffer();
      if (buffer.byteLength > 0) {
        const envelopeBytes = new Uint8Array(buffer);
        try {
          const res = await unpackSyncEnvelope(envelopeBytes, activeSyncPassword);
          remoteManifest = res.manifest;
          remoteIsEncrypted = res.isEncrypted;
        } catch (unpackErr) {
          if (unpackErr.code === "NEED_SYNC_PASSWORD" && onNeedPassword) {
            const promptedPassword = await onNeedPassword();
            if (!promptedPassword || !promptedPassword.trim()) {
              return { ok: false, message: "同步已取消：云端数据已加密，需要同步密码方可合并", mergedCount: 0 };
            }
            activeSyncPassword = promptedPassword.trim();
            cfg.syncPassword = activeSyncPassword;
            saveWebDAVConfig(cfg);
            const retryRes = await unpackSyncEnvelope(envelopeBytes, activeSyncPassword);
            remoteManifest = retryRes.manifest;
            remoteIsEncrypted = retryRes.isEncrypted;
          } else {
            throw unpackErr;
          }
        }
      }
    } else if (getRes.status !== 404) {
      return { ok: false, message: `获取远程同步文件失败: HTTP ${getRes.status}`, mergedCount: 0 };
    }
  } catch (err) {
    if ((err == null ? void 0 : err.code) === "NEED_SYNC_PASSWORD" || (err == null ? void 0 : err.code) === "PASSWORD_MISMATCH" || ((_a = err == null ? void 0 : err.message) == null ? void 0 : _a.includes("加密密码"))) {
      return { ok: false, message: err.message, mergedCount: 0 };
    }
    if (!((_b = err == null ? void 0 : err.message) == null ? void 0 : _b.includes("404"))) {
      console.warn("[MantraKey Sync] 下载远程文件异常:", err);
    }
  }
  let finalManifest = localManifest;
  if (remoteManifest) {
    finalManifest = mergeManifests(localManifest, remoteManifest);
  }
  finalManifest.updatedAt = Date.now();
  saveLocalManifest(finalManifest);
  const newEnvelopeBytes = await packSyncEnvelope(finalManifest, activeSyncPassword);
  const upgradedToEncrypted = !remoteIsEncrypted && !!activeSyncPassword;
  try {
    const putRes = await safeFetch(remoteFileUrl, {
      method: "PUT",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/octet-stream"
      },
      body: newEnvelopeBytes,
      signal: AbortSignal.timeout(1e4)
    });
    if (!putRes.ok && putRes.status !== 201 && putRes.status !== 204) {
      return { ok: false, message: `回写同步信封至 WebDAV 失败: HTTP ${putRes.status}`, mergedCount: 0 };
    }
  } catch (err) {
    return { ok: false, message: `回写至 WebDAV 失败: ${(err == null ? void 0 : err.message) || "网络连接超时"}`, mergedCount: 0 };
  }
  const count = Object.keys(finalManifest.domains).length;
  const timeStr = (/* @__PURE__ */ new Date()).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const statusMsg = upgradedToEncrypted ? `同步成功并已自动安全升格为 AES-256-GCM 加密存储！合并 ${count} 个站点规则` : `同步成功！已自动合并 ${count} 个站点规则`;
  const statusInfo = {
    status: "success",
    lastSyncTime: timeStr,
    message: statusMsg,
    syncedDomainsCount: count
  };
  saveSyncStatusInfo(statusInfo);
  return {
    ok: true,
    message: statusMsg,
    mergedCount: count,
    upgradedToEncrypted
  };
}
let sessionMasterMantra = "";
let sessionMantraTimer = null;
function getSessionMasterMantra() {
  const topInput = document.getElementById("input-mantra");
  if (topInput && topInput.value.trim()) {
    sessionMasterMantra = topInput.value.trim();
  }
  return sessionMasterMantra;
}
function setSessionMasterMantra(mantra) {
  sessionMasterMantra = mantra.trim();
  const topInput = document.getElementById("input-mantra");
  if (topInput && topInput.value !== mantra) {
    topInput.value = mantra;
    const tagCanary = document.getElementById("tag-canary");
    if (tagCanary) {
      if (mantra.trim()) {
        computeCanary(mantra).then((canary) => {
          tagCanary.textContent = `校验码: ${canary}`;
        });
      } else {
        tagCanary.textContent = "校验码: --";
      }
    }
  }
  if (sessionMantraTimer) clearTimeout(sessionMantraTimer);
  if (sessionMasterMantra) {
    sessionMantraTimer = setTimeout(() => {
      var _a;
      sessionMasterMantra = "";
      if (topInput) topInput.value = "";
      showToast("⏳ 15分钟会话保护期已过，主口令已自动隐蔽");
      (_a = window.__refreshWebDAVRulesList) == null ? void 0 : _a.call(window);
    }, 15 * 60 * 1e3);
  }
}
function showToast(message, duration = 2500) {
  const existing = document.querySelector(".toast-container");
  if (existing) {
    existing.remove();
  }
  const toast = document.createElement("div");
  toast.className = "toast-container";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.25s ease";
    setTimeout(() => toast.remove(), 250);
  }, duration);
}
function mountApp() {
  const appRoot = document.getElementById("app");
  if (!appRoot || appRoot.hasAttribute("data-mounted")) return;
  appRoot.setAttribute("data-mounted", "true");
  appRoot.innerHTML = `
    <div class="mobile-container">
      <!-- 顶部品牌导航 -->
      <header class="app-header">
        <div class="brand-row">
          <div class="logo-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 14c-2.76 0-5-2.24-5-5s2.24-5 5-5c2.42 0 4.44 1.72 4.9 4h6.1l2 2-2 2h-2l-1 1-1-1h-2.1c-.46 2.28-2.48 4-4.9 4zm0-8C5.34 6 4 7.34 4 9s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
          </div>
          <div class="brand-info">
            <h1 class="brand-title">密诀</h1>
            <span class="brand-sub">零存储物理架构 · 确定性无状态密码引擎</span>
          </div>
          <span class="enclave-badge">ENCLAVE</span>
        </div>
      </header>

      <main class="app-main">
        <!-- 1. 已存站点与密码速查清单 (有记录时置顶作为一等公民核心区) -->
        <section class="card vault-card" id="card-vault-list">
          <div class="card-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="card-title">📚 已存站点与密码速查</span>
              <span class="vault-count-badge" id="count-synced-rules">0</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <button type="button" class="btn-vault-header-action btn-jump-to-create" id="btn-scroll-to-create" title="录入新站点与账号">➕ 录入新账号</button>
              <button type="button" class="btn-vault-header-action" id="btn-refresh-vault" title="刷新列表">🔄 刷新</button>
            </div>
          </div>

          <div class="vault-body">
            <!-- 实时快速搜索行 -->
            <div class="vault-search-row">
              <span class="vault-search-icon">🔍</span>
              <input
                type="text"
                id="input-vault-search"
                class="vault-search-input"
                placeholder="搜索域名、别名、用户名或规则..."
              />
              <button type="button" class="btn-clear-vault-search" id="btn-clear-vault-search" style="display: none;">✕</button>
            </div>

            <!-- 站点清单容器 (默认展开，触手可及) -->
            <div class="vault-sites-list" id="synced-rules-list">
              <!-- 动态渲染站点卡片 -->
            </div>
          </div>
        </section>

        <!-- 2. 录入新账号与确定性密码现场派生 (位于清单下方) -->
        <section class="card crypto-card" id="card-generator">
          <div class="card-header">
            <span class="card-title">➕ 录入新账号与现场派生</span>
            <span class="badge-dim">本地纯计算 · 零存储</span>
          </div>

          <div class="crypto-body">
            <!-- 目标站点/账户标识 -->
            <div class="input-group">
              <label class="input-label" for="input-domain">目标站点或服务域名 <span class="required-star">*</span></label>
              <input
                type="text"
                id="input-domain"
                class="cyber-input"
                placeholder="例如: github.com, weixin, 13800138000..."
                value=""
              />
              <div class="domain-chips">
                <span class="chip-item" data-val="github.com">GitHub</span>
                <span class="chip-item" data-val="google.com">Google</span>
                <span class="chip-item" data-val="alipay.com">支付宝</span>
                <span class="chip-item" data-val="wechat">微信</span>
                <span class="chip-item" data-val="apple.com">Apple ID</span>
              </div>
            </div>

            <!-- 别名与账号 (可选) -->
            <div class="input-row-flex">
              <div class="input-group" style="flex: 1;">
                <label class="input-label" for="input-domain-alias">站点别名/备注名 (可选)</label>
                <input
                  type="text"
                  id="input-domain-alias"
                  class="cyber-input"
                  placeholder="例如: 三毛专线、公司内部"
                  value=""
                />
              </div>
              <div class="input-group" style="flex: 1;">
                <label class="input-label" for="input-domain-user">登录账号/用户名 (可选)</label>
                <input
                  type="text"
                  id="input-domain-user"
                  class="cyber-input"
                  placeholder="例如: admin / 手机号"
                  value=""
                />
              </div>
            </div>

            <!-- 规则预设选择 -->
            <div class="input-group">
              <label class="input-label">密码规则规格</label>
              <div class="preset-selector" id="preset-selector">
                <button type="button" class="preset-btn active" data-preset="standard-16">16位标准</button>
                <button type="button" class="preset-btn" data-preset="secure-20">20位高强</button>
                <button type="button" class="preset-btn" data-preset="super-32">32位极高</button>
                <button type="button" class="preset-btn" data-preset="alphanumeric-16">无符号</button>
                <button type="button" class="preset-btn" data-preset="pin-6">6位PIN</button>
              </div>
            </div>

            <!-- 主口令输入 -->
            <div class="input-group">
              <div class="input-header">
                <label class="input-label" for="input-mantra">主口令 (Master Mantra)</label>
                <span class="canary-tag" id="tag-canary" title="金丝雀防手抖校验码">校验码: --</span>
              </div>
              <div class="input-with-action">
                <input
                  type="password"
                  id="input-mantra"
                  class="cyber-input"
                  placeholder="输入您的唯一记忆口令..."
                  autocomplete="off"
                  value=""
                />
                <button type="button" class="btn-toggle-visibility" id="btn-toggle-pwd" title="点击显示明文">🙈</button>
              </div>
            </div>

            <!-- 派生结果卡片 -->
            <div class="derived-result-box">
              <div class="derived-meta">
                <span class="derived-label">计算派生密码</span>
                <span class="derived-strength" id="text-rule-desc">字母+数字+特殊符号 (16位)</span>
              </div>
              <div class="derived-output-row">
                <span class="derived-val" id="text-derived-pwd" style="color: #64748b; font-size: 13px;">等待输入主口令与目标站点...</span>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <button type="button" class="btn-save-rule" id="btn-save-rule" title="保存此规则与账号至多端清单">
                    📌 记住账号规则
                  </button>
                  <button type="button" class="btn-copy-pwd" id="btn-copy-pwd" title="一键复制" disabled>
                    📋 复制
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 3. WebDAV 多端端到端加密同步面板 (E2EE + CRDT) -->
        <section class="card sync-card" id="card-webdav-sync">
          <div class="card-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="card-title">🌐 WebDAV 多端加密同步</span>
              <span class="sync-status-tag" id="badge-sync-status">未同步</span>
            </div>
            <button type="button" class="btn-toggle-card" id="btn-toggle-sync-config">⚙️ 配置</button>
          </div>

          <div class="sync-body">
            <!-- 同步摘要与立即同步行 -->
            <div class="sync-summary-row">
              <div class="sync-info-col">
                <span class="sync-sub-title">端到端 AES-256-GCM 密文同步</span>
                <span class="sync-last-time" id="text-sync-last-time">上次同步: 尚未同步</span>
              </div>
              <button type="button" class="btn-sync-now" id="btn-sync-now">
                🔄 立即双向同步
              </button>
            </div>

            <!-- WebDAV 配置表单 (折叠面板) -->
            <div class="sync-config-form" id="sync-config-form" style="display: none;">
              <div class="input-group">
                <label class="input-label" for="input-webdav-url">WebDAV 服务器根地址</label>
                <input
                  type="text"
                  id="input-webdav-url"
                  class="cyber-input"
                  placeholder="例如: https://dav.jianguoyun.com/dav/mantra-key"
                  value=""
                />
              </div>

              <div class="sync-form-row">
                <div class="input-group" style="flex: 1;">
                  <label class="input-label" for="input-webdav-user">用户名 / 账号</label>
                  <input
                    type="text"
                    id="input-webdav-user"
                    class="cyber-input"
                    placeholder="WebDAV 账号"
                    value=""
                  />
                </div>

                <div class="input-group" style="flex: 1;">
                  <label class="input-label" for="input-webdav-pass">应用密码 / Token</label>
                  <input
                    type="password"
                    id="input-webdav-pass"
                    class="cyber-input"
                    placeholder="应用独立密码"
                    value=""
                  />
                </div>
              </div>

              <div class="input-group">
                <label class="input-label" for="input-webdav-file">远程密文文件名</label>
                <input
                  type="text"
                  id="input-webdav-file"
                  class="cyber-input"
                  placeholder="mantra_sync.mkey"
                  value="mantra_sync.mkey"
                />
              </div>

              <div class="input-group">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label class="input-label" for="input-webdav-sync-pass">同步加密密码 (可选端到端 E2EE)</label>
                  <span style="font-size: 11px; color: var(--text-dim);">留空存明文 · 填写享金融级加密</span>
                </div>
                <div class="input-with-action">
                  <input
                    type="password"
                    id="input-webdav-sync-pass"
                    class="cyber-input"
                    placeholder="可留空，或输入独立同步密码..."
                    value=""
                  />
                  <button type="button" class="btn-toggle-visibility" id="btn-toggle-sync-pass" title="显隐密码">🙈</button>
                </div>
              </div>

              <div class="sync-actions-row">
                <button type="button" class="btn-secondary" id="btn-test-webdav">
                  ⚡ 测试连通性
                </button>
                <button type="button" class="btn-secondary" id="btn-save-webdav">
                  💾 保存配置
                </button>
              </div>

              <div class="sync-hint-box">
                💡 <strong>独立同步加密保障：</strong>支持设置独立同步加密密码。若填写，清单在本地使用 AES-256-GCM 强加密后再上传至云端；若留空，则以明文信封存储。多端支持无缝平滑自适应合并与升格。
              </div>
            </div>
          </div>
        </section>

        <!-- 2. 系统注入服务状态面板 -->
        <section class="card status-card">
          <div class="card-header">
            <span class="card-title">📱 系统注入服务状态</span>
            <button type="button" class="btn-help-guide" id="btn-open-onboarding">📖 开启指引说明</button>
          </div>

          <div class="service-item">
            <div class="service-meta">
              <div class="service-title-row">
                <span class="service-name">系统级自动填充服务 (AutofillService)</span>
                <span class="service-status-badge checking" id="badge-autofill">检测中...</span>
              </div>
              <div class="service-desc">适配标准网页与常规 App 账号密码框自动浮动建议，免切屏复制</div>
            </div>
            <button type="button" class="btn-service" id="btn-open-autofill-settings">去设置 ➔</button>
          </div>

          <div class="service-item">
            <div class="service-meta">
              <div class="service-title-row">
                <span class="service-name">辅助穿透输入法 (PenetrationIME)</span>
                <span class="service-status-badge checking" id="badge-ime">检测中...</span>
              </div>
              <div class="service-desc">100% 击穿银行、证券等金融 App 防填充与自绘安全键盘</div>
            </div>
            <button type="button" class="btn-service" id="btn-open-ime-settings">去设置 ➔</button>
          </div>
        </section>

        <!-- 3. 在线更新卡片 (GitHub Releases) -->
        <section class="card update-card" id="update-card">
          <div class="card-header">
            <span class="card-title">🚀 版本与在线更新</span>
            <span class="update-status" id="update-status-badge">就绪</span>
          </div>

          <div class="update-body">
            <div class="version-compare-row">
              <div class="ver-col">
                <span class="ver-label">当前运行版本</span>
                <span class="ver-val" id="text-current-ver">v${CURRENT_APP_VERSION}</span>
              </div>
              <div class="ver-arrow">➔</div>
              <div class="ver-col">
                <span class="ver-label">线上最新版本</span>
                <span class="ver-val" id="text-latest-ver">检测中...</span>
              </div>
            </div>

            <!-- 检测到更新时的详情区域 -->
            <div class="update-detail-box" id="update-detail-box" style="display: none;">
              <div class="release-title" id="text-release-title"></div>
              <div class="release-notes" id="text-release-notes"></div>
              <div class="download-progress-row" id="download-progress-row" style="display: none;">
                <div class="download-meta-row">
                  <span class="download-channel-badge" id="update-download-channel" style="display: none;">🌐 节点准备中</span>
                  <span class="progress-text" id="update-progress-text">0%</span>
                </div>
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill" id="update-progress-fill" style="width: 0%;"></div>
                </div>
              </div>
              <button type="button" class="btn-update-action" id="btn-action-update">
                ⚡ 立即下载并安装新版本
              </button>
            </div>

            <button type="button" class="btn-check-update" id="btn-check-update">
              🔄 检查线上更新 (GitHub Releases)
            </button>
          </div>
        </section>
      </main>

      <footer class="app-footer">
        <span>密诀 MantraKey · 移动端端侧中枢</span>
        <span>无明文存储 · 安全确定性</span>
      </footer>

      <!-- 4. 初次启动引导 / 权限配置说明模态弹窗 -->
      <div class="onboarding-overlay" id="onboarding-overlay" style="display: none;">
        <div class="onboarding-modal">
          <div class="onboarding-header">
            <div class="onboarding-title">🛡️ 密诀 Android 权限与注入配置指引</div>
            <button type="button" class="btn-close-onboarding" id="btn-close-onboarding">✕</button>
          </div>

          <div class="onboarding-content">
            <div class="guide-item">
              <div class="guide-q">Q: 为什么要开启「系统级自动填充服务」？</div>
              <div class="guide-a">
                <strong>免切屏、免复制：</strong>在任意网页或 App 账号密码框点击时，Android 系统将自动弹出密诀安全气泡，一键派生填充。<br/>
                <strong>物理级隐私安全：</strong>密诀是纯本地计算、零网络传输，不会保存您的明文密码，开启系统填充既便捷又杜绝剪贴板被其他应用窥探窃取的风险。
              </div>
              <button type="button" class="btn-guide-action" id="btn-guide-autofill">前往系统设置开启自动填充 ➔</button>
            </div>

            <div class="guide-item">
              <div class="guide-q">Q: 为什么要开启「辅助穿透输入法」？</div>
              <div class="guide-a">
                <strong>攻克银行与金融 App 防御：</strong>国内各大手机银行、证券投资、政务类 App 普遍禁用了系统自动填充，并弹出自绘防截屏键盘，导致常规密码软件全部失效。<br/>
                <strong>无坚不摧的安全注入：</strong>密诀专属辅助键盘直接将安全派生密码嵌入在键盘上层。遇到强防御 App 时，只需在输入法选择器中切换到密诀键盘，即可一键将生成的密码打穿并注入输入框！
              </div>
              <button type="button" class="btn-guide-action" id="btn-guide-ime">前往输入法设置开启穿透键盘 ➔</button>
            </div>
          </div>

          <div class="onboarding-footer">
            <button type="button" class="btn-confirm-onboarding" id="btn-confirm-onboarding">
              ✅ 我已知晓，开启安全体验
            </button>
          </div>
        </div>
      </div>

      <!-- 就地同步加密密码输入弹窗 (当检测到云端加密而本地未配置时触发) -->
      <div id="sync-pass-modal-overlay" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 10000; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
        <div style="background: #111827; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 12px; padding: 20px; width: 90%; max-width: 380px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <span style="font-size: 20px;">🔐</span>
            <h3 style="margin: 0; font-size: 16px; color: #fff; font-weight: 600;">云端数据已加密</h3>
          </div>
          <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin-bottom: 16px;">
            检测到 WebDAV 云端备份已启用端到端加密（0x01 密文信封），请输入同步加密密码以完成数据解密与双向合并：
          </p>
          <div class="input-group" style="margin-bottom: 20px;">
            <input
              type="password"
              id="modal-sync-pass-input"
              class="cyber-input"
              placeholder="输入此云端备份的同步加密密码..."
              style="width: 100%; box-sizing: border-box;"
            />
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="btn-secondary" id="btn-modal-sync-cancel" style="padding: 8px 16px; font-size: 13px;">取消</button>
            <button type="button" class="btn-primary" id="btn-modal-sync-confirm" style="padding: 8px 18px; font-size: 13px; background: linear-gradient(135deg, #10b981 0%, #00f0ff 100%); color: #0b0f17; font-weight: 600; border: none; border-radius: 6px;">确认解密并保存</button>
          </div>
        </div>
      </div>
    </div>
  `;
  setupPasswordGenerator();
  setupWebDAVSync();
  setupServiceButtons();
  setupUpdateChecker();
  checkFirstLaunchGuide();
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountApp);
} else {
  mountApp();
}
function setupPasswordGenerator() {
  var _a;
  const inputMantra = document.getElementById("input-mantra");
  const inputDomain = document.getElementById("input-domain");
  const inputDomainAlias = document.getElementById("input-domain-alias");
  const inputDomainUser = document.getElementById("input-domain-user");
  const btnTogglePwd = document.getElementById("btn-toggle-pwd");
  const tagCanary = document.getElementById("tag-canary");
  const textDerivedPwd = document.getElementById("text-derived-pwd");
  const textRuleDesc = document.getElementById("text-rule-desc");
  const btnCopyPwd = document.getElementById("btn-copy-pwd");
  const btnSaveRule = document.getElementById("btn-save-rule");
  const presetSelector = document.getElementById("preset-selector");
  const chipItems = document.querySelectorAll(".chip-item");
  let currentPreset = "standard-16";
  (_a = document.getElementById("btn-scroll-to-create")) == null ? void 0 : _a.addEventListener("click", () => {
    var _a2;
    (_a2 = document.getElementById("card-generator")) == null ? void 0 : _a2.scrollIntoView({ behavior: "smooth" });
    inputDomain == null ? void 0 : inputDomain.focus();
  });
  async function compute() {
    if (!inputDomain || !textDerivedPwd) return;
    const mantra = ((inputMantra == null ? void 0 : inputMantra.value) || getSessionMasterMantra() || "").trim();
    const domain = (inputDomain.value || "").trim();
    const user = ((inputDomainUser == null ? void 0 : inputDomainUser.value) || "").trim();
    if (tagCanary) {
      if (mantra) {
        const canary = await computeCanary(mantra);
        tagCanary.textContent = `校验码: ${canary}`;
      } else {
        tagCanary.textContent = "校验码: --";
      }
    }
    if (!mantra || !domain) {
      if (!mantra && !domain) {
        textDerivedPwd.textContent = "等待输入主口令与目标站点...";
      } else if (!mantra) {
        textDerivedPwd.textContent = "等待输入主口令...";
      } else {
        textDerivedPwd.textContent = "等待输入目标标识...";
      }
      textDerivedPwd.style.color = "#64748b";
      if (btnCopyPwd) btnCopyPwd.disabled = true;
      return;
    }
    try {
      const derived = await deriveSitePassword(mantra, domain, user, 1, currentPreset);
      textDerivedPwd.textContent = derived;
      textDerivedPwd.style.color = "#00f0ff";
      if (btnCopyPwd) btnCopyPwd.disabled = false;
    } catch (e) {
      textDerivedPwd.textContent = "派生失败: " + ((e == null ? void 0 : e.message) || "未知错误");
      textDerivedPwd.style.color = "#ef4444";
      if (btnCopyPwd) btnCopyPwd.disabled = true;
    }
  }
  inputMantra == null ? void 0 : inputMantra.addEventListener("input", () => {
    if (inputMantra.value) {
      setSessionMasterMantra(inputMantra.value);
    }
    compute();
  });
  inputDomainUser == null ? void 0 : inputDomainUser.addEventListener("input", compute);
  inputDomainAlias == null ? void 0 : inputDomainAlias.addEventListener("input", compute);
  inputDomain == null ? void 0 : inputDomain.addEventListener("input", () => {
    const dVal = (inputDomain.value || "").trim().toLowerCase();
    const manifest = getLocalManifest();
    if (dVal && manifest.domains[dVal]) {
      const savedPreset = manifest.domains[dVal].rulePreset;
      if (savedPreset && RULE_PRESETS[savedPreset] && savedPreset !== currentPreset) {
        currentPreset = savedPreset;
        presetSelector == null ? void 0 : presetSelector.querySelectorAll(".preset-btn").forEach((b) => {
          if (b.getAttribute("data-preset") === savedPreset) {
            b.classList.add("active");
          } else {
            b.classList.remove("active");
          }
        });
        if (textRuleDesc) {
          textRuleDesc.textContent = RULE_PRESETS[savedPreset].description + " (已匹配保存规则)";
        }
      }
      if (manifest.domains[dVal].displayName && inputDomainAlias && !inputDomainAlias.value) {
        inputDomainAlias.value = manifest.domains[dVal].displayName;
      }
    }
    compute();
  });
  btnTogglePwd == null ? void 0 : btnTogglePwd.addEventListener("click", () => {
    if (!inputMantra) return;
    if (inputMantra.type === "password") {
      inputMantra.type = "text";
      btnTogglePwd.textContent = "👁️";
      btnTogglePwd.title = "点击隐藏口令";
    } else {
      inputMantra.type = "password";
      btnTogglePwd.textContent = "🙈";
      btnTogglePwd.title = "点击显示明文";
    }
  });
  btnSaveRule == null ? void 0 : btnSaveRule.addEventListener("click", () => {
    var _a2;
    const dVal = ((inputDomain == null ? void 0 : inputDomain.value) || "").trim();
    if (!dVal) {
      showToast("⚠️ 请先输入目标站点或服务域名（例如 github.com）");
      inputDomain == null ? void 0 : inputDomain.focus();
      return;
    }
    const aliasVal = ((inputDomainAlias == null ? void 0 : inputDomainAlias.value) || "").trim();
    const userVal = ((inputDomainUser == null ? void 0 : inputDomainUser.value) || "").trim();
    if (userVal) {
      recordDomainAccount(dVal, userVal, 1, currentPreset, aliasVal);
    } else {
      recordDomainRule(dVal, currentPreset, aliasVal);
    }
    btnSaveRule.textContent = "✅ 已记住！";
    (_a2 = window.__refreshWebDAVRulesList) == null ? void 0 : _a2.call(window);
    showToast(`🎉 成功保存站点 [${aliasVal || dVal}] 规则！`);
    setTimeout(() => {
      var _a3;
      btnSaveRule.textContent = "📌 记住账号规则";
      (_a3 = document.getElementById("card-vault-list")) == null ? void 0 : _a3.scrollIntoView({ behavior: "smooth" });
    }, 700);
  });
  chipItems.forEach((chip) => {
    chip.addEventListener("click", () => {
      const val = chip.getAttribute("data-val");
      if (val && inputDomain) {
        inputDomain.value = val;
        const manifest = getLocalManifest();
        const dKey = val.toLowerCase();
        if (manifest.domains[dKey]) {
          const savedPreset = manifest.domains[dKey].rulePreset;
          if (savedPreset && RULE_PRESETS[savedPreset]) {
            currentPreset = savedPreset;
            presetSelector == null ? void 0 : presetSelector.querySelectorAll(".preset-btn").forEach((b) => {
              if (b.getAttribute("data-preset") === savedPreset) {
                b.classList.add("active");
              } else {
                b.classList.remove("active");
              }
            });
            if (textRuleDesc) {
              textRuleDesc.textContent = RULE_PRESETS[savedPreset].description + " (已匹配保存规则)";
            }
          }
        }
        compute();
      }
    });
  });
  presetSelector == null ? void 0 : presetSelector.addEventListener("click", (e) => {
    const target = e.target;
    const preset = target.getAttribute("data-preset");
    if (preset && RULE_PRESETS[preset]) {
      currentPreset = preset;
      presetSelector.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
      target.classList.add("active");
      if (textRuleDesc) {
        textRuleDesc.textContent = RULE_PRESETS[preset].description;
      }
      compute();
    }
  });
  btnCopyPwd == null ? void 0 : btnCopyPwd.addEventListener("click", async () => {
    const pwd = textDerivedPwd == null ? void 0 : textDerivedPwd.textContent;
    if (!pwd || pwd.includes("...") || pwd.includes("失败") || pwd.includes("等待")) {
      return;
    }
    try {
      await navigator.clipboard.writeText(pwd);
      btnCopyPwd.textContent = "✅ 已复制！";
      btnCopyPwd.classList.add("copied");
      setTimeout(() => {
        btnCopyPwd.textContent = "📋 复制";
        btnCopyPwd.classList.remove("copied");
      }, 1500);
    } catch {
      alert("已派生密码: " + pwd);
    }
  });
  compute();
}
function setupWebDAVSync() {
  const btnToggleConfig = document.getElementById("btn-toggle-sync-config");
  const syncConfigForm = document.getElementById("sync-config-form");
  const btnSyncNow = document.getElementById("btn-sync-now");
  const badgeSyncStatus = document.getElementById("badge-sync-status");
  const textSyncLastTime = document.getElementById("text-sync-last-time");
  const inputUrl = document.getElementById("input-webdav-url");
  const inputUser = document.getElementById("input-webdav-user");
  const inputPass = document.getElementById("input-webdav-pass");
  const inputFile = document.getElementById("input-webdav-file");
  const inputSyncPass = document.getElementById("input-webdav-sync-pass");
  const btnToggleSyncPass = document.getElementById("btn-toggle-sync-pass");
  const btnTest = document.getElementById("btn-test-webdav");
  const btnSave = document.getElementById("btn-save-webdav");
  const btnToggleRules = document.getElementById("btn-toggle-rules-list");
  const syncedRulesList = document.getElementById("synced-rules-list");
  const arrowRules = document.getElementById("arrow-rules-list");
  const countRulesEl = document.getElementById("count-synced-rules");
  function normalizeJianguoyunUrl(url) {
    const trimmed = (url || "").trim();
    if (/^https?:\/\/dav\.jianguoyun\.com\/dav\/?$/i.test(trimmed)) {
      return "https://dav.jianguoyun.com/dav/mantra-key";
    }
    return trimmed;
  }
  const cfg = getSavedWebDAVConfig();
  if (inputUrl) inputUrl.value = cfg.serverUrl || "https://dav.jianguoyun.com/dav/mantra-key";
  if (inputUser) inputUser.value = cfg.username || "";
  if (inputPass) inputPass.value = cfg.password || "";
  if (inputFile) inputFile.value = cfg.remoteFileName || "mantra_sync.mkey";
  if (inputSyncPass) inputSyncPass.value = cfg.syncPassword || "";
  btnToggleSyncPass == null ? void 0 : btnToggleSyncPass.addEventListener("click", () => {
    if (!inputSyncPass) return;
    const isPwd = inputSyncPass.type === "password";
    inputSyncPass.type = isPwd ? "text" : "password";
    btnToggleSyncPass.textContent = isPwd ? "👀" : "🙈";
  });
  inputUrl == null ? void 0 : inputUrl.addEventListener("blur", () => {
    if (inputUrl.value) {
      inputUrl.value = normalizeJianguoyunUrl(inputUrl.value);
    }
  });
  function refreshStatusView() {
    const info = getSyncStatusInfo();
    const manifest = getLocalManifest();
    const count = Object.keys(manifest.domains || {}).length;
    if (countRulesEl) countRulesEl.textContent = String(count);
    if (textSyncLastTime) {
      textSyncLastTime.textContent = info.lastSyncTime ? `上次同步: ${info.lastSyncTime}` : "上次同步: 尚未同步";
    }
    if (badgeSyncStatus) {
      badgeSyncStatus.className = "sync-status-tag " + (info.status || "idle");
      if (info.status === "success") {
        badgeSyncStatus.textContent = "🟢 已同步";
      } else if (info.status === "syncing") {
        badgeSyncStatus.textContent = "🔄 同步中...";
      } else if (info.status === "error") {
        badgeSyncStatus.textContent = "🔴 同步失败";
      } else {
        badgeSyncStatus.textContent = cfg.serverUrl ? "⚪ 待同步" : "⚪ 未配置";
      }
    }
  }
  const inputVaultSearch = document.getElementById("input-vault-search");
  const btnClearVaultSearch = document.getElementById("btn-clear-vault-search");
  const btnRefreshVault = document.getElementById("btn-refresh-vault");
  let vaultSearchKeyword = "";
  inputVaultSearch == null ? void 0 : inputVaultSearch.addEventListener("input", () => {
    vaultSearchKeyword = (inputVaultSearch.value || "").trim().toLowerCase();
    if (btnClearVaultSearch) {
      btnClearVaultSearch.style.display = vaultSearchKeyword ? "block" : "none";
    }
    renderRulesList();
  });
  btnClearVaultSearch == null ? void 0 : btnClearVaultSearch.addEventListener("click", () => {
    if (inputVaultSearch) inputVaultSearch.value = "";
    vaultSearchKeyword = "";
    if (btnClearVaultSearch) btnClearVaultSearch.style.display = "none";
    renderRulesList();
    inputVaultSearch == null ? void 0 : inputVaultSearch.focus();
  });
  btnRefreshVault == null ? void 0 : btnRefreshVault.addEventListener("click", () => {
    renderRulesList();
    showToast("已刷新站点清单");
  });
  function renderRulesList() {
    var _a, _b;
    if (!syncedRulesList) return;
    const manifest = getLocalManifest();
    const allDomains = manifest.domains || {};
    let domainKeys = Object.keys(allDomains);
    if (countRulesEl) {
      countRulesEl.textContent = String(domainKeys.length);
    }
    const escVaultHtml = (raw) => raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    if (vaultSearchKeyword) {
      domainKeys = domainKeys.filter((k) => {
        const item = allDomains[k];
        if (!item) return false;
        const unicodeDom = toUnicodeDomain(item.canonicalDomain).toLowerCase();
        const rawDom = (item.canonicalDomain || "").toLowerCase();
        const disp = (item.displayName || "").toLowerCase();
        const preset = (item.rulePreset || "").toLowerCase();
        const serviceKey = (item.serviceKey || "").toLowerCase();
        const accs = Object.keys(item.accounts || {}).join(" ").toLowerCase();
        const assocDomains = getEntryAssociatedDomains(manifest, item).join(" ").toLowerCase();
        return unicodeDom.includes(vaultSearchKeyword) || rawDom.includes(vaultSearchKeyword) || disp.includes(vaultSearchKeyword) || preset.includes(vaultSearchKeyword) || serviceKey.includes(vaultSearchKeyword) || accs.includes(vaultSearchKeyword) || assocDomains.includes(vaultSearchKeyword);
      });
    }
    if (domainKeys.length === 0) {
      if (vaultSearchKeyword) {
        syncedRulesList.innerHTML = `
          <div class="vault-empty-state">
            <span class="empty-icon">🔍</span>
            <div class="empty-title">未找到匹配站点</div>
            <div class="empty-text">没有与 "${escVaultHtml(vaultSearchKeyword)}" 匹配的域名或账号</div>
            <button type="button" class="btn-reset-search" id="btn-reset-search-empty">清空搜索词</button>
          </div>
        `;
        (_a = document.getElementById("btn-reset-search-empty")) == null ? void 0 : _a.addEventListener("click", () => {
          if (inputVaultSearch) inputVaultSearch.value = "";
          vaultSearchKeyword = "";
          if (btnClearVaultSearch) btnClearVaultSearch.style.display = "none";
          renderRulesList();
        });
      } else {
        syncedRulesList.innerHTML = `
          <div class="vault-empty-state">
            <span class="empty-icon">📂</span>
            <div class="empty-title">暂无已保存的站点与账号</div>
            <div class="empty-text">
              在下方录入新站点并点击「📌 记住账号规则」即可加入清单；<br/>
              或配置 WebDAV 一键双向同步即可同步全量密码库！
            </div>
            <button type="button" class="btn-quick-new-entry" id="btn-empty-create-site">➕ 立即录入新账号</button>
          </div>
        `;
        (_b = document.getElementById("btn-empty-create-site")) == null ? void 0 : _b.addEventListener("click", () => {
          var _a2;
          (_a2 = document.getElementById("card-generator")) == null ? void 0 : _a2.scrollIntoView({ behavior: "smooth" });
          const inpDom = document.getElementById("input-domain");
          inpDom == null ? void 0 : inpDom.focus();
        });
      }
      return;
    }
    syncedRulesList.innerHTML = domainKeys.sort((a, b) => {
      const itemA = allDomains[a];
      const itemB = allDomains[b];
      return (itemB.updatedAt || 0) - (itemA.updatedAt || 0);
    }).map((k) => {
      const item = allDomains[k];
      const unicodeDomain = toUnicodeDomain(item.canonicalDomain);
      const hasCustomAlias = Boolean(item.displayName && item.displayName !== item.canonicalDomain && item.displayName !== unicodeDomain);
      const displayTitle = hasCustomAlias ? item.displayName : unicodeDomain;
      const subDomainText = hasCustomAlias ? unicodeDomain : unicodeDomain !== item.canonicalDomain ? item.canonicalDomain : "";
      const presetObj = RULE_PRESETS[item.rulePreset] || RULE_PRESETS["standard-16"];
      const presetName = (presetObj == null ? void 0 : presetObj.name) || item.rulePreset;
      const assocDomains = getEntryAssociatedDomains(manifest, item);
      const accounts = Object.values(item.accounts || {}).filter((a) => !a.isDeleted);
      const safeDomainId = item.canonicalDomain.replace(/[^a-zA-Z0-9_-]/g, "_");
      const assocPillsHtml = assocDomains.map((d) => {
        const safeD = escVaultHtml(d);
        return `
            <span class="vault-assoc-pill" title="${safeD}">
              <span>${safeD}</span>
              <button type="button" class="btn-vault-remove-assoc" data-domain="${escVaultHtml(item.canonicalDomain)}" data-alias="${safeD}" title="取消关联 ${safeD}">×</button>
            </span>
          `;
      }).join("");
      const assocDrawerHtml = `
          <div class="vault-assoc-drawer${assocDomains.length === 0 ? " is-empty" : ""}" data-card-domain="${escVaultHtml(item.canonicalDomain)}">
            <div class="vault-assoc-header">
              <span class="vault-assoc-title">${assocDomains.length > 0 ? `🔗 关联网站 (${assocDomains.length})` : "🔗 关联网站：暂无"}</span>
              <button type="button" class="btn-vault-add-assoc" data-domain="${escVaultHtml(item.canonicalDomain)}">+ 添加关联</button>
            </div>
            ${assocDomains.length > 0 ? `<div class="vault-assoc-list">${assocPillsHtml}</div>` : ""}
            <div class="vault-assoc-inline" style="display: none;">
              <input type="text" class="vault-assoc-input" placeholder="输入镜像域名或 *.example.com" />
              <button type="button" class="btn-vault-assoc-confirm" data-domain="${escVaultHtml(item.canonicalDomain)}">添加</button>
              <button type="button" class="btn-vault-assoc-cancel">取消</button>
            </div>
          </div>
        `;
      let accountsHtml = "";
      if (accounts.length > 0) {
        accountsHtml = accounts.map((acc, accIdx) => {
          const accSafeId = `${safeDomainId}_acc_${accIdx}`;
          const derivationBase = acc.serviceKey || item.serviceKey || item.canonicalDomain;
          return `
              <div class="vault-account-row">
                <div class="acc-meta-left">
                  <span class="acc-user-badge">👤 ${escVaultHtml(acc.username)}</span>
                  <span class="acc-ver-badge">v${acc.version || 1}</span>
                  ${acc.serviceKey ? `<span class="acc-tag-badge">🏷️ ${escVaultHtml(acc.serviceKey)}</span>` : ""}
                </div>
                <div class="acc-actions-right">
                  <button type="button" class="btn-acc-action btn-load-to-panel" data-domain="${escVaultHtml(item.canonicalDomain)}" data-user="${escVaultHtml(acc.username)}" data-preset="${item.rulePreset}" data-name="${escVaultHtml(item.displayName || "")}" title="载入到下方表单">
                    ⚡ 载入
                  </button>
                  <button type="button" class="btn-acc-action btn-copy-site-pwd" data-domain="${escVaultHtml(item.canonicalDomain)}" data-base="${escVaultHtml(derivationBase)}" data-user="${escVaultHtml(acc.username)}" data-ver="${acc.version || 1}" data-preset="${item.rulePreset}" data-title="${escVaultHtml(displayTitle)}" data-unlock="unlock-${accSafeId}" title="直接计算并复制密码">
                    📋 复制密码
                  </button>
                  <button type="button" class="btn-acc-action btn-peek-site-pwd" data-target="peek-${accSafeId}" data-domain="${escVaultHtml(item.canonicalDomain)}" data-base="${escVaultHtml(derivationBase)}" data-user="${escVaultHtml(acc.username)}" data-ver="${acc.version || 1}" data-preset="${item.rulePreset}" data-unlock="unlock-${accSafeId}" title="查看计算密码">
                    👁️
                  </button>
                </div>
              </div>
              <!-- 专属内联主口令现场解锁条 (会话未解锁时点击复制或查看就地展开) -->
              <div class="vault-inline-unlock-row" id="unlock-${accSafeId}" style="display: none;">
                <div class="unlock-header-tip">
                  <span>🔑 输入主口令派生此记录</span>
                  <span class="unlock-canary-badge" id="canary-unlock-${accSafeId}">校验码: --</span>
                </div>
                <div class="unlock-input-wrap">
                  <input type="password" class="unlock-mantra-input cyber-input" id="input-unlock-${accSafeId}" placeholder="输入主口令..." autocomplete="off" />
                  <button type="button" class="btn-toggle-unlock-pwd" data-input="input-unlock-${accSafeId}" title="显隐">🙈</button>
                  <button type="button" class="btn-submit-unlock" data-input="input-unlock-${accSafeId}" data-domain="${escVaultHtml(item.canonicalDomain)}" data-base="${escVaultHtml(derivationBase)}" data-user="${escVaultHtml(acc.username)}" data-ver="${acc.version || 1}" data-preset="${item.rulePreset}" data-target-peek="peek-${accSafeId}" data-unlock="unlock-${accSafeId}">派生查看</button>
                  <button type="button" class="btn-submit-unlock-copy" data-input="input-unlock-${accSafeId}" data-domain="${escVaultHtml(item.canonicalDomain)}" data-base="${escVaultHtml(derivationBase)}" data-user="${escVaultHtml(acc.username)}" data-ver="${acc.version || 1}" data-preset="${item.rulePreset}" data-title="${escVaultHtml(displayTitle)}" data-unlock="unlock-${accSafeId}">派生复制</button>
                  <button type="button" class="btn-cancel-unlock" data-unlock="unlock-${accSafeId}">✕</button>
                </div>
              </div>
              <div class="vault-peek-pwd-bar" id="peek-${accSafeId}" style="display: none;">
                <span class="peek-pwd-val">••••••••••••••••</span>
                <span class="peek-pwd-timer">5秒后自动隐蔽</span>
              </div>
            `;
        }).join("");
      } else {
        const defaultSafeId = `${safeDomainId}_default`;
        const derivationBase = item.serviceKey || item.canonicalDomain;
        accountsHtml = `
            <div class="vault-account-row">
              <div class="acc-meta-left">
                <span class="acc-user-badge default-key">默认凭据 (未指定账号)</span>
              </div>
              <div class="acc-actions-right">
                <button type="button" class="btn-acc-action btn-load-to-panel" data-domain="${escVaultHtml(item.canonicalDomain)}" data-user="" data-preset="${item.rulePreset}" data-name="${escVaultHtml(item.displayName || "")}" title="载入到下方表单">
                  ⚡ 载入
                </button>
                <button type="button" class="btn-acc-action btn-copy-site-pwd" data-domain="${escVaultHtml(item.canonicalDomain)}" data-base="${escVaultHtml(derivationBase)}" data-user="" data-ver="1" data-preset="${item.rulePreset}" data-title="${escVaultHtml(displayTitle)}" data-unlock="unlock-${defaultSafeId}" title="直接计算并复制密码">
                  📋 复制密码
                </button>
                <button type="button" class="btn-acc-action btn-peek-site-pwd" data-target="peek-${defaultSafeId}" data-domain="${escVaultHtml(item.canonicalDomain)}" data-base="${escVaultHtml(derivationBase)}" data-user="" data-ver="1" data-preset="${item.rulePreset}" data-unlock="unlock-${defaultSafeId}" title="查看计算密码">
                  👁️
                </button>
              </div>
            </div>
            <!-- 专属内联主口令现场解锁条 (会话未解锁时点击复制或查看就地展开) -->
            <div class="vault-inline-unlock-row" id="unlock-${defaultSafeId}" style="display: none;">
              <div class="unlock-header-tip">
                <span>🔑 输入主口令派生此记录</span>
                <span class="unlock-canary-badge" id="canary-unlock-${defaultSafeId}">校验码: --</span>
              </div>
              <div class="unlock-input-wrap">
                <input type="password" class="unlock-mantra-input cyber-input" id="input-unlock-${defaultSafeId}" placeholder="输入主口令..." autocomplete="off" />
                <button type="button" class="btn-toggle-unlock-pwd" data-input="input-unlock-${defaultSafeId}" title="显隐">🙈</button>
                <button type="button" class="btn-submit-unlock" data-input="input-unlock-${defaultSafeId}" data-domain="${escVaultHtml(item.canonicalDomain)}" data-base="${escVaultHtml(derivationBase)}" data-user="" data-ver="1" data-preset="${item.rulePreset}" data-target-peek="peek-${defaultSafeId}" data-unlock="unlock-${defaultSafeId}">派生查看</button>
                <button type="button" class="btn-submit-unlock-copy" data-input="input-unlock-${defaultSafeId}" data-domain="${escVaultHtml(item.canonicalDomain)}" data-base="${escVaultHtml(derivationBase)}" data-user="" data-ver="1" data-preset="${item.rulePreset}" data-title="${escVaultHtml(displayTitle)}" data-unlock="unlock-${defaultSafeId}">派生复制</button>
                <button type="button" class="btn-cancel-unlock" data-unlock="unlock-${defaultSafeId}">✕</button>
              </div>
            </div>
            <div class="vault-peek-pwd-bar" id="peek-${defaultSafeId}" style="display: none;">
              <span class="peek-pwd-val">••••••••••••••••</span>
              <span class="peek-pwd-timer">5秒后自动隐蔽</span>
            </div>
          `;
      }
      return `
          <div class="vault-site-card" data-domain="${escVaultHtml(item.canonicalDomain)}">
            <div class="vault-site-header">
              <div class="vault-site-info">
                <div class="vault-site-title-row" id="title-row-${safeDomainId}">
                  <span class="vault-site-name" id="name-label-${safeDomainId}">${hasCustomAlias ? "🏷️ " : "🌐 "}${escVaultHtml(displayTitle)}</span>
                  <button type="button" class="btn-edit-alias-inline" data-domain="${escVaultHtml(item.canonicalDomain)}" data-name="${escVaultHtml(item.displayName || "")}" data-target="title-row-${safeDomainId}" title="修改站点别名/备注">✏️</button>
                </div>
                ${subDomainText ? `<span class="vault-site-sub">🌐 ${escVaultHtml(subDomainText)}</span>` : ""}
              </div>
              <div class="vault-site-meta">
                <span class="vault-preset-pill">${escVaultHtml(presetName)}</span>
                <button type="button" class="btn-del-site-rule" data-del="${escVaultHtml(item.canonicalDomain)}" data-target="del-bar-${safeDomainId}" title="从清单移除">✕</button>
              </div>
            </div>
            <!-- 删除二次确认条 (就地展开，免原生 confirm) -->
            <div class="vault-del-confirm-bar" id="del-bar-${safeDomainId}" style="display: none;">
              <span class="del-confirm-text">确定移除 [${escVaultHtml(displayTitle)}] 吗？</span>
              <div class="del-confirm-actions">
                <button type="button" class="btn-confirm-del-btn btn-do-del" data-del="${escVaultHtml(item.canonicalDomain)}" data-name="${escVaultHtml(displayTitle)}">确认移除</button>
                <button type="button" class="btn-confirm-del-btn btn-cancel-del" data-target="del-bar-${safeDomainId}">取消</button>
              </div>
            </div>
            ${assocDrawerHtml}
            <div class="vault-accounts-box">
              ${accountsHtml}
            </div>
          </div>
        `;
    }).join("");
    syncedRulesList.querySelectorAll(".btn-load-to-panel").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        var _a2;
        e.stopPropagation();
        const dom = btn.getAttribute("data-domain") || "";
        const preset = btn.getAttribute("data-preset") || "standard-16";
        const user = btn.getAttribute("data-user") || "";
        const name = btn.getAttribute("data-name") || "";
        const inpDomain = document.getElementById("input-domain");
        const inpAlias = document.getElementById("input-domain-alias");
        const inpUser = document.getElementById("input-domain-user");
        const inpMantra = document.getElementById("input-mantra");
        const presetSelector = document.getElementById("preset-selector");
        const textRuleDesc = document.getElementById("text-rule-desc");
        if (inpDomain) inpDomain.value = dom;
        if (inpAlias) inpAlias.value = name;
        if (inpUser) inpUser.value = user;
        if (RULE_PRESETS[preset]) {
          presetSelector == null ? void 0 : presetSelector.querySelectorAll(".preset-btn").forEach((b) => {
            if (b.getAttribute("data-preset") === preset) b.classList.add("active");
            else b.classList.remove("active");
          });
          if (textRuleDesc) {
            textRuleDesc.textContent = RULE_PRESETS[preset].description + " (已匹配站点规则)";
          }
        }
        inpDomain == null ? void 0 : inpDomain.dispatchEvent(new Event("input", { bubbles: true }));
        (_a2 = document.getElementById("card-generator")) == null ? void 0 : _a2.scrollIntoView({ behavior: "smooth" });
        if (!getSessionMasterMantra()) {
          inpMantra == null ? void 0 : inpMantra.focus();
          showToast(`已载入站点 [${dom}]，请输入主口令现场派生`);
        } else {
          showToast(`已载入站点 [${dom}]，密码已现场计算`);
        }
      });
    });
    syncedRulesList.querySelectorAll(".btn-copy-site-pwd").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const mantra = getSessionMasterMantra();
        const unlockId = btn.getAttribute("data-unlock") || "";
        const unlockEl = unlockId ? document.getElementById(unlockId) : null;
        const dom = btn.getAttribute("data-base") || btn.getAttribute("data-domain") || "";
        const user = btn.getAttribute("data-user") || "";
        const ver = parseInt(btn.getAttribute("data-ver") || "1", 10);
        const preset = btn.getAttribute("data-preset") || "standard-16";
        const title = btn.getAttribute("data-title") || dom;
        if (!mantra) {
          if (unlockEl) {
            unlockEl.style.display = unlockEl.style.display === "none" ? "flex" : "none";
            const inp = unlockEl.querySelector(".unlock-mantra-input");
            inp == null ? void 0 : inp.focus();
          }
          showToast("🔑 请输入主口令现场派生此记录");
          return;
        }
        try {
          const originalText = btn.textContent;
          btn.textContent = "⏳ 计算中...";
          const pwd = await deriveSitePassword(mantra, dom, user, ver, preset);
          await navigator.clipboard.writeText(pwd);
          btn.textContent = "✅ 已复制！";
          btn.classList.add("copied");
          showToast(`🎉 已成功计算并复制 [${title}${user ? ` - ${user}` : ""}] 的密码！`);
          setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove("copied");
          }, 2e3);
        } catch (err) {
          showToast(`❌ 密码计算失败: ${(err == null ? void 0 : err.message) || "未知错误"}`);
        }
      });
    });
    syncedRulesList.querySelectorAll(".btn-peek-site-pwd").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const mantra = getSessionMasterMantra();
        const unlockId = btn.getAttribute("data-unlock") || "";
        const unlockEl = unlockId ? document.getElementById(unlockId) : null;
        const dom = btn.getAttribute("data-base") || btn.getAttribute("data-domain") || "";
        const user = btn.getAttribute("data-user") || "";
        const ver = parseInt(btn.getAttribute("data-ver") || "1", 10);
        const preset = btn.getAttribute("data-preset") || "standard-16";
        const targetId = btn.getAttribute("data-target") || "";
        const targetEl = document.getElementById(targetId);
        if (!mantra) {
          if (unlockEl) {
            unlockEl.style.display = unlockEl.style.display === "none" ? "flex" : "none";
            const inp = unlockEl.querySelector(".unlock-mantra-input");
            inp == null ? void 0 : inp.focus();
          }
          showToast("🔑 请输入主口令现场派生此记录");
          return;
        }
        if (!targetEl) return;
        if (targetEl.style.display !== "none") {
          targetEl.style.display = "none";
          btn.textContent = "👁️";
          return;
        }
        try {
          const pwd = await deriveSitePassword(mantra, dom, user, ver, preset);
          const valEl = targetEl.querySelector(".peek-pwd-val");
          if (valEl) valEl.textContent = pwd;
          targetEl.style.display = "flex";
          btn.textContent = "🙈";
          let leftSec = 5;
          const timerEl = targetEl.querySelector(".peek-pwd-timer");
          const interval = setInterval(() => {
            leftSec--;
            if (timerEl) timerEl.textContent = `${leftSec}秒后自动隐蔽`;
            if (leftSec <= 0) {
              clearInterval(interval);
              targetEl.style.display = "none";
              btn.textContent = "👁️";
              if (valEl) valEl.textContent = "••••••••••••••••";
            }
          }, 1e3);
        } catch (err) {
          showToast(`❌ 密码派生异常: ${(err == null ? void 0 : err.message) || "未知错误"}`);
        }
      });
    });
    syncedRulesList.querySelectorAll(".vault-inline-unlock-row").forEach((row) => {
      const inpMantra = row.querySelector(".unlock-mantra-input");
      const canaryBadge = row.querySelector(".unlock-canary-badge");
      const btnToggle = row.querySelector(".btn-toggle-unlock-pwd");
      const btnUnlockPeek = row.querySelector(".btn-submit-unlock");
      const btnUnlockCopy = row.querySelector(".btn-submit-unlock-copy");
      const btnCancel = row.querySelector(".btn-cancel-unlock");
      inpMantra == null ? void 0 : inpMantra.addEventListener("input", async () => {
        const val = (inpMantra.value || "").trim();
        if (canaryBadge) {
          if (val) {
            const canary = await computeCanary(val);
            canaryBadge.textContent = `校验码: ${canary}`;
          } else {
            canaryBadge.textContent = "校验码: --";
          }
        }
      });
      btnToggle == null ? void 0 : btnToggle.addEventListener("click", () => {
        if (!inpMantra) return;
        const isPwd = inpMantra.type === "password";
        inpMantra.type = isPwd ? "text" : "password";
        btnToggle.textContent = isPwd ? "👁️" : "🙈";
      });
      btnCancel == null ? void 0 : btnCancel.addEventListener("click", () => {
        row.style.display = "none";
      });
      btnUnlockPeek == null ? void 0 : btnUnlockPeek.addEventListener("click", async () => {
        const val = ((inpMantra == null ? void 0 : inpMantra.value) || "").trim();
        if (!val) {
          showToast("⚠️ 请先输入您的主口令");
          inpMantra == null ? void 0 : inpMantra.focus();
          return;
        }
        setSessionMasterMantra(val);
        row.style.display = "none";
        const dom = btnUnlockPeek.getAttribute("data-base") || btnUnlockPeek.getAttribute("data-domain") || "";
        const user = btnUnlockPeek.getAttribute("data-user") || "";
        const ver = parseInt(btnUnlockPeek.getAttribute("data-ver") || "1", 10);
        const preset = btnUnlockPeek.getAttribute("data-preset") || "standard-16";
        const targetPeekId = btnUnlockPeek.getAttribute("data-target-peek") || "";
        const targetEl = document.getElementById(targetPeekId);
        if (!targetEl) return;
        try {
          const pwd = await deriveSitePassword(val, dom, user, ver, preset);
          const valEl = targetEl.querySelector(".peek-pwd-val");
          if (valEl) valEl.textContent = pwd;
          targetEl.style.display = "flex";
          let leftSec = 5;
          const timerEl = targetEl.querySelector(".peek-pwd-timer");
          const interval = setInterval(() => {
            leftSec--;
            if (timerEl) timerEl.textContent = `${leftSec}秒后自动隐蔽`;
            if (leftSec <= 0) {
              clearInterval(interval);
              targetEl.style.display = "none";
              if (valEl) valEl.textContent = "••••••••••••••••";
            }
          }, 1e3);
          showToast("✅ 会话已解锁，密码已现场派生！");
        } catch (err) {
          showToast(`❌ 密码派生异常: ${(err == null ? void 0 : err.message) || "未知错误"}`);
        }
      });
      btnUnlockCopy == null ? void 0 : btnUnlockCopy.addEventListener("click", async () => {
        const val = ((inpMantra == null ? void 0 : inpMantra.value) || "").trim();
        if (!val) {
          showToast("⚠️ 请先输入您的主口令");
          inpMantra == null ? void 0 : inpMantra.focus();
          return;
        }
        setSessionMasterMantra(val);
        row.style.display = "none";
        const dom = btnUnlockCopy.getAttribute("data-base") || btnUnlockCopy.getAttribute("data-domain") || "";
        const user = btnUnlockCopy.getAttribute("data-user") || "";
        const ver = parseInt(btnUnlockCopy.getAttribute("data-ver") || "1", 10);
        const preset = btnUnlockCopy.getAttribute("data-preset") || "standard-16";
        const title = btnUnlockCopy.getAttribute("data-title") || dom;
        try {
          const pwd = await deriveSitePassword(val, dom, user, ver, preset);
          await navigator.clipboard.writeText(pwd);
          showToast(`🎉 已成功派生并复制 [${title}${user ? ` - ${user}` : ""}] 的密码！`);
        } catch (err) {
          showToast(`❌ 密码派生异常: ${(err == null ? void 0 : err.message) || "未知错误"}`);
        }
      });
    });
    syncedRulesList.querySelectorAll(".btn-edit-alias-inline").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        var _a2, _b2, _c, _d;
        e.stopPropagation();
        const d = btn.getAttribute("data-domain") || "";
        const curName = btn.getAttribute("data-name") || "";
        const targetRowId = btn.getAttribute("data-target") || "";
        const targetRow = document.getElementById(targetRowId);
        if (!targetRow) return;
        targetRow.innerHTML = `
          <div class="inline-alias-editor">
            <input type="text" class="inline-alias-input cyber-input" id="alias-edit-${d}" value="${curName}" placeholder="设置别名 (如: 三毛专线)" autocomplete="off" />
            <button type="button" class="btn-save-inline-alias" id="btn-save-alias-${d}">保存</button>
            <button type="button" class="btn-cancel-inline-alias" id="btn-cancel-alias-${d}">取消</button>
          </div>
        `;
        const editInput = document.getElementById(`alias-edit-${d}`);
        const btnSave2 = (_b2 = (_a2 = document.getElementById(`alias-edit-${d}`)) == null ? void 0 : _a2.parentElement) == null ? void 0 : _b2.querySelector(".btn-save-inline-alias");
        const btnCancel = (_d = (_c = document.getElementById(`alias-edit-${d}`)) == null ? void 0 : _c.parentElement) == null ? void 0 : _d.querySelector(".btn-cancel-inline-alias");
        editInput == null ? void 0 : editInput.focus();
        editInput == null ? void 0 : editInput.select();
        const saveHandler = () => {
          const newAlias = ((editInput == null ? void 0 : editInput.value) || "").trim();
          const item = manifest.domains[d];
          if (item) {
            recordDomainRule(d, item.rulePreset, newAlias);
            renderRulesList();
            refreshStatusView();
            showToast(`✅ 已更新站点 [${d}] 的别名`);
          }
        };
        btnSave2 == null ? void 0 : btnSave2.addEventListener("click", (ev) => {
          ev.stopPropagation();
          saveHandler();
        });
        btnCancel == null ? void 0 : btnCancel.addEventListener("click", (ev) => {
          ev.stopPropagation();
          renderRulesList();
        });
        editInput == null ? void 0 : editInput.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            saveHandler();
          } else if (ev.key === "Escape") {
            ev.preventDefault();
            renderRulesList();
          }
        });
      });
    });
    syncedRulesList.querySelectorAll(".btn-del-site-rule").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const targetBarId = btn.getAttribute("data-target") || "";
        const targetBar = document.getElementById(targetBarId);
        if (targetBar) {
          targetBar.style.display = targetBar.style.display === "none" ? "flex" : "none";
        }
      });
    });
    syncedRulesList.querySelectorAll(".btn-do-del").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const delDomain = btn.getAttribute("data-del");
        const siteName = btn.getAttribute("data-name") || delDomain;
        if (delDomain) {
          removeDomainRule(delDomain);
          renderRulesList();
          refreshStatusView();
          showToast(`已移除站点 [${siteName}]`);
        }
      });
    });
    syncedRulesList.querySelectorAll(".btn-cancel-del").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const targetBarId = btn.getAttribute("data-target") || "";
        const targetBar = document.getElementById(targetBarId);
        if (targetBar) targetBar.style.display = "none";
      });
    });
    syncedRulesList.querySelectorAll(".vault-assoc-drawer").forEach((drawer) => {
      const domain = drawer.getAttribute("data-card-domain") || "";
      const btnAdd = drawer.querySelector(".btn-vault-add-assoc");
      const inlineBox = drawer.querySelector(".vault-assoc-inline");
      const inputEl = drawer.querySelector(".vault-assoc-input");
      const btnConfirm = drawer.querySelector(".btn-vault-assoc-confirm");
      const btnCancel = drawer.querySelector(".btn-vault-assoc-cancel");
      const submitAssocAdd = () => {
        const rawAlias = (inputEl == null ? void 0 : inputEl.value.trim()) || "";
        const res = addManifestDomainAlias(domain, rawAlias);
        if (res.ok) {
          renderRulesList();
          refreshStatusView();
          showToast(res.message || "已添加关联网站");
        } else {
          showToast(`⚠️ ${res.message || "添加失败"}`);
          inputEl == null ? void 0 : inputEl.focus();
        }
      };
      btnAdd == null ? void 0 : btnAdd.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!inlineBox) return;
        const hidden = inlineBox.style.display === "none" || !inlineBox.style.display;
        inlineBox.style.display = hidden ? "flex" : "none";
        if (hidden) inputEl == null ? void 0 : inputEl.focus();
      });
      btnCancel == null ? void 0 : btnCancel.addEventListener("click", (e) => {
        e.stopPropagation();
        if (inlineBox) inlineBox.style.display = "none";
        if (inputEl) inputEl.value = "";
      });
      btnConfirm == null ? void 0 : btnConfirm.addEventListener("click", (e) => {
        e.stopPropagation();
        submitAssocAdd();
      });
      inputEl == null ? void 0 : inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submitAssocAdd();
        } else if (e.key === "Escape") {
          e.preventDefault();
          if (inlineBox) inlineBox.style.display = "none";
        }
      });
      drawer.querySelectorAll(".btn-vault-remove-assoc").forEach((rmBtn) => {
        rmBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const alias = rmBtn.getAttribute("data-alias") || "";
          if (!alias) return;
          if (removeManifestDomainAlias(domain, alias)) {
            renderRulesList();
            refreshStatusView();
            showToast(`已取消关联 [${alias}]`);
          } else {
            showToast("取消关联失败");
          }
        });
      });
    });
  }
  window.__refreshWebDAVRulesList = () => {
    renderRulesList();
    refreshStatusView();
  };
  btnToggleConfig == null ? void 0 : btnToggleConfig.addEventListener("click", () => {
    if (!syncConfigForm) return;
    const isHidden = syncConfigForm.style.display === "none";
    syncConfigForm.style.display = isHidden ? "flex" : "none";
    if (btnToggleConfig) {
      btnToggleConfig.textContent = isHidden ? "✕ 收起" : "⚙️ 配置";
    }
  });
  btnToggleRules == null ? void 0 : btnToggleRules.addEventListener("click", () => {
    if (!syncedRulesList || !arrowRules) return;
    const isHidden = syncedRulesList.style.display === "none";
    syncedRulesList.style.display = isHidden ? "flex" : "none";
    arrowRules.textContent = isHidden ? "▲" : "▼";
  });
  btnSave == null ? void 0 : btnSave.addEventListener("click", () => {
    var _a, _b, _c, _d;
    const currentCfg = {
      serverUrl: normalizeJianguoyunUrl((inputUrl == null ? void 0 : inputUrl.value) || ""),
      username: ((_a = inputUser == null ? void 0 : inputUser.value) == null ? void 0 : _a.trim()) || "",
      password: ((_b = inputPass == null ? void 0 : inputPass.value) == null ? void 0 : _b.trim()) || "",
      remoteFileName: ((_c = inputFile == null ? void 0 : inputFile.value) == null ? void 0 : _c.trim()) || "mantra_sync.mkey",
      syncPassword: ((_d = inputSyncPass == null ? void 0 : inputSyncPass.value) == null ? void 0 : _d.trim()) || ""
    };
    saveWebDAVConfig(currentCfg);
    refreshStatusView();
    if (btnSave) {
      btnSave.textContent = "✅ 已保存配置！";
      setTimeout(() => btnSave.textContent = "💾 保存配置", 1500);
    }
  });
  btnTest == null ? void 0 : btnTest.addEventListener("click", async () => {
    var _a, _b, _c, _d, _e;
    const currentCfg = {
      serverUrl: ((_a = inputUrl == null ? void 0 : inputUrl.value) == null ? void 0 : _a.trim()) || "",
      username: ((_b = inputUser == null ? void 0 : inputUser.value) == null ? void 0 : _b.trim()) || "",
      password: ((_c = inputPass == null ? void 0 : inputPass.value) == null ? void 0 : _c.trim()) || "",
      remoteFileName: ((_d = inputFile == null ? void 0 : inputFile.value) == null ? void 0 : _d.trim()) || "mantra_sync.mkey",
      syncPassword: ((_e = inputSyncPass == null ? void 0 : inputSyncPass.value) == null ? void 0 : _e.trim()) || ""
    };
    if (btnTest) btnTest.textContent = "⏳ 正在探测...";
    try {
      const res = await testWebDAVConnection(currentCfg);
      alert(res.ok ? `✅ ${res.message}` : `❌ ${res.message}`);
    } catch (e) {
      alert(`❌ 探测异常: ${(e == null ? void 0 : e.message) || "未知错误"}`);
    } finally {
      if (btnTest) btnTest.textContent = "⚡ 测试连通性";
    }
  });
  function promptSyncPasswordModal() {
    return new Promise((resolve) => {
      const overlay = document.getElementById("sync-pass-modal-overlay");
      const input = document.getElementById("modal-sync-pass-input");
      const btnCancel = document.getElementById("btn-modal-sync-cancel");
      const btnConfirm = document.getElementById("btn-modal-sync-confirm");
      if (!overlay || !input) {
        const pass = prompt("检测到云端文件已加密，请输入同步加密密码：");
        resolve(pass || "");
        return;
      }
      input.value = "";
      overlay.style.display = "flex";
      input.focus();
      const cleanup = () => {
        overlay.style.display = "none";
        btnCancel == null ? void 0 : btnCancel.removeEventListener("click", onCancel);
        btnConfirm == null ? void 0 : btnConfirm.removeEventListener("click", onConfirm);
      };
      const onCancel = () => {
        cleanup();
        resolve("");
      };
      const onConfirm = () => {
        const val = input.value.trim();
        cleanup();
        resolve(val);
      };
      btnCancel == null ? void 0 : btnCancel.addEventListener("click", onCancel);
      btnConfirm == null ? void 0 : btnConfirm.addEventListener("click", onConfirm);
    });
  }
  btnSyncNow == null ? void 0 : btnSyncNow.addEventListener("click", async () => {
    var _a, _b, _c, _d, _e;
    const currentCfg = {
      serverUrl: ((_a = inputUrl == null ? void 0 : inputUrl.value) == null ? void 0 : _a.trim()) || "",
      username: ((_b = inputUser == null ? void 0 : inputUser.value) == null ? void 0 : _b.trim()) || "",
      password: ((_c = inputPass == null ? void 0 : inputPass.value) == null ? void 0 : _c.trim()) || "",
      remoteFileName: ((_d = inputFile == null ? void 0 : inputFile.value) == null ? void 0 : _d.trim()) || "mantra_sync.mkey",
      syncPassword: ((_e = inputSyncPass == null ? void 0 : inputSyncPass.value) == null ? void 0 : _e.trim()) || ""
    };
    if (!currentCfg.serverUrl) {
      if (syncConfigForm) syncConfigForm.style.display = "flex";
      alert("请先在「⚙️ 配置」中填入您的 WebDAV 服务器地址与账号密码");
      return;
    }
    if (badgeSyncStatus) {
      badgeSyncStatus.className = "sync-status-tag syncing";
      badgeSyncStatus.textContent = "🔄 同步中...";
    }
    if (btnSyncNow) {
      btnSyncNow.textContent = "⏳ 同步中...";
    }
    try {
      const res = await performWebDAVSync(currentCfg, promptSyncPasswordModal);
      if (res.upgradedToEncrypted && inputSyncPass) {
        inputSyncPass.value = currentCfg.syncPassword || "";
      }
      refreshStatusView();
      renderRulesList();
      alert(res.ok ? `🎉 ${res.message}` : `⚠️ 同步未完成: ${res.message}`);
    } catch (e) {
      alert(`❌ 同步发生异常: ${(e == null ? void 0 : e.message) || "未知错误"}`);
      refreshStatusView();
    } finally {
      if (btnSyncNow) btnSyncNow.textContent = "🔄 立即双向同步";
      refreshStatusView();
    }
  });
  refreshStatusView();
  renderRulesList();
}
function setupServiceButtons() {
  const btnAutofill = document.getElementById("btn-open-autofill-settings");
  const btnIme = document.getElementById("btn-open-ime-settings");
  const badgeAutofill = document.getElementById("badge-autofill");
  const badgeIme = document.getElementById("badge-ime");
  function refreshStatus() {
    const native = typeof window !== "undefined" ? window.MantraNative : null;
    if (badgeAutofill) {
      if (native == null ? void 0 : native.isAutofillEnabled) {
        const isEnabled = native.isAutofillEnabled();
        if (isEnabled) {
          badgeAutofill.textContent = "🟢 运行中";
          badgeAutofill.className = "service-status-badge active";
        } else {
          badgeAutofill.textContent = "⚠️ 未开启";
          badgeAutofill.className = "service-status-badge inactive";
        }
      } else {
        badgeAutofill.textContent = "系统管理";
        badgeAutofill.className = "service-status-badge checking";
      }
    }
    if (badgeIme) {
      if (native == null ? void 0 : native.isImeEnabled) {
        const isEnabled = native.isImeEnabled();
        if (isEnabled) {
          badgeIme.textContent = "🟢 已就绪";
          badgeIme.className = "service-status-badge active";
        } else {
          badgeIme.textContent = "⚠️ 未开启";
          badgeIme.className = "service-status-badge inactive";
        }
      } else {
        badgeIme.textContent = "系统管理";
        badgeIme.className = "service-status-badge checking";
      }
    }
  }
  if (typeof window !== "undefined") {
    window.onMantraResume = () => {
      refreshStatus();
    };
  }
  btnAutofill == null ? void 0 : btnAutofill.addEventListener("click", () => {
    var _a;
    if (typeof window !== "undefined" && ((_a = window.MantraNative) == null ? void 0 : _a.openAutofillSettings)) {
      window.MantraNative.openAutofillSettings();
    } else {
      alert("请前往 Android 系统设置 -> 辅助功能 / 自动填充服务 中启用「密诀」");
    }
  });
  btnIme == null ? void 0 : btnIme.addEventListener("click", () => {
    var _a;
    if (typeof window !== "undefined" && ((_a = window.MantraNative) == null ? void 0 : _a.openImeSettings)) {
      window.MantraNative.openImeSettings();
    } else {
      alert("请前往 Android 系统设置 -> 语言与输入法 中勾选并激活「密诀辅助键盘」");
    }
  });
  const btnOpenGuide = document.getElementById("btn-open-onboarding");
  const overlay = document.getElementById("onboarding-overlay");
  const btnCloseGuide = document.getElementById("btn-close-onboarding");
  const btnConfirmGuide = document.getElementById("btn-confirm-onboarding");
  const btnGuideAutofill = document.getElementById("btn-guide-autofill");
  const btnGuideIme = document.getElementById("btn-guide-ime");
  btnOpenGuide == null ? void 0 : btnOpenGuide.addEventListener("click", () => {
    if (overlay) overlay.style.display = "flex";
  });
  btnCloseGuide == null ? void 0 : btnCloseGuide.addEventListener("click", () => {
    if (overlay) overlay.style.display = "none";
  });
  btnConfirmGuide == null ? void 0 : btnConfirmGuide.addEventListener("click", () => {
    var _a;
    if (overlay) overlay.style.display = "none";
    localStorage.setItem("mk_onboarding_guided", "true");
    if (typeof window !== "undefined" && ((_a = window.MantraNative) == null ? void 0 : _a.setFirstLaunchCompleted)) {
      window.MantraNative.setFirstLaunchCompleted();
    }
  });
  btnGuideAutofill == null ? void 0 : btnGuideAutofill.addEventListener("click", () => {
    var _a;
    if (typeof window !== "undefined" && ((_a = window.MantraNative) == null ? void 0 : _a.openAutofillSettings)) {
      window.MantraNative.openAutofillSettings();
    }
  });
  btnGuideIme == null ? void 0 : btnGuideIme.addEventListener("click", () => {
    var _a;
    if (typeof window !== "undefined" && ((_a = window.MantraNative) == null ? void 0 : _a.openImeSettings)) {
      window.MantraNative.openImeSettings();
    }
  });
  refreshStatus();
}
function checkFirstLaunchGuide() {
  const overlay = document.getElementById("onboarding-overlay");
  if (overlay) {
    overlay.style.display = "none";
  }
}
function setupUpdateChecker() {
  const btnCheck = document.getElementById("btn-check-update");
  const textLatest = document.getElementById("text-latest-ver");
  const badgeStatus = document.getElementById("update-status-badge");
  const detailBox = document.getElementById("update-detail-box");
  const textTitle = document.getElementById("text-release-title");
  const textNotes = document.getElementById("text-release-notes");
  const btnAction = document.getElementById("btn-action-update");
  let latestRelease = null;
  let isUpdateDownloading = false;
  async function check() {
    if (!textLatest || !badgeStatus) return;
    textLatest.textContent = "检查中...";
    badgeStatus.textContent = "检测中";
    badgeStatus.className = "update-status checking";
    try {
      const isDebug = true;
      latestRelease = await fetchLatestRelease(isDebug);
      textLatest.textContent = latestRelease.versionTag;
      const cmp = compareVersions(CURRENT_APP_VERSION, latestRelease.version);
      if (cmp > 0) {
        badgeStatus.textContent = "发现新版本";
        badgeStatus.className = "update-status has-update";
        if (detailBox && textTitle && textNotes) {
          detailBox.style.display = "flex";
          textTitle.textContent = `${latestRelease.title} (${latestRelease.assetSizeText})`;
          textNotes.textContent = latestRelease.changelog;
        }
        if (btnAction && !isUpdateDownloading) {
          btnAction.style.display = "block";
        }
      } else {
        badgeStatus.textContent = "已是最新";
        badgeStatus.className = "update-status latest";
        if (detailBox) detailBox.style.display = "none";
      }
    } catch {
      textLatest.textContent = "检测超时";
      badgeStatus.textContent = "离线/超时";
      badgeStatus.className = "update-status error";
    }
  }
  btnCheck == null ? void 0 : btnCheck.addEventListener("click", check);
  setTimeout(check, 1e3);
  btnAction == null ? void 0 : btnAction.addEventListener("click", () => {
    var _a;
    if (!latestRelease) return;
    const downloadUrl = latestRelease.downloadUrl;
    if (typeof window !== "undefined" && ((_a = window.MantraNative) == null ? void 0 : _a.downloadAndInstallApk)) {
      isUpdateDownloading = true;
      btnAction.style.display = "none";
      if (btnCheck) btnCheck.style.display = "none";
      const progressRow = document.getElementById("download-progress-row");
      const progressText = document.getElementById("update-progress-text");
      const channelEl = document.getElementById("update-download-channel");
      if (progressRow) progressRow.style.display = "flex";
      if (progressText) progressText.textContent = "0% (正在连接更新节点...)";
      if (channelEl) {
        try {
          const host = new URL(downloadUrl).host;
          channelEl.textContent = `🌐 渠道: ${host}`;
          channelEl.style.display = "inline-block";
        } catch {
          channelEl.style.display = "none";
        }
      }
      window.MantraNative.downloadAndInstallApk(downloadUrl, latestRelease.versionTag, latestRelease.sha256);
      return;
    }
    window.open(downloadUrl, "_blank");
  });
  if (typeof window !== "undefined") {
    window.onMantraDownloadProgress = (data) => {
      const progressRow = document.getElementById("download-progress-row");
      const progressFill = document.getElementById("update-progress-fill");
      const progressText = document.getElementById("update-progress-text");
      const channelEl = document.getElementById("update-download-channel");
      const btnActionEl = document.getElementById("btn-action-update");
      const btnCheckEl = document.getElementById("btn-check-update");
      const status = (data == null ? void 0 : data.status) || "downloading";
      const isActive = status === "downloading" || status === "installing" || status === "permission_required";
      isUpdateDownloading = isActive;
      if (btnActionEl) {
        if (isActive) {
          btnActionEl.style.display = "none";
        } else if (status === "error") {
          btnActionEl.style.display = "block";
          btnActionEl.textContent = "🔄 重试下载并安装";
        } else if (status === "cancelled") {
          btnActionEl.style.display = "block";
          btnActionEl.textContent = "⚡ 立即下载并安装新版本";
        } else if (status === "completed") {
          btnActionEl.style.display = "block";
          btnActionEl.textContent = "⚡ 重新调起安装";
        }
      }
      if (btnCheckEl) {
        btnCheckEl.style.display = isActive ? "none" : "block";
      }
      if (channelEl && (data == null ? void 0 : data.channel)) {
        channelEl.textContent = `🌐 渠道: ${data.channel}`;
        channelEl.style.display = "inline-block";
      }
      if (progressRow && progressFill && progressText) {
        progressRow.style.display = "flex";
        const pct = Math.max(0, Math.min(100, data.percent || 0));
        progressFill.style.width = `${pct}%`;
        progressText.textContent = `${pct}% (${data.message || ""})`;
      }
    };
  }
}
{
  Promise.all([
    __vitePreload(() => import("./dist-B6armV2R.js"), true ? [] : void 0, import.meta.url),
    __vitePreload(() => import("./devApkExtensionTab-DDnwAN03.js"), true ? __vite__mapDeps([0,1]) : void 0, import.meta.url)
  ]).then(([{ initAgentFeedback, registerExtensionTab, syncAccessControlFromServer }, { devApkExtensionTab }]) => {
    initAgentFeedback({
      appName: "密诀",
      showSettings: true,
      accessControl: {
        enabled: true,
        promptTitle: "受限访问保护",
        promptMessage: "此即时反馈通道仅对开发团队与受邀测试员开放。请输入开发机配对密钥以解锁访问。"
      },
      hostChannel: {
        name: "GitHub Issues",
        url: "https://github.com/lylyuanliang/mantra-key/issues"
      }
    });
    registerExtensionTab(devApkExtensionTab);
    syncAccessControlFromServer().catch(() => {
    });
    console.log("[MantraKey Debug] Agent Feedback client & DevApk extension registered.");
  }).catch((e) => {
    console.warn("[MantraKey Debug] Failed to initialize agent feedback:", e);
  });
}
