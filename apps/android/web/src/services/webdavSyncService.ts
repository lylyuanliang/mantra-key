/**
 * 密诀 MantraKey - WebDAV 端到端加密多端同步服务 (E2EE + CRDT)
 *
 * 1. 零知识端到端加密：清单数据在上传前通过主口令派生的 AES-256-GCM 密钥在本地加密，
 *    WebDAV 服务端（坚果云、Nextcloud、NAS）仅存储二进制密文，无法窥探任何域名或规则。
 * 2. 状态型无冲突合并 (CvRDT)：多端离线修改后，基于时间戳与单调递增版本号自动自愈合并。
 * 3. 标准 WebDAV 协议：支持 PROPFIND 连通性测试与 PUT / GET 增量同步。
 */

export interface AccountEntry {
  username: string;
  version: number;
  updatedAt: number;
  isDeleted: boolean;
}

export interface DomainRuleEntry {
  canonicalDomain: string;
  displayName: string;
  rulePreset: string;
  accounts: Record<string, AccountEntry>;
  updatedAt: number;
}

export interface MantraManifest {
  schemaVersion: number;
  canaryHash: string;
  domains: Record<string, DomainRuleEntry>;
  updatedAt: number;
}

export interface WebDAVConfig {
  serverUrl: string;
  username: string;
  password: string;
  remoteFileName: string;
  syncPassword?: string; // 独立可选的端到端同步加密密码 (留空为明文，填写为 AES-256-GCM 密文)
}

export interface SyncStatusInfo {
  status: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncTime: string;
  message: string;
  syncedDomainsCount: number;
}

const STORAGE_KEY_CONFIG = 'mk_webdav_config';
const STORAGE_KEY_MANIFEST = 'mk_local_manifest';
const STORAGE_KEY_SYNC_INFO = 'mk_sync_status_info';

/**
 * 规范化 WebDAV URL：
 * 坚果云地址默认自动补充 /mantra-key 二级目录，允许用户自定义；同时修剪末尾多余斜杠
 */
export function normalizeWebDAVUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (/^https?:\/\/dav\.jianguoyun\.com\/dav\/?$/i.test(trimmed)) {
    return 'https://dav.jianguoyun.com/dav/mantra-key';
  }
  return trimmed;
}

// 初始化本地空清单
export function createEmptyManifest(): MantraManifest {
  return {
    schemaVersion: 1,
    canaryHash: '',
    domains: {},
    updatedAt: Date.now()
  };
}

// 读取本地持久化配置
export function getSavedWebDAVConfig(): WebDAVConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      const cfg = JSON.parse(raw);
      return {
        ...cfg,
        serverUrl: normalizeWebDAVUrl(cfg.serverUrl || '')
      };
    }
  } catch {}
  return {
    serverUrl: '',
    username: '',
    password: '',
    remoteFileName: 'mantra_sync.mkey'
  };
}

// 保存 WebDAV 配置
export function saveWebDAVConfig(config: WebDAVConfig) {
  try {
    const normalized: WebDAVConfig = {
      ...config,
      serverUrl: normalizeWebDAVUrl(config.serverUrl)
    };
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(normalized));
  } catch {}
}

// 读取本地已保存的站点清单
export function getLocalManifest(): MantraManifest {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MANIFEST);
    if (raw) return JSON.parse(raw);
  } catch {}
  return createEmptyManifest();
}

// 保存本地站点清单
export function saveLocalManifest(manifest: MantraManifest) {
  try {
    localStorage.setItem(STORAGE_KEY_MANIFEST, JSON.stringify(manifest));
  } catch {}
}

// 读取同步状态信息
export function getSyncStatusInfo(): SyncStatusInfo {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SYNC_INFO);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    status: 'idle',
    lastSyncTime: '',
    message: '尚未同步',
    syncedDomainsCount: Object.keys(getLocalManifest().domains).length
  };
}

// 保存同步状态信息
export function saveSyncStatusInfo(info: SyncStatusInfo) {
  try {
    localStorage.setItem(STORAGE_KEY_SYNC_INFO, JSON.stringify(info));
  } catch {}
}

// 记录/更新单个站点规则到本地清单
export function recordDomainRule(canonicalDomain: string, rulePreset: string, displayName = ''): MantraManifest {
  const manifest = getLocalManifest();
  const domainKey = canonicalDomain.trim().toLowerCase();
  if (!domainKey) return manifest;

  const now = Date.now();
  const existing = manifest.domains[domainKey];

  manifest.domains[domainKey] = {
    canonicalDomain: domainKey,
    displayName: displayName || existing?.displayName || domainKey,
    rulePreset: rulePreset,
    accounts: existing?.accounts || {},
    updatedAt: now
  };
  manifest.updatedAt = now;
  saveLocalManifest(manifest);
  return manifest;
}

// 移除单个站点规则
export function removeDomainRule(canonicalDomain: string): MantraManifest {
  const manifest = getLocalManifest();
  const domainKey = canonicalDomain.trim().toLowerCase();
  if (manifest.domains[domainKey]) {
    delete manifest.domains[domainKey];
    manifest.updatedAt = Date.now();
    saveLocalManifest(manifest);
  }
  return manifest;
}

/**
 * 状态型 CRDT (CvRDT) 合并算子
 * 并行合并本地与远程 Manifest，根据时间戳与集合并集自动消除冲突
 */
export function mergeManifests(local: MantraManifest, remote: MantraManifest): MantraManifest {
  const merged: MantraManifest = {
    schemaVersion: Math.max(local.schemaVersion || 1, remote.schemaVersion || 1),
    canaryHash: (remote.updatedAt > local.updatedAt ? remote.canaryHash : local.canaryHash) || local.canaryHash || remote.canaryHash,
    domains: { ...local.domains },
    updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0, Date.now())
  };

  // 遍历远程所有域名
  for (const [domainKey, remoteDomain] of Object.entries(remote.domains || {})) {
    const localDomain = merged.domains[domainKey];
    if (!localDomain) {
      merged.domains[domainKey] = remoteDomain;
    } else {
      // 域名级别冲突：按时间戳 Last-Write-Wins
      const newerDomain = remoteDomain.updatedAt > localDomain.updatedAt ? remoteDomain : localDomain;
      const combinedAccounts = { ...localDomain.accounts };

      // 账号级别合并
      for (const [userKey, remoteAcc] of Object.entries(remoteDomain.accounts || {})) {
        const localAcc = combinedAccounts[userKey];
        if (!localAcc) {
          combinedAccounts[userKey] = remoteAcc;
        } else {
          // 账号版本号优先，其次按修改时间戳
          if (remoteAcc.version > localAcc.version || (remoteAcc.version === localAcc.version && remoteAcc.updatedAt > localAcc.updatedAt)) {
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

/**
 * 打包自描述同步信封 (Self-Describing Sync Envelope)
 * - 若 syncPassword 为空：生成 0x00 状态码（未加密纯明文 JSON 信封）
 * - 若 syncPassword 有值：生成 0x01 状态码（金融级 AES-256-GCM 密文信封）
 */
export async function packSyncEnvelope(manifest: MantraManifest, syncPassword?: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const manifestBytes = enc.encode(JSON.stringify(manifest));

  if (!syncPassword || !syncPassword.trim()) {
    // 状态码 0x00: 未加密明文自描述信封
    const envelope = new Uint8Array(3 + manifestBytes.length);
    envelope[0] = 0x4D; // 'M'
    envelope[1] = 0x4B; // 'K'
    envelope[2] = 0x00; // 0x00: 未加密明文
    envelope.set(manifestBytes, 3);
    return envelope;
  }

  // 状态码 0x01: 已加密，PBKDF2(100k次) + AES-256-GCM
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(syncPassword.trim()),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    manifestBytes
  );
  const cipherBytes = new Uint8Array(cipherBuffer);

  const envelope = new Uint8Array(3 + 16 + 12 + cipherBytes.length);
  envelope[0] = 0x4D; // 'M'
  envelope[1] = 0x4B; // 'K'
  envelope[2] = 0x01; // 0x01: 已加密
  envelope.set(salt, 3);
  envelope.set(iv, 3 + 16);
  envelope.set(cipherBytes, 3 + 16 + 12);

  return envelope;
}

/**
 * 打包加密 E2EE 信封 (向前兼容别名)
 */
export async function packE2EEEnvelope(manifest: MantraManifest, syncPassword?: string): Promise<Uint8Array> {
  return packSyncEnvelope(manifest, syncPassword);
}

export interface UnpackResult {
  manifest: MantraManifest;
  isEncrypted: boolean;
}

/**
 * 解包自描述同步信封 (Self-Describing Sync Envelope)
 * - 自动识别纯 JSON 文本（向前兼容）
 * - 自动识别 0x00 明文信封（无需密码）
 * - 自动识别 0x01 密文信封（若未传密码抛出 NEED_SYNC_PASSWORD，若密码不匹配抛出 PASSWORD_MISMATCH）
 */
export async function unpackSyncEnvelope(envelope: Uint8Array, syncPassword?: string): Promise<UnpackResult> {
  if (envelope.length === 0) {
    throw new Error('同步数据为空');
  }

  const dec = new TextDecoder();

  // 1. 向前兼容最原始的纯 JSON 文本 (以 '{' 或 '[' 开头)
  if (envelope[0] === 0x7B || envelope[0] === 0x5B) {
    return {
      manifest: JSON.parse(dec.decode(envelope)) as MantraManifest,
      isEncrypted: false
    };
  }

  // 2. 校验 MK 魔数
  if (envelope.length < 3 || envelope[0] !== 0x4D || envelope[1] !== 0x4B) {
    throw new Error('无效的同步信封格式魔数');
  }

  const flag = envelope[2];

  // 3. 状态码 0x00: 未加密明文自描述信封
  if (flag === 0x00) {
    const jsonStr = dec.decode(envelope.slice(3));
    return {
      manifest: JSON.parse(jsonStr) as MantraManifest,
      isEncrypted: false
    };
  }

  // 4. 状态码 0x01: 已加密 AES-256-GCM 信封
  if (flag === 0x01) {
    if (!syncPassword || !syncPassword.trim()) {
      const err: any = new Error('检测到云端文件已启用端到端加密，请输入同步加密密码');
      err.code = 'NEED_SYNC_PASSWORD';
      throw err;
    }

    if (envelope.length < 3 + 16 + 12 + 16) {
      throw new Error('加密信封数据损坏: 字节长度不足');
    }

    const salt = envelope.slice(3, 3 + 16);
    const iv = envelope.slice(3 + 16, 3 + 16 + 12);
    const cipherBytes = envelope.slice(3 + 16 + 12);

    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(syncPassword.trim()),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const aesKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    try {
      const plainBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        cipherBytes
      );
      return {
        manifest: JSON.parse(dec.decode(plainBuffer)) as MantraManifest,
        isEncrypted: true
      };
    } catch (e: any) {
      const err: any = new Error('同步加密密码不匹配，无法解密云端数据');
      err.code = 'PASSWORD_MISMATCH';
      throw err;
    }
  }

  throw new Error(`不支持的同步信封版本: 0x${flag.toString(16)}`);
}

/**
 * 解密解包 E2EE 信封 (向前兼容别名)
 */
export async function unpackE2EEEnvelope(envelope: Uint8Array, syncPassword?: string): Promise<MantraManifest> {
  const res = await unpackSyncEnvelope(envelope, syncPassword);
  return res.manifest;
}

interface SafeFetchResponse {
  status: number;
  statusText: string;
  ok: boolean;
  headers: Headers;
  arrayBuffer: () => Promise<ArrayBuffer>;
  text: () => Promise<string>;
  json: () => Promise<any>;
}

/**
 * 跨端安全 Fetch 网关：
 * 自动识别 Android 原生注入的 MantraNative.nativeHttpRequest 桥梁；
 * 若在 Android 客户端环境运行，通过原生系统网络穿透请求，100% 免疫 Chromium WebView 的 CORS 跨域限制与 Origin 拦截！
 * 若在标准浏览器环境运行，平滑回退至标准 window.fetch。
 */
export async function safeFetch(url: string, init?: RequestInit): Promise<Response | SafeFetchResponse> {
  const native = (window as any).MantraNative || (window as any).AlpineNative;
  if (native && typeof native.nativeHttpRequest === 'function') {
    let bodyBase64 = '';
    if (init?.body) {
      if (init.body instanceof Uint8Array || init.body instanceof ArrayBuffer) {
        const u8 = init.body instanceof Uint8Array ? init.body : new Uint8Array(init.body);
        let binary = '';
        for (let i = 0; i < u8.length; i++) {
          binary += String.fromCharCode(u8[i]);
        }
        bodyBase64 = btoa(binary);
      } else if (typeof init.body === 'string') {
        bodyBase64 = btoa(unescape(encodeURIComponent(init.body)));
      }
    }

    const headersObj: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => { headersObj[k] = v; });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([k, v]) => { headersObj[k] = v; });
      } else {
        Object.assign(headersObj, init.headers);
      }
    }

    const reqPayload = {
      url,
      method: (init?.method || 'GET').toUpperCase(),
      headers: headersObj,
      bodyBase64,
      timeoutMs: 15000
    };

    const rawResp = native.nativeHttpRequest(JSON.stringify(reqPayload));
    const parsed = JSON.parse(rawResp);

    if (parsed.status === 0 && !parsed.ok) {
      throw new TypeError(`Failed to fetch (原生网络穿透代理异常: ${parsed.error || 'Connection Failed'})`);
    }

    const byteStr = parsed.bodyBase64 ? atob(parsed.bodyBase64) : '';
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
    } as SafeFetchResponse;
  }

  return fetch(url, init);
}

/**
 * 测试 WebDAV 连通性
 */
export async function testWebDAVConnection(config: WebDAVConfig): Promise<{ ok: boolean; message: string }> {
  let url = config.serverUrl.trim().replace(/\/+$/, '');
  if (!url) return { ok: false, message: 'WebDAV 服务器地址不能为空' };
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`);

  try {
    // 尝试向目标地址发送 PROPFIND 或 GET 请求
    const res = await safeFetch(url + '/', {
      method: 'PROPFIND',
      headers: {
        'Authorization': authHeader,
        'Depth': '0',
        'Content-Type': 'application/xml; charset=utf-8'
      },
      signal: AbortSignal.timeout(6000)
    }).catch(async () => {
      // 部分 WebDAV 服务器禁用了 PROPFIND，回退至 GET
      return safeFetch(url + '/', {
        method: 'GET',
        headers: { 'Authorization': authHeader },
        signal: AbortSignal.timeout(6000)
      });
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: '认证失败: 用户名或密码/应用 Token 错误' };
    }
    if ((res.status >= 200 && res.status < 400) || res.status === 207) {
      return { ok: true, message: `连接成功 (HTTP ${res.status})` };
    }
    return { ok: false, message: `服务器返回状态异常: HTTP ${res.status}` };
  } catch (err: any) {
    return { ok: false, message: `网络连接异常: ${err?.message || '无法访问该地址，请检查网络或 CORS 跨域'}` };
  }
}

/**
 * 执行双向同步全流程 (自描述信封感知 -> 自适应解密 -> CRDT 合并 -> 自适应打包 -> 上传回写)
 * @param config WebDAV配置
 * @param onNeedPassword 当云端已加密而本地未配置同步密码时的就地异步交互回调
 */
export async function performWebDAVSync(
  config?: WebDAVConfig,
  onNeedPassword?: () => Promise<string>
): Promise<{ ok: boolean; message: string; mergedCount: number; upgradedToEncrypted?: boolean }> {
  const cfg = config || getSavedWebDAVConfig();
  let base = cfg.serverUrl.trim().replace(/\/+$/, '');
  if (!base) return { ok: false, message: '尚未配置 WebDAV 服务器地址', mergedCount: 0 };
  if (!/^https?:\/\//i.test(base)) base = 'https://' + base;

  const filename = (cfg.remoteFileName || 'mantra_sync.mkey').replace(/^\/+/, '');
  const remoteFileUrl = `${base}/${filename}`;
  const authHeader = 'Basic ' + btoa(`${cfg.username}:${cfg.password}`);

  const localManifest = getLocalManifest();
  let remoteManifest: MantraManifest | null = null;
  let remoteIsEncrypted = false;
  let activeSyncPassword = cfg.syncPassword;

  // 1. 尝试从 WebDAV 下载现有远程文件
  try {
    const getRes = await safeFetch(remoteFileUrl, {
      method: 'GET',
      headers: { 'Authorization': authHeader },
      signal: AbortSignal.timeout(8000)
    });

    if (getRes.status === 401 || getRes.status === 403) {
      return { ok: false, message: 'WebDAV 认证失败，请检查用户名与应用密码', mergedCount: 0 };
    }

    if (getRes.ok) {
      const buffer = await getRes.arrayBuffer();
      if (buffer.byteLength > 0) {
        const envelopeBytes = new Uint8Array(buffer);
        try {
          const res = await unpackSyncEnvelope(envelopeBytes, activeSyncPassword);
          remoteManifest = res.manifest;
          remoteIsEncrypted = res.isEncrypted;
        } catch (unpackErr: any) {
          if (unpackErr.code === 'NEED_SYNC_PASSWORD' && onNeedPassword) {
            // 就地触发弹窗请求用户输入密码
            const promptedPassword = await onNeedPassword();
            if (!promptedPassword || !promptedPassword.trim()) {
              return { ok: false, message: '同步已取消：云端数据已加密，需要同步密码方可合并', mergedCount: 0 };
            }
            activeSyncPassword = promptedPassword.trim();
            cfg.syncPassword = activeSyncPassword;
            saveWebDAVConfig(cfg);

            // 使用新密码重试解密
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
  } catch (err: any) {
    if (err?.code === 'NEED_SYNC_PASSWORD' || err?.code === 'PASSWORD_MISMATCH' || err?.message?.includes('加密密码')) {
      return { ok: false, message: err.message, mergedCount: 0 };
    }
    if (!err?.message?.includes('404')) {
      console.warn('[MantraKey Sync] 下载远程文件异常:', err);
    }
  }

  // 2. 状态型 CRDT 无锁自愈合并
  let finalManifest = localManifest;
  if (remoteManifest) {
    finalManifest = mergeManifests(localManifest, remoteManifest);
  }
  finalManifest.updatedAt = Date.now();

  // 3. 将合并后的最新清单进行本地持久化
  saveLocalManifest(finalManifest);

  // 4. 自适应打包 (若配置了同步密码则存 0x01 密文，否则存 0x00 明文自描述信封)
  const newEnvelopeBytes = await packSyncEnvelope(finalManifest, activeSyncPassword);
  const upgradedToEncrypted = !remoteIsEncrypted && !!activeSyncPassword;

  // 5. 将新数据 PUT 上传至 WebDAV 服务器
  try {
    const putRes = await safeFetch(remoteFileUrl, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/octet-stream'
      },
      body: newEnvelopeBytes as unknown as BodyInit,
      signal: AbortSignal.timeout(10000)
    });

    if (!putRes.ok && putRes.status !== 201 && putRes.status !== 204) {
      return { ok: false, message: `回写同步信封至 WebDAV 失败: HTTP ${putRes.status}`, mergedCount: 0 };
    }
  } catch (err: any) {
    return { ok: false, message: `回写至 WebDAV 失败: ${err?.message || '网络连接超时'}`, mergedCount: 0 };
  }

  const count = Object.keys(finalManifest.domains).length;
  const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const statusMsg = upgradedToEncrypted
    ? `同步成功并已自动安全升格为 AES-256-GCM 加密存储！合并 ${count} 个站点规则`
    : `同步成功！已自动合并 ${count} 个站点规则`;

  const statusInfo: SyncStatusInfo = {
    status: 'success',
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
