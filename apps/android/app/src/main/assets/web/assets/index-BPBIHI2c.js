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
const acceleratorPrefix = "https://ghfast.top/";
const version = "0.1.0";
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
    `${ACCELERATOR_PREFIX}https://github.com/${GITHUB_REPO}/releases/download/${verTag}/SHA256SUMS.txt`,
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
    `https://ghfast.top/https://raw.githubusercontent.com/${GITHUB_REPO}/main/public/version.json?t=${timestamp}`,
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
          if (url === tunnelVersionUrl || url.includes("ghfast.top") || url.includes("raw.githubusercontent.com")) {
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
  let releaseSha256 = (releaseData.releaseSha256 || "").trim().toLowerCase();
  let debugSha256 = (releaseData.debugSha256 || "").trim().toLowerCase();
  if (!releaseSha256 && !debugSha256) {
    try {
      const shaMap = await fetchSha256Sums(verTag);
      if (shaMap) {
        releaseSha256 = shaMap.release || shaMap[`mantra-key-${verTag}-release.apk`] || "";
        debugSha256 = shaMap.debug || shaMap[`mantra-key-${verTag}-debug.apk`] || "";
      }
    } catch {
    }
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
    if (raw) return JSON.parse(raw);
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
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
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
function recordDomainRule(canonicalDomain, rulePreset, displayName = "") {
  const manifest = getLocalManifest();
  const domainKey = canonicalDomain.trim().toLowerCase();
  if (!domainKey) return manifest;
  const now = Date.now();
  const existing = manifest.domains[domainKey];
  manifest.domains[domainKey] = {
    canonicalDomain: domainKey,
    displayName: displayName || (existing == null ? void 0 : existing.displayName) || domainKey,
    rulePreset,
    accounts: (existing == null ? void 0 : existing.accounts) || {},
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
          if (remoteAcc.version > localAcc.version || remoteAcc.version === localAcc.version && remoteAcc.updatedAt > localAcc.updatedAt) {
            combinedAccounts[userKey] = remoteAcc;
          }
        }
      }
      merged.domains[domainKey] = {
        canonicalDomain: newerDomain.canonicalDomain,
        displayName: newerDomain.displayName || localDomain.displayName,
        rulePreset: newerDomain.rulePreset || localDomain.rulePreset,
        accounts: combinedAccounts,
        updatedAt: Math.max(localDomain.updatedAt, remoteDomain.updatedAt)
      };
    }
  }
  return merged;
}
async function packE2EEEnvelope(manifest, masterMantra) {
  const enc = new TextEncoder();
  const manifestBytes = enc.encode(JSON.stringify(manifest));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(masterMantra),
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
  const totalLength = 2 + 1 + 16 + 12 + cipherBytes.length;
  const envelope = new Uint8Array(totalLength);
  envelope[0] = 77;
  envelope[1] = 75;
  envelope[2] = 1;
  envelope.set(salt, 3);
  envelope.set(iv, 3 + 16);
  envelope.set(cipherBytes, 3 + 16 + 12);
  return envelope;
}
async function unpackE2EEEnvelope(envelope, masterMantra) {
  if (envelope.length < 3 + 16 + 12 + 16) {
    throw new Error("信封数据损坏: 字节长度不足");
  }
  if (envelope[0] !== 77 || envelope[1] !== 75) {
    throw new Error("无效的同步信封魔数 (非 MantraKey 加密文件)");
  }
  const version2 = envelope[2];
  if (version2 !== 1) {
    throw new Error(`不支持的信封版本: ${version2}`);
  }
  const salt = envelope.slice(3, 3 + 16);
  const iv = envelope.slice(3 + 16, 3 + 16 + 12);
  const cipherBytes = envelope.slice(3 + 16 + 12);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(masterMantra),
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
    const dec = new TextDecoder();
    const jsonStr = dec.decode(plainBuffer);
    return JSON.parse(jsonStr);
  } catch (err) {
    throw new Error("解密失败: 主口令可能不匹配或数据已被篡改");
  }
}
async function testWebDAVConnection(config) {
  let url = config.serverUrl.trim().replace(/\/+$/, "");
  if (!url) return { ok: false, message: "WebDAV 服务器地址不能为空" };
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  const authHeader = "Basic " + btoa(`${config.username}:${config.password}`);
  try {
    const res = await fetch(url + "/", {
      method: "PROPFIND",
      headers: {
        "Authorization": authHeader,
        "Depth": "0",
        "Content-Type": "application/xml; charset=utf-8"
      },
      signal: AbortSignal.timeout(6e3)
    }).catch(async () => {
      return fetch(url + "/", {
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
async function performWebDAVSync(masterMantra, config) {
  var _a, _b;
  if (!masterMantra || !masterMantra.trim()) {
    return { ok: false, message: "同步需要主口令作为端到端解密与加密密钥，请输入主口令", mergedCount: 0 };
  }
  const cfg = config || getSavedWebDAVConfig();
  let base = cfg.serverUrl.trim().replace(/\/+$/, "");
  if (!base) return { ok: false, message: "尚未配置 WebDAV 服务器地址", mergedCount: 0 };
  if (!/^https?:\/\//i.test(base)) base = "https://" + base;
  const filename = (cfg.remoteFileName || "mantra_sync.mkey").replace(/^\/+/, "");
  const remoteFileUrl = `${base}/${filename}`;
  const authHeader = "Basic " + btoa(`${cfg.username}:${cfg.password}`);
  const localManifest = getLocalManifest();
  let remoteManifest = null;
  try {
    const getRes = await fetch(remoteFileUrl, {
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
        remoteManifest = await unpackE2EEEnvelope(envelopeBytes, masterMantra);
      }
    } else if (getRes.status !== 404) {
      return { ok: false, message: `获取远程同步文件失败: HTTP ${getRes.status}`, mergedCount: 0 };
    }
  } catch (err) {
    if ((_a = err == null ? void 0 : err.message) == null ? void 0 : _a.includes("解密失败")) {
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
  const newEnvelopeBytes = await packE2EEEnvelope(finalManifest, masterMantra);
  try {
    const putRes = await fetch(remoteFileUrl, {
      method: "PUT",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/octet-stream"
      },
      body: newEnvelopeBytes,
      signal: AbortSignal.timeout(1e4)
    });
    if (!putRes.ok && putRes.status !== 201 && putRes.status !== 204) {
      return { ok: false, message: `回写同步密文至 WebDAV 失败: HTTP ${putRes.status}`, mergedCount: 0 };
    }
  } catch (err) {
    return { ok: false, message: `回写至 WebDAV 失败: ${(err == null ? void 0 : err.message) || "网络连接超时"}`, mergedCount: 0 };
  }
  const count = Object.keys(finalManifest.domains).length;
  const timeStr = (/* @__PURE__ */ new Date()).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const statusInfo = {
    status: "success",
    lastSyncTime: timeStr,
    message: `同步成功！已自动合并 ${count} 个站点规则`,
    syncedDomainsCount: count
  };
  saveSyncStatusInfo(statusInfo);
  return {
    ok: true,
    message: statusInfo.message,
    mergedCount: count
  };
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
        <!-- 1. 核心主要功能置顶：确定性密码现场生成与派生 -->
        <section class="card crypto-card" id="card-generator">
          <div class="card-header">
            <span class="card-title">🔑 密码生成与现场派生</span>
            <span class="badge-dim">本地纯计算 · 零存储</span>
          </div>

          <div class="crypto-body">
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

            <!-- 目标站点/账户标识 -->
            <div class="input-group">
              <label class="input-label" for="input-domain">目标站点或账号标识</label>
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

            <!-- 派生结果卡片 -->
            <div class="derived-result-box">
              <div class="derived-meta">
                <span class="derived-label">计算派生密码</span>
                <span class="derived-strength" id="text-rule-desc">字母+数字+特殊符号 (16位)</span>
              </div>
              <div class="derived-output-row">
                <span class="derived-val" id="text-derived-pwd" style="color: #64748b; font-size: 13px;">等待输入主口令与目标站点...</span>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <button type="button" class="btn-save-rule" id="btn-save-rule" title="保存此规则至多端同步清单">
                    📌 记住规则
                  </button>
                  <button type="button" class="btn-copy-pwd" id="btn-copy-pwd" title="一键复制" disabled>
                    📋 复制
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 2. WebDAV 多端端到端加密同步面板 (E2EE + CRDT) -->
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
                  placeholder="例如: https://dav.jianguoyun.com/dav/"
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

              <div class="sync-actions-row">
                <button type="button" class="btn-secondary" id="btn-test-webdav">
                  ⚡ 测试连通性
                </button>
                <button type="button" class="btn-secondary" id="btn-save-webdav">
                  💾 保存配置
                </button>
              </div>

              <div class="sync-hint-box">
                💡 <strong>零知识加密保障：</strong>同步前在本地使用您的主口令派生高强密钥，WebDAV 云端仅保存 <code>.mkey</code> 二进制密文，坚果云或 Nextcloud 管理员无法逆向出您的任何站点信息。
              </div>
            </div>

            <!-- 已同步规则清单折叠区 -->
            <div class="synced-rules-section">
              <div class="synced-rules-header" id="btn-toggle-rules-list">
                <span class="synced-rules-title">📑 已保存的站点规则清单 (<span id="count-synced-rules">0</span>)</span>
                <span class="synced-rules-arrow" id="arrow-rules-list">▼</span>
              </div>
              <div class="synced-rules-list" id="synced-rules-list" style="display: none;">
                <!-- 动态渲染站点规则项 -->
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
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill" id="update-progress-fill" style="width: 0%;"></div>
                </div>
                <div class="progress-text" id="update-progress-text">0%</div>
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
  const inputMantra = document.getElementById("input-mantra");
  const inputDomain = document.getElementById("input-domain");
  const btnTogglePwd = document.getElementById("btn-toggle-pwd");
  const tagCanary = document.getElementById("tag-canary");
  const textDerivedPwd = document.getElementById("text-derived-pwd");
  const textRuleDesc = document.getElementById("text-rule-desc");
  const btnCopyPwd = document.getElementById("btn-copy-pwd");
  const btnSaveRule = document.getElementById("btn-save-rule");
  const presetSelector = document.getElementById("preset-selector");
  const chipItems = document.querySelectorAll(".chip-item");
  let currentPreset = "standard-16";
  async function compute() {
    if (!inputMantra || !inputDomain || !textDerivedPwd) return;
    const mantra = inputMantra.value || "";
    const domain = inputDomain.value || "";
    if (tagCanary) {
      if (mantra.trim()) {
        const canary = await computeCanary(mantra);
        tagCanary.textContent = `校验码: ${canary}`;
      } else {
        tagCanary.textContent = "校验码: --";
      }
    }
    if (!mantra.trim() || !domain.trim()) {
      if (!mantra.trim() && !domain.trim()) {
        textDerivedPwd.textContent = "等待输入主口令与目标站点...";
      } else if (!mantra.trim()) {
        textDerivedPwd.textContent = "等待输入主口令...";
      } else {
        textDerivedPwd.textContent = "等待输入目标标识...";
      }
      textDerivedPwd.style.color = "#64748b";
      if (btnCopyPwd) btnCopyPwd.disabled = true;
      return;
    }
    try {
      const derived = await deriveSitePassword(mantra, domain, "", 1, currentPreset);
      textDerivedPwd.textContent = derived;
      textDerivedPwd.style.color = "#00f0ff";
      if (btnCopyPwd) btnCopyPwd.disabled = false;
    } catch (e) {
      textDerivedPwd.textContent = "派生失败: " + ((e == null ? void 0 : e.message) || "未知错误");
      textDerivedPwd.style.color = "#ef4444";
      if (btnCopyPwd) btnCopyPwd.disabled = true;
    }
  }
  inputMantra == null ? void 0 : inputMantra.addEventListener("input", compute);
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
    var _a;
    const dVal = ((inputDomain == null ? void 0 : inputDomain.value) || "").trim();
    if (!dVal) {
      alert("请先输入目标站点或账号标识（例如 github.com）");
      return;
    }
    recordDomainRule(dVal, currentPreset);
    btnSaveRule.textContent = "✅ 已记住！";
    (_a = window.__refreshWebDAVRulesList) == null ? void 0 : _a.call(window);
    setTimeout(() => {
      btnSaveRule.textContent = "📌 记住规则";
    }, 1500);
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
  const btnTest = document.getElementById("btn-test-webdav");
  const btnSave = document.getElementById("btn-save-webdav");
  const btnToggleRules = document.getElementById("btn-toggle-rules-list");
  const syncedRulesList = document.getElementById("synced-rules-list");
  const arrowRules = document.getElementById("arrow-rules-list");
  const countRulesEl = document.getElementById("count-synced-rules");
  const inputMantra = document.getElementById("input-mantra");
  const cfg = getSavedWebDAVConfig();
  if (inputUrl) inputUrl.value = cfg.serverUrl || "";
  if (inputUser) inputUser.value = cfg.username || "";
  if (inputPass) inputPass.value = cfg.password || "";
  if (inputFile) inputFile.value = cfg.remoteFileName || "mantra_sync.mkey";
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
  function renderRulesList() {
    if (!syncedRulesList) return;
    const manifest = getLocalManifest();
    const domainKeys = Object.keys(manifest.domains || {});
    if (countRulesEl) countRulesEl.textContent = String(domainKeys.length);
    if (domainKeys.length === 0) {
      syncedRulesList.innerHTML = `
        <div style="font-size: 11px; color: #64748b; text-align: center; padding: 10px 0;">
          暂无已记录站点规则。在上方计算派生密码后，点击「📌 记住规则」即可加入多端同步清单。
        </div>
      `;
      return;
    }
    syncedRulesList.innerHTML = domainKeys.sort().map((k) => {
      const item = manifest.domains[k];
      return `
          <div class="rule-item-row" data-domain="${item.canonicalDomain}">
            <div style="display: flex; align-items: center;">
              <span class="rule-item-domain">${item.canonicalDomain}</span>
              <span class="rule-item-preset">${item.rulePreset}</span>
            </div>
            <button type="button" class="btn-del-rule" data-del="${item.canonicalDomain}" title="从同步清单移除">✕</button>
          </div>
        `;
    }).join("");
    syncedRulesList.querySelectorAll(".btn-del-rule").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const delDomain = btn.getAttribute("data-del");
        if (delDomain) {
          removeDomainRule(delDomain);
          renderRulesList();
          refreshStatusView();
        }
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
      serverUrl: ((_a = inputUrl == null ? void 0 : inputUrl.value) == null ? void 0 : _a.trim()) || "",
      username: ((_b = inputUser == null ? void 0 : inputUser.value) == null ? void 0 : _b.trim()) || "",
      password: ((_c = inputPass == null ? void 0 : inputPass.value) == null ? void 0 : _c.trim()) || "",
      remoteFileName: ((_d = inputFile == null ? void 0 : inputFile.value) == null ? void 0 : _d.trim()) || "mantra_sync.mkey"
    };
    saveWebDAVConfig(currentCfg);
    refreshStatusView();
    if (btnSave) {
      btnSave.textContent = "✅ 已保存配置！";
      setTimeout(() => btnSave.textContent = "💾 保存配置", 1500);
    }
  });
  btnTest == null ? void 0 : btnTest.addEventListener("click", async () => {
    var _a, _b, _c, _d;
    const currentCfg = {
      serverUrl: ((_a = inputUrl == null ? void 0 : inputUrl.value) == null ? void 0 : _a.trim()) || "",
      username: ((_b = inputUser == null ? void 0 : inputUser.value) == null ? void 0 : _b.trim()) || "",
      password: ((_c = inputPass == null ? void 0 : inputPass.value) == null ? void 0 : _c.trim()) || "",
      remoteFileName: ((_d = inputFile == null ? void 0 : inputFile.value) == null ? void 0 : _d.trim()) || "mantra_sync.mkey"
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
  btnSyncNow == null ? void 0 : btnSyncNow.addEventListener("click", async () => {
    var _a, _b, _c, _d, _e;
    const mantra = (_a = inputMantra == null ? void 0 : inputMantra.value) == null ? void 0 : _a.trim();
    if (!mantra) {
      alert("同步安全约束：多端同步前需要在本地通过主口令进行端到端加密与解密，请先在上方输入您的主口令！");
      inputMantra == null ? void 0 : inputMantra.focus();
      return;
    }
    const currentCfg = {
      serverUrl: ((_b = inputUrl == null ? void 0 : inputUrl.value) == null ? void 0 : _b.trim()) || "",
      username: ((_c = inputUser == null ? void 0 : inputUser.value) == null ? void 0 : _c.trim()) || "",
      password: ((_d = inputPass == null ? void 0 : inputPass.value) == null ? void 0 : _d.trim()) || "",
      remoteFileName: ((_e = inputFile == null ? void 0 : inputFile.value) == null ? void 0 : _e.trim()) || "mantra_sync.mkey"
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
      const res = await performWebDAVSync(mantra, currentCfg);
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
  const native = typeof window !== "undefined" ? window.MantraNative : null;
  const isFirst = (native == null ? void 0 : native.isFirstLaunch) ? native.isFirstLaunch() : !localStorage.getItem("mk_onboarding_guided");
  if (isFirst && !localStorage.getItem("mk_onboarding_guided")) {
    setTimeout(() => {
      const overlay = document.getElementById("onboarding-overlay");
      if (overlay) overlay.style.display = "flex";
    }, 600);
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
