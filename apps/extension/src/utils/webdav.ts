/**
 * 密诀 MantraKey 浏览器扩展 - WebDAV 端到端加密多端同步服务 (E2EE + CRDT)
 *
 * 1. 零知识端到端加密：清单数据在上传前通过主口令派生的 AES-256-GCM 密钥在本地加密，
 *    WebDAV 服务端（坚果云、Nextcloud、NAS）仅存储二进制密文，无法窥探任何域名或账号。
 * 2. 状态型无冲突合并 (CvRDT)：与 Android 移动端及 PC 桌面端保持 100% 协议一致，
 *    自动拉取远程密文信封解密、本地合并后加密回传。
 */

import { RulePreset } from './crypto';
import { AccountRecord } from './storage';

export interface SyncAccountEntry {
  username: string;
  version: number;
  updatedAt: number;
  isDeleted: boolean;
}

export interface SyncDomainEntry {
  canonicalDomain: string;
  displayName: string;
  rulePreset: string;
  accounts: Record<string, SyncAccountEntry>;
  updatedAt: number;
}

export interface ExtensionManifest {
  schemaVersion: number;
  canaryHash: string;
  domains: Record<string, SyncDomainEntry>;
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
const STORAGE_KEY_SYNC_INFO = 'mk_sync_status_info';
const ACCOUNTS_PREFIX = 'mantra_accs_';

/**
 * 读取持久化的 WebDAV 配置
 */
export async function getWebDAVConfig(): Promise<WebDAVConfig> {
  try {
    const res = await chrome.storage.local.get([STORAGE_KEY_CONFIG]);
    if (res[STORAGE_KEY_CONFIG]) {
      return res[STORAGE_KEY_CONFIG];
    }
  } catch {}
  return {
    serverUrl: '',
    username: '',
    password: '',
    remoteFileName: 'mantra_sync.mkey'
  };
}

/**
 * 保存 WebDAV 配置
 */
export async function saveWebDAVConfig(config: WebDAVConfig): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_CONFIG]: config });
}

/**
 * 读取同步状态
 */
export async function getSyncStatus(): Promise<SyncStatusInfo> {
  try {
    const res = await chrome.storage.local.get([STORAGE_KEY_SYNC_INFO]);
    if (res[STORAGE_KEY_SYNC_INFO]) {
      return res[STORAGE_KEY_SYNC_INFO];
    }
  } catch {}
  return {
    status: 'idle',
    lastSyncTime: '',
    message: '尚未同步',
    syncedDomainsCount: 0
  };
}

/**
 * 从 Extension 本地 chrome.storage.local 提取所有已存凭据并生成 Manifest
 */
export async function exportLocalManifest(canaryHash = ''): Promise<ExtensionManifest> {
  const allItems = await chrome.storage.local.get(null);
  const domains: Record<string, SyncDomainEntry> = {};

  for (const [key, val] of Object.entries(allItems)) {
    if (key.startsWith(ACCOUNTS_PREFIX) && Array.isArray(val)) {
      const domain = key.substring(ACCOUNTS_PREFIX.length).toLowerCase();
      const accounts: Record<string, SyncAccountEntry> = {};
      let maxUpdatedAt = Date.now();
      let defaultRule: RulePreset = 'standard-16';

      for (const acc of val as AccountRecord[]) {
        if (!acc.username) continue;
        accounts[acc.username] = {
          username: acc.username,
          version: acc.version || 1,
          updatedAt: acc.updatedAt || Date.now(),
          isDeleted: false
        };
        if (acc.updatedAt && acc.updatedAt > maxUpdatedAt) {
          maxUpdatedAt = acc.updatedAt;
        }
        if (acc.rulePreset) {
          defaultRule = acc.rulePreset;
        }
      }

      domains[domain] = {
        canonicalDomain: domain,
        displayName: domain,
        rulePreset: defaultRule,
        accounts,
        updatedAt: maxUpdatedAt
      };
    }
  }

  return {
    schemaVersion: 1,
    canaryHash,
    domains,
    updatedAt: Date.now()
  };
}

/**
 * 将合并后的 Manifest 写回 Extension 本地存储
 */
export async function importMergedManifest(manifest: ExtensionManifest): Promise<void> {
  const updates: Record<string, AccountRecord[]> = {};

  for (const [domain, entry] of Object.entries(manifest.domains || {})) {
    const key = `${ACCOUNTS_PREFIX}${domain.toLowerCase()}`;
    const accountList: AccountRecord[] = [];

    for (const acc of Object.values(entry.accounts || {})) {
      if (acc.isDeleted) continue;
      accountList.push({
        username: acc.username,
        version: acc.version || 1,
        rulePreset: (entry.rulePreset as RulePreset) || 'standard-16',
        createdAt: acc.updatedAt || Date.now(),
        updatedAt: acc.updatedAt || Date.now()
      });
    }

    if (accountList.length > 0) {
      updates[key] = accountList;
    }
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
}

/**
 * 状态型 CRDT (CvRDT) 合并算子
 */
export function mergeManifests(local: ExtensionManifest, remote: ExtensionManifest): ExtensionManifest {
  const merged: ExtensionManifest = {
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
 * 打包加密 E2EE 信封
 */
export async function packE2EEEnvelope(manifest: ExtensionManifest, masterMantra: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const manifestBytes = enc.encode(JSON.stringify(manifest));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

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

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    manifestBytes
  );
  const cipherBytes = new Uint8Array(cipherBuffer);

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
 * 解密解包 E2EE 信封
 */
export async function unpackE2EEEnvelope(envelope: Uint8Array, masterMantra: string): Promise<ExtensionManifest> {
  if (envelope.length < 3 + 16 + 12 + 16) {
    throw new Error('信封数据损坏: 字节长度不足');
  }

  if (envelope[0] !== 0x4D || envelope[1] !== 0x4B) {
    throw new Error('无效的同步信封魔数');
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

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    cipherBytes
  );
  const dec = new TextDecoder();
  return JSON.parse(dec.decode(plainBuffer)) as ExtensionManifest;
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
    const res = await fetch(url + '/', {
      method: 'PROPFIND',
      headers: {
        'Authorization': authHeader,
        'Depth': '0',
        'Content-Type': 'application/xml; charset=utf-8'
      },
      signal: AbortSignal.timeout(6000)
    }).catch(async () => {
      return fetch(url + '/', {
        method: 'GET',
        headers: { 'Authorization': authHeader },
        signal: AbortSignal.timeout(6000)
      });
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: '认证失败: 用户名或密码错误' };
    }
    if (res.status >= 200 && res.status < 400 || res.status === 207) {
      return { ok: true, message: `连接成功 (HTTP ${res.status})` };
    }
    return { ok: false, message: `服务器返回异常: HTTP ${res.status}` };
  } catch (err: any) {
    return { ok: false, message: `网络连接异常: ${err?.message || '无法访问'}` };
  }
}

/**
 * 执行双向同步
 */
export async function performWebDAVSync(
  masterMantra: string,
  config?: WebDAVConfig
): Promise<{ ok: boolean; message: string; mergedCount: number }> {
  if (!masterMantra || !masterMantra.trim()) {
    return { ok: false, message: '请先解锁会话并输入主口令', mergedCount: 0 };
  }

  const cfg = config || await getWebDAVConfig();
  let base = cfg.serverUrl.trim().replace(/\/+$/, '');
  if (!base) return { ok: false, message: '尚未配置 WebDAV 服务器地址', mergedCount: 0 };
  if (!/^https?:\/\//i.test(base)) base = 'https://' + base;

  const filename = (cfg.remoteFileName || 'mantra_sync.mkey').replace(/^\/+/, '');
  const remoteFileUrl = `${base}/${filename}`;
  const authHeader = 'Basic ' + btoa(`${cfg.username}:${cfg.password}`);

  const localManifest = await exportLocalManifest();
  let remoteManifest: ExtensionManifest | null = null;

  try {
    const getRes = await fetch(remoteFileUrl, {
      method: 'GET',
      headers: { 'Authorization': authHeader },
      signal: AbortSignal.timeout(8000)
    });

    if (getRes.status === 401 || getRes.status === 403) {
      return { ok: false, message: 'WebDAV 认证失败，请检查账号密码', mergedCount: 0 };
    }

    if (getRes.ok) {
      const buffer = await getRes.arrayBuffer();
      if (buffer.byteLength > 0) {
        remoteManifest = await unpackE2EEEnvelope(new Uint8Array(buffer), masterMantra);
      }
    }
  } catch (err: any) {
    if (err?.message?.includes('解密失败')) {
      return { ok: false, message: err.message, mergedCount: 0 };
    }
  }

  let finalManifest = localManifest;
  if (remoteManifest) {
    finalManifest = mergeManifests(localManifest, remoteManifest);
  }
  finalManifest.updatedAt = Date.now();

  await importMergedManifest(finalManifest);

  const newEnvelope = await packE2EEEnvelope(finalManifest, masterMantra);

  try {
    const putRes = await fetch(remoteFileUrl, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/octet-stream'
      },
      body: newEnvelope,
      signal: AbortSignal.timeout(10000)
    });

    if (!putRes.ok && putRes.status !== 201 && putRes.status !== 204) {
      return { ok: false, message: `回写至 WebDAV 失败: HTTP ${putRes.status}`, mergedCount: 0 };
    }
  } catch (err: any) {
    return { ok: false, message: `回写至 WebDAV 失败: ${err?.message || '网络超时'}`, mergedCount: 0 };
  }

  const count = Object.keys(finalManifest.domains).length;
  const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const statusInfo: SyncStatusInfo = {
    status: 'success',
    lastSyncTime: timeStr,
    message: `同步成功！已自动合并 ${count} 个站点凭据`,
    syncedDomainsCount: count
  };
  await chrome.storage.local.set({ [STORAGE_KEY_SYNC_INFO]: statusInfo });

  return {
    ok: true,
    message: statusInfo.message,
    mergedCount: count
  };
}
