/**
 * 密诀 MantraKey 浏览器扩展 - WebDAV 端到端加密多端同步服务 (E2EE + CRDT)
 *
 * 1. 零知识端到端加密：清单数据在上传前通过主口令派生的 AES-256-GCM 密钥在本地加密，
 *    WebDAV 服务端（坚果云、Nextcloud、NAS）仅存储二进制密文，无法窥探任何域名或账号。
 * 2. 状态型无冲突合并 (CvRDT)：与 Android 移动端及 PC 桌面端保持 100% 协议一致，
 *    自动拉取远程密文信封解密、本地合并后加密回传。
 */

import { type RulePreset } from './crypto.ts';
import { type AccountRecord } from './storage.ts';

export interface SyncAccountEntry {
  username: string;
  version: number;
  updatedAt: number;
  isDeleted: boolean;
  serviceKey?: string;
  aliases?: string[];
}

export interface SyncDomainEntry {
  canonicalDomain: string;
  displayName: string;
  rulePreset: string;
  serviceKey?: string;
  associatedDomains?: string[];
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
  syncPassword?: string; // 独立可选的端到端同步加密密码 (留空为明文存储，填写为 AES-256-GCM 密文存储)
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
 * 规范化 WebDAV URL：
 * 坚果云地址默认自动补充 /mantra-key 二级目录，允许用户自定义；同时修剪末尾多余斜杠
 */
export function normalizeWebDAVUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  // 用户直接复制坚果云根地址: https://dav.jianguoyun.com/dav 或 https://dav.jianguoyun.com/dav/
  if (/^https?:\/\/dav\.jianguoyun\.com\/dav\/?$/i.test(trimmed)) {
    return 'https://dav.jianguoyun.com/dav/mantra-key';
  }
  return trimmed;
}

/**
 * 读取持久化的 WebDAV 配置
 */
export async function getWebDAVConfig(): Promise<WebDAVConfig> {
  try {
    const res = await chrome.storage.local.get([STORAGE_KEY_CONFIG]);
    if (res[STORAGE_KEY_CONFIG]) {
      const cfg = res[STORAGE_KEY_CONFIG] as WebDAVConfig;
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

/**
 * 保存 WebDAV 配置
 */
export async function saveWebDAVConfig(config: WebDAVConfig): Promise<void> {
  const normalized: WebDAVConfig = {
    ...config,
    serverUrl: normalizeWebDAVUrl(config.serverUrl)
  };
  await chrome.storage.local.set({ [STORAGE_KEY_CONFIG]: normalized });
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

      let domainServiceKey: string | undefined;
      const assocSet = new Set<string>();

      for (const acc of val as AccountRecord[]) {
        if (!acc.username) continue;
        if (!domainServiceKey && acc.serviceKey) {
          domainServiceKey = acc.serviceKey;
        }
        if (Array.isArray(acc.aliases)) {
          acc.aliases.forEach((a) => {
            const clean = a.trim().toLowerCase();
            if (clean && clean !== domain) assocSet.add(clean);
          });
        }
        accounts[acc.username] = {
          username: acc.username,
          version: acc.version || 1,
          updatedAt: acc.updatedAt || Date.now(),
          isDeleted: false,
          serviceKey: acc.serviceKey,
          aliases: acc.aliases
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
        serviceKey: domainServiceKey,
        associatedDomains: assocSet.size > 0 ? Array.from(assocSet) : undefined,
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
 * 将合并后的 Manifest 写回 Extension 本地存储 (CvRDT 智能去重合并)
 */
export async function importMergedManifest(incomingManifest: ExtensionManifest): Promise<void> {
  const localManifest = await exportLocalManifest('');
  const merged = mergeManifests(localManifest, incomingManifest);
  const updates: Record<string, AccountRecord[]> = {};

  for (const [domain, entry] of Object.entries(merged.domains || {})) {
    const key = `${ACCOUNTS_PREFIX}${domain.toLowerCase()}`;
    const accountList: AccountRecord[] = [];
    const domainAssoc = Array.isArray(entry.associatedDomains) ? entry.associatedDomains : [];

    for (const acc of Object.values(entry.accounts || {})) {
      if (acc.isDeleted) continue;
      const aliasSet = new Set<string>([
        ...(Array.isArray(acc.aliases) ? acc.aliases : []),
        ...domainAssoc,
      ]);
      accountList.push({
        username: acc.username,
        version: acc.version || 1,
        rulePreset: (entry.rulePreset as RulePreset) || 'standard-16',
        serviceKey: acc.serviceKey || entry.serviceKey,
        aliases: aliasSet.size > 0 ? Array.from(aliasSet) : undefined,
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
          const mergedAliases = Array.from(new Set([
            ...(Array.isArray(localAcc.aliases) ? localAcc.aliases : []),
            ...(Array.isArray(remoteAcc.aliases) ? remoteAcc.aliases : []),
          ]));
          if (remoteAcc.version > localAcc.version || (remoteAcc.version === localAcc.version && remoteAcc.updatedAt > localAcc.updatedAt)) {
            combinedAccounts[userKey] = {
              ...remoteAcc,
              serviceKey: remoteAcc.serviceKey || localAcc.serviceKey,
              aliases: mergedAliases.length > 0 ? mergedAliases : undefined
            };
          } else {
            combinedAccounts[userKey] = {
              ...localAcc,
              serviceKey: localAcc.serviceKey || remoteAcc.serviceKey,
              aliases: mergedAliases.length > 0 ? mergedAliases : undefined
            };
          }
        }
      }

      const mergedAssoc = Array.from(new Set([
        ...(Array.isArray(localDomain.associatedDomains) ? localDomain.associatedDomains : []),
        ...(Array.isArray(remoteDomain.associatedDomains) ? remoteDomain.associatedDomains : []),
      ]));

      merged.domains[domainKey] = {
        canonicalDomain: newerDomain.canonicalDomain,
        displayName: newerDomain.displayName || localDomain.displayName,
        rulePreset: newerDomain.rulePreset || localDomain.rulePreset,
        serviceKey: newerDomain.serviceKey || localDomain.serviceKey,
        associatedDomains: mergedAssoc.length > 0 ? mergedAssoc : undefined,
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
export async function packSyncEnvelope(manifest: ExtensionManifest, syncPassword?: string): Promise<Uint8Array> {
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
export async function packE2EEEnvelope(manifest: ExtensionManifest, syncPassword?: string): Promise<Uint8Array> {
  return packSyncEnvelope(manifest, syncPassword);
}

export interface UnpackResult {
  manifest: ExtensionManifest;
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
      manifest: JSON.parse(dec.decode(envelope)) as ExtensionManifest,
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
      manifest: JSON.parse(jsonStr) as ExtensionManifest,
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
        manifest: JSON.parse(dec.decode(plainBuffer)) as ExtensionManifest,
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
export async function unpackE2EEEnvelope(envelope: Uint8Array, syncPassword?: string): Promise<ExtensionManifest> {
  const res = await unpackSyncEnvelope(envelope, syncPassword);
  return res.manifest;
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
 * 执行双向同步 (支持独立同步加密密码与就地按需弹窗引导)
 */
export async function performWebDAVSync(
  arg1?: string | WebDAVConfig,
  arg2?: WebDAVConfig | (() => Promise<string | null>),
  arg3?: () => Promise<string | null>
): Promise<{ ok: boolean; message: string; mergedCount: number; isEncrypted?: boolean; code?: string }> {
  let cfg: WebDAVConfig;
  let onNeedPassword: (() => Promise<string | null>) | undefined;

  if (typeof arg1 === 'string') {
    // 兼容历史调用: performWebDAVSync(masterMantra, config, onNeedPassword)
    cfg = (arg2 as WebDAVConfig) || await getWebDAVConfig();
    if (!cfg.syncPassword && arg1) {
      cfg.syncPassword = arg1;
    }
    onNeedPassword = arg3;
  } else {
    // 现代解耦调用: performWebDAVSync(config, onNeedPassword)
    cfg = arg1 || await getWebDAVConfig();
    onNeedPassword = arg2 as (() => Promise<string | null>) | undefined;
  }

  let base = cfg.serverUrl.trim().replace(/\/+$/, '');
  if (!base) return { ok: false, message: '尚未配置 WebDAV 服务器地址', mergedCount: 0 };
  if (!/^https?:\/\//i.test(base)) base = 'https://' + base;

  const filename = (cfg.remoteFileName || 'mantra_sync.mkey').replace(/^\/+/, '');
  const remoteFileUrl = `${base}/${filename}`;
  const authHeader = 'Basic ' + btoa(`${cfg.username}:${cfg.password}`);

  const localManifest = await exportLocalManifest();
  let remoteManifest: ExtensionManifest | null = null;
  let remoteIsEncrypted = false;

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
        const envelopeBytes = new Uint8Array(buffer);
        let syncPassword = cfg.syncPassword;

        // 若云端为 0x01 加密信封，但本地未提供同步密码
        if (envelopeBytes.length >= 3 && envelopeBytes[0] === 0x4D && envelopeBytes[1] === 0x4B && envelopeBytes[2] === 0x01) {
          remoteIsEncrypted = true;
          if (!syncPassword || !syncPassword.trim()) {
            if (onNeedPassword) {
              const entered = await onNeedPassword();
              if (!entered || !entered.trim()) {
                return { ok: false, code: 'NEED_SYNC_PASSWORD', message: '已取消输入同步加密密码，未执行同步', mergedCount: 0 };
              }
              syncPassword = entered.trim();
              cfg.syncPassword = syncPassword;
              await saveWebDAVConfig(cfg);
            } else {
              return { ok: false, code: 'NEED_SYNC_PASSWORD', message: '检测到云端文件已启用端到端加密，请输入同步加密密码', mergedCount: 0 };
            }
          }
        }

        const unpacked = await unpackSyncEnvelope(envelopeBytes, syncPassword);
        remoteManifest = unpacked.manifest;
        remoteIsEncrypted = unpacked.isEncrypted;
      }
    }
  } catch (err: any) {
    if (err?.code === 'NEED_SYNC_PASSWORD' || err?.code === 'PASSWORD_MISMATCH') {
      return { ok: false, code: err.code, message: err.message, mergedCount: 0 };
    }
    if (!err?.message?.includes('404')) {
      console.warn('读取云端同步文件提示:', err);
    }
  }

  let finalManifest = localManifest;
  if (remoteManifest) {
    finalManifest = mergeManifests(localManifest, remoteManifest);
  }
  finalManifest.updatedAt = Date.now();

  await importMergedManifest(finalManifest);

  // 决定回写的信封类型：以当前的 cfg.syncPassword 为准 (有密码则 0x01 密文，无密码则 0x00 明文)
  const newEnvelope = await packSyncEnvelope(finalManifest, cfg.syncPassword);

  try {
    const putRes = await fetch(remoteFileUrl, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/octet-stream'
      },
      body: newEnvelope as unknown as BodyInit,
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
  const encryptTag = cfg.syncPassword ? ' (密文存储已加固)' : ' (明文存储)';
  const statusInfo: SyncStatusInfo = {
    status: 'success',
    lastSyncTime: timeStr,
    message: `同步成功！已自动合并 ${count} 个站点凭据${encryptTag}`,
    syncedDomainsCount: count
  };
  await chrome.storage.local.set({ [STORAGE_KEY_SYNC_INFO]: statusInfo });

  return {
    ok: true,
    message: statusInfo.message,
    mergedCount: count,
    isEncrypted: Boolean(cfg.syncPassword)
  };
}
