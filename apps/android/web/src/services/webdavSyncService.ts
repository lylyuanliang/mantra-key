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
    if (raw) return JSON.parse(raw);
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
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
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
 * 使用主口令派生密钥并执行 AES-256-GCM 端到端加密
 * 二进制封包格式:
 * [Magic: 'MK'(2B)] + [Version: 0x01(1B)] + [Salt: 16B] + [IV: 12B] + [Ciphertext + AuthTag(16B)]
 */
export async function packE2EEEnvelope(manifest: MantraManifest, masterMantra: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const manifestBytes = enc.encode(JSON.stringify(manifest));

  // 1. 随机生成 16 字节 Salt 与 12 字节 IV
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 2. PBKDF2-SHA256 派生 256 位加密密钥
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(masterMantra),
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

  // 3. AES-GCM 加密
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    manifestBytes
  );
  const cipherBytes = new Uint8Array(cipherBuffer);

  // 4. 组装二进制封包
  const totalLength = 2 + 1 + 16 + 12 + cipherBytes.length;
  const envelope = new Uint8Array(totalLength);
  envelope[0] = 0x4D; // 'M'
  envelope[1] = 0x4B; // 'K'
  envelope[2] = 0x01; // Version 1
  envelope.set(salt, 3);
  envelope.set(iv, 3 + 16);
  envelope.set(cipherBytes, 3 + 16 + 12);

  return envelope;
}

/**
 * 解析并解密端到端二进制信封
 */
export async function unpackE2EEEnvelope(envelope: Uint8Array, masterMantra: string): Promise<MantraManifest> {
  if (envelope.length < 3 + 16 + 12 + 16) {
    throw new Error('信封数据损坏: 字节长度不足');
  }

  // 校验魔数
  if (envelope[0] !== 0x4D || envelope[1] !== 0x4B) {
    throw new Error('无效的同步信封魔数 (非 MantraKey 加密文件)');
  }
  const version = envelope[2];
  if (version !== 1) {
    throw new Error(`不支持的信封版本: ${version}`);
  }

  const salt = envelope.slice(3, 3 + 16);
  const iv = envelope.slice(3 + 16, 3 + 16 + 12);
  const cipherBytes = envelope.slice(3 + 16 + 12);

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(masterMantra),
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
    const dec = new TextDecoder();
    const jsonStr = dec.decode(plainBuffer);
    return JSON.parse(jsonStr) as MantraManifest;
  } catch (err) {
    throw new Error('解密失败: 主口令可能不匹配或数据已被篡改');
  }
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
    // 尝试向目标地址发送 PROPFIND 或 HEAD 请求
    const res = await fetch(url + '/', {
      method: 'PROPFIND',
      headers: {
        'Authorization': authHeader,
        'Depth': '0',
        'Content-Type': 'application/xml; charset=utf-8'
      },
      signal: AbortSignal.timeout(6000)
    }).catch(async () => {
      // 部分 WebDAV 服务器禁用了 PROPFIND，回退至 GET
      return fetch(url + '/', {
        method: 'GET',
        headers: { 'Authorization': authHeader },
        signal: AbortSignal.timeout(6000)
      });
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: '认证失败: 用户名或密码/应用 Token 错误' };
    }
    if (res.status >= 200 && res.status < 400 || res.status === 207) {
      return { ok: true, message: `连接成功 (HTTP ${res.status})` };
    }
    return { ok: false, message: `服务器返回状态异常: HTTP ${res.status}` };
  } catch (err: any) {
    return { ok: false, message: `网络连接异常: ${err?.message || '无法访问该地址，请检查网络或 CORS 跨域'}` };
  }
}

/**
 * 执行双向同步全流程 (E2EE 下载 -> 解密 -> CRDT 合并 -> 加密 -> 上传回写)
 */
export async function performWebDAVSync(
  masterMantra: string,
  config?: WebDAVConfig
): Promise<{ ok: boolean; message: string; mergedCount: number }> {
  if (!masterMantra || !masterMantra.trim()) {
    return { ok: false, message: '同步需要主口令作为端到端解密与加密密钥，请输入主口令', mergedCount: 0 };
  }

  const cfg = config || getSavedWebDAVConfig();
  let base = cfg.serverUrl.trim().replace(/\/+$/, '');
  if (!base) return { ok: false, message: '尚未配置 WebDAV 服务器地址', mergedCount: 0 };
  if (!/^https?:\/\//i.test(base)) base = 'https://' + base;

  const filename = (cfg.remoteFileName || 'mantra_sync.mkey').replace(/^\/+/, '');
  const remoteFileUrl = `${base}/${filename}`;
  const authHeader = 'Basic ' + btoa(`${cfg.username}:${cfg.password}`);

  const localManifest = getLocalManifest();
  let remoteManifest: MantraManifest | null = null;

  // 1. 尝试从 WebDAV 下载现有远程密文文件
  try {
    const getRes = await fetch(remoteFileUrl, {
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
        remoteManifest = await unpackE2EEEnvelope(envelopeBytes, masterMantra);
      }
    } else if (getRes.status !== 404) {
      return { ok: false, message: `获取远程同步文件失败: HTTP ${getRes.status}`, mergedCount: 0 };
    }
  } catch (err: any) {
    if (err?.message?.includes('解密失败')) {
      return { ok: false, message: err.message, mergedCount: 0 };
    }
    // 若仅是文件不存在 (404) 则正常进行初次上传
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

  // 4. 使用主口令将合并结果重新封包并加密
  const newEnvelopeBytes = await packE2EEEnvelope(finalManifest, masterMantra);

  // 5. 将新密文 PUT 上传至 WebDAV 服务器
  try {
    const putRes = await fetch(remoteFileUrl, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/octet-stream'
      },
      body: newEnvelopeBytes,
      signal: AbortSignal.timeout(10000)
    });

    if (!putRes.ok && putRes.status !== 201 && putRes.status !== 204) {
      return { ok: false, message: `回写同步密文至 WebDAV 失败: HTTP ${putRes.status}`, mergedCount: 0 };
    }
  } catch (err: any) {
    return { ok: false, message: `回写至 WebDAV 失败: ${err?.message || '网络连接超时'}`, mergedCount: 0 };
  }

  const count = Object.keys(finalManifest.domains).length;
  const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const statusInfo: SyncStatusInfo = {
    status: 'success',
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
