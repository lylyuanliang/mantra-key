/**
 * 密诀 MantraKey - 本地持久化与安全会话存储模块
 */

import { computeCanary, RulePreset, clearMasterSeedCache } from './crypto';

export interface AccountRecord {
  username: string;
  version: number;
  rulePreset: RulePreset;
  tag?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SessionState {
  isUnlocked: boolean;
  mantra: string | null;
  canary: string | null;
  ttlRemaining: number; // 剩余秒数
}

const SESSION_STORAGE_KEY = 'mantra_active_session';
const ACCOUNTS_PREFIX = 'mantra_accs_';

/**
 * 获取指定域名的账号列表
 */
export async function getAccountsForDomain(domain: string): Promise<AccountRecord[]> {
  if (!domain) return [];
  const key = `${ACCOUNTS_PREFIX}${domain.toLowerCase()}`;
  try {
    const result = await chrome.storage.local.get([key]);
    const list = result[key];
    if (Array.isArray(list)) {
      return list as AccountRecord[];
    }
    return [];
  } catch (e) {
    console.warn('[MantraKey Storage] 读取账号列表失败:', e);
    return [];
  }
}

/**
 * 保存或更新指定域名的账号记录
 */
export async function saveAccountForDomain(
  domain: string,
  account: Omit<AccountRecord, 'createdAt' | 'updatedAt'>
): Promise<AccountRecord> {
  if (!domain) throw new Error('域名不能为空');
  if (!account.username) throw new Error('账号名称不能为空');

  const key = `${ACCOUNTS_PREFIX}${domain.toLowerCase()}`;
  const existing = await getAccountsForDomain(domain);
  const now = Date.now();

  const idx = existing.findIndex(
    (item) => item.username.toLowerCase() === account.username.toLowerCase()
  );

  let finalRecord: AccountRecord;
  if (idx >= 0) {
    finalRecord = {
      ...existing[idx],
      ...account,
      updatedAt: now,
    };
    existing[idx] = finalRecord;
  } else {
    finalRecord = {
      ...account,
      createdAt: now,
      updatedAt: now,
    };
    existing.unshift(finalRecord);
  }

  await chrome.storage.local.set({ [key]: existing });
  return finalRecord;
}

/**
 * 删除指定域名的某个账号
 */
export async function deleteAccountFromDomain(domain: string, username: string): Promise<void> {
  if (!domain || !username) return;
  const key = `${ACCOUNTS_PREFIX}${domain.toLowerCase()}`;
  const existing = await getAccountsForDomain(domain);
  const filtered = existing.filter(
    (item) => item.username.toLowerCase() !== username.toLowerCase()
  );
  await chrome.storage.local.set({ [key]: filtered });
}

/**
 * 调整指定账号的版本号 (v1 -> v2)
 */
export async function updateAccountVersion(
  domain: string,
  username: string,
  newVersion: number
): Promise<AccountRecord | null> {
  if (!domain || !username || newVersion < 1) return null;
  const key = `${ACCOUNTS_PREFIX}${domain.toLowerCase()}`;
  const existing = await getAccountsForDomain(domain);
  const target = existing.find(
    (item) => item.username.toLowerCase() === username.toLowerCase()
  );
  if (!target) return null;

  target.version = newVersion;
  target.updatedAt = Date.now();
  await chrome.storage.local.set({ [key]: existing });
  return target;
}

/**
 * 读取当前主口令安全会话状态 (带 15 分钟 TTL 物理超时判断)
 */
export async function getSessionState(): Promise<SessionState> {
  try {
    const res = await chrome.storage.local.get([SESSION_STORAGE_KEY]);
    const data = res[SESSION_STORAGE_KEY];

    if (!data || !data.mantra || !data.expiresAt) {
      return {
        isUnlocked: false,
        mantra: null,
        canary: null,
        ttlRemaining: 0,
      };
    }

    const now = Date.now();
    const remainingMs = data.expiresAt - now;

    if (remainingMs <= 0) {
      // 已经过期，立即安全清理
      await lockSession();
      return {
        isUnlocked: false,
        mantra: null,
        canary: null,
        ttlRemaining: 0,
      };
    }

    return {
      isUnlocked: true,
      mantra: data.mantra,
      canary: data.canary,
      ttlRemaining: Math.floor(remainingMs / 1000),
    };
  } catch (e) {
    console.warn('[MantraKey Storage] 读取会话状态异常:', e);
    return {
      isUnlocked: false,
      mantra: null,
      canary: null,
      ttlRemaining: 0,
    };
  }
}

/**
 * 激活/解锁主口令会话 (默认 15 分钟 TTL)
 */
export async function unlockSession(
  mantra: string,
  ttlSeconds: number = 900
): Promise<SessionState> {
  const canary = await computeCanary(mantra);
  const expiresAt = Date.now() + ttlSeconds * 1000;

  await chrome.storage.local.set({
    [SESSION_STORAGE_KEY]: {
      mantra,
      canary,
      expiresAt,
    },
  });

  return {
    isUnlocked: true,
    mantra,
    canary,
    ttlRemaining: ttlSeconds,
  };
}

/**
 * 续期当前会话 (Keepalive)
 */
export async function touchSession(ttlSeconds: number = 900): Promise<void> {
  const current = await getSessionState();
  if (current.isUnlocked && current.mantra) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    await chrome.storage.local.set({
      [SESSION_STORAGE_KEY]: {
        mantra: current.mantra,
        canary: current.canary,
        expiresAt,
      },
    });
  }
}

/**
 * 立即锁定会话，彻底擦除存储与内存
 */
export async function lockSession(): Promise<void> {
  clearMasterSeedCache();
  try {
    await chrome.storage.local.remove([SESSION_STORAGE_KEY]);
  } catch (e) {
    console.warn('[MantraKey Storage] 锁定会话清理异常:', e);
  }
}
