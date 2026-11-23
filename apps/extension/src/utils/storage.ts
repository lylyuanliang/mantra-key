/**
 * 密诀 MantraKey - 本地持久化与安全会话存储模块
 */

import { computeCanary, type RulePreset, clearMasterSeedCache } from './crypto.ts';
import { getRootDomain, toUnicodeDomain } from './domain.ts';

export interface AccountRecord {
  username: string;
  version: number;
  rulePreset: RulePreset;
  serviceKey?: string; // 通用服务归属标识 (如 "三毛机场")，用于跨域名派生对齐
  aliases?: string[];  // 别名域名列表或通配模式 (如 ["cleanip.io", "gw-*.三毛机场.com"])
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
 * 判断目标域名是否匹配别名模式 (支持精确匹配、Unicode/Punycode 归一化与 *.xxx.com 通配符)
 */
export function matchDomainAlias(pattern: string, targetDomain: string): boolean {
  if (!pattern || !targetDomain) return false;
  const p = pattern.trim().toLowerCase();
  const pUnicode = toUnicodeDomain(p).toLowerCase();
  const t = targetDomain.trim().toLowerCase();
  const tUnicode = toUnicodeDomain(t).toLowerCase();
  const tRoot = getRootDomain(t);
  const tRootUnicode = toUnicodeDomain(tRoot).toLowerCase();

  const targets = Array.from(new Set([t, tUnicode, tRoot, tRootUnicode])).filter(Boolean);
  const patterns = Array.from(new Set([p, pUnicode])).filter(Boolean);

  for (const pat of patterns) {
    for (const tgt of targets) {
      if (pat === tgt) return true;
      if (pat.startsWith('*.') && pat.slice(2) === tgt) return true;
      if (pat.includes('*')) {
        const regexStr = '^' + pat.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
        try {
          if (new RegExp(regexStr).test(tgt)) return true;
        } catch {}
      }
    }
  }
  return false;
}

/**
 * 获取指定域名的账号列表 (支持本域直查 + 根域名继承 + 跨域名别名 + 服务归属/标题智能识别)
 */
export async function getAccountsForDomain(domain: string, pageTitle = ''): Promise<AccountRecord[]> {
  if (!domain) return [];
  const rawDomain = domain.trim().toLowerCase();
  const unicodeDomain = toUnicodeDomain(rawDomain).toLowerCase();
  const rootRaw = getRootDomain(rawDomain);
  const rootUnicode = toUnicodeDomain(rootRaw).toLowerCase();

  const candidateDomains = Array.from(
    new Set([rawDomain, unicodeDomain, rootRaw, rootUnicode])
  ).filter(Boolean);

  try {
    const allStorage = await chrome.storage.local.get(null);
    const resultMap = new Map<string, AccountRecord>();

    // 1. 先加入本域名及其根域名、Unicode 形式直接绑定的账号
    for (const cand of candidateDomains) {
      const key = `${ACCOUNTS_PREFIX}${cand}`;
      const list = Array.isArray(allStorage[key]) ? (allStorage[key] as AccountRecord[]) : [];
      for (const item of list) {
        if (item?.username && !resultMap.has(item.username.toLowerCase())) {
          resultMap.set(item.username.toLowerCase(), {
            ...item,
            tag: item.tag || (cand !== rawDomain ? `根域匹配: ${cand}` : undefined)
          });
        }
      }
    }

    // 2. 扫描其它站点的别名定义与通用服务标识 (如三毛机场镜像站、cleanip.io 等)
    for (const [key, val] of Object.entries(allStorage)) {
      if (!key.startsWith(ACCOUNTS_PREFIX) || !Array.isArray(val)) {
        continue;
      }
      for (const item of val as AccountRecord[]) {
        if (!item?.username || resultMap.has(item.username.toLowerCase())) continue;

        // 2.1 检查别名列表中是否有匹配当前候选域名的模式
        const aliases = Array.isArray(item.aliases) ? item.aliases : [];
        const isAliasMatched = aliases.some((pattern) =>
          candidateDomains.some((cand) => matchDomainAlias(pattern, cand))
        );

        // 2.2 检查服务标识 (如 serviceKey: '三毛机场') 是否匹配域名文本 (如 gw-1.三毛机场.com)
        const serviceKey = (item.serviceKey || '').trim().toLowerCase();
        const isServiceMatched =
          Boolean(serviceKey) &&
          candidateDomains.some(
            (cand) => cand.includes(serviceKey) || serviceKey.includes(cand)
          );

        // 2.3 检查网页标题是否匹配服务标识 (如网页标题为 "三毛机场 - 登录")
        const isTitleMatched =
          Boolean(serviceKey) &&
          Boolean(pageTitle) &&
          pageTitle.toLowerCase().includes(serviceKey);

        if (isAliasMatched || isServiceMatched || isTitleMatched) {
          resultMap.set(item.username.toLowerCase(), {
            ...item,
            tag: item.tag || (item.serviceKey ? `服务: ${item.serviceKey}` : (isTitleMatched ? `标题识别: ${serviceKey}` : '镜像同步'))
          });
        }
      }
    }

    return Array.from(resultMap.values());
  } catch (e) {
    console.warn('[MantraKey Storage] 读取账号列表失败:', e);
    return [];
  }
}

export interface DomainAccountsGroup {
  domain: string;
  unicodeDomain: string;
  serviceKey?: string;
  accounts: AccountRecord[];
}

/**
 * 获取全量已保存站点与账号清单（支持用户纵览所有记录）
 */
export async function getAllAccountsManifest(): Promise<DomainAccountsGroup[]> {
  try {
    const allStorage = await chrome.storage.local.get(null);
    const groups: DomainAccountsGroup[] = [];

    for (const [key, val] of Object.entries(allStorage)) {
      if (key.startsWith(ACCOUNTS_PREFIX) && Array.isArray(val) && val.length > 0) {
        const domain = key.substring(ACCOUNTS_PREFIX.length);
        const accounts = val as AccountRecord[];
        const serviceKey = accounts.find((a) => a.serviceKey)?.serviceKey;
        groups.push({
          domain,
          unicodeDomain: toUnicodeDomain(domain),
          serviceKey,
          accounts,
        });
      }
    }
    return groups;
  } catch {
    return [];
  }
}

/**
 * 将某个已有域名的账号或服务关联到当前域名 (快速设为别名并深度对齐密码派生基底)
 */
export async function linkDomainToExisting(targetDomain: string, sourceDomain: string): Promise<boolean> {
  if (!targetDomain || !sourceDomain) return false;
  const sourceKey = `${ACCOUNTS_PREFIX}${sourceDomain.toLowerCase()}`;
  const allStorage = await chrome.storage.local.get(null);
  const sourceAccs = allStorage[sourceKey] as AccountRecord[] | undefined;
  if (!Array.isArray(sourceAccs) || sourceAccs.length === 0) return false;

  const targetUnicode = toUnicodeDomain(targetDomain).toLowerCase();
  const targetRaw = targetDomain.toLowerCase();

  // 1. 确定统一的 serviceKey 派生基准：
  // 优先沿用源站点已有的 serviceKey；若未设置，则以源站点规范域名作为所有镜像别名的统一基底
  const canonicalServiceKey = sourceAccs.find((a) => a.serviceKey)?.serviceKey || sourceDomain.toLowerCase();

  // 2. 更新源站点的记录：固化 serviceKey 并追加 target 域名别名
  const updatedSource = sourceAccs.map((acc) => {
    const existingAliases = Array.isArray(acc.aliases) ? [...acc.aliases] : [];
    if (!existingAliases.includes(targetUnicode)) {
      existingAliases.push(targetUnicode);
    }
    if (!existingAliases.includes(targetRaw) && targetRaw !== targetUnicode) {
      existingAliases.push(targetRaw);
    }
    return {
      ...acc,
      serviceKey: canonicalServiceKey,
      aliases: existingAliases,
      updatedAt: Date.now()
    };
  });

  // 3. 关键修复：同步修复目标站点 targetDomain 下可能存在的历史错误记录！
  // 若目标站点曾录入了该账号（如在镜像站误录入导致生成错误密码），
  // 将其 serviceKey 强制修改为 canonicalServiceKey，并且版本号、规则等对齐到源站点；
  // 若目标站点尚未保存该账号，直接克隆源站账号并打上统一 serviceKey
  const targetKey = `${ACCOUNTS_PREFIX}${targetRaw}`;
  const existingTargetAccs = (allStorage[targetKey] as AccountRecord[] | undefined) || [];
  const updatedTarget: AccountRecord[] = [];

  for (const srcAcc of updatedSource) {
    const foundTarget = existingTargetAccs.find(
      (t) => t.username.toLowerCase() === srcAcc.username.toLowerCase()
    );
    if (foundTarget) {
      // 覆盖旧的错误记录，强制将密码生成基底与参数切换为 canonicalServiceKey
      updatedTarget.push({
        ...foundTarget,
        serviceKey: canonicalServiceKey,
        version: srcAcc.version,
        rulePreset: srcAcc.rulePreset,
        tag: `已关联: ${toUnicodeDomain(sourceDomain)}`,
        updatedAt: Date.now(),
      });
    } else {
      // 目标站新建镜像记录
      updatedTarget.push({
        ...srcAcc,
        serviceKey: canonicalServiceKey,
        tag: `已关联: ${toUnicodeDomain(sourceDomain)}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  // 保留 target 站原来存在但 source 站没有的其他独立账号 (将其 serviceKey 也同步设为 canonicalServiceKey)
  for (const tAcc of existingTargetAccs) {
    if (!updatedTarget.some((u) => u.username.toLowerCase() === tAcc.username.toLowerCase())) {
      updatedTarget.push({
        ...tAcc,
        serviceKey: canonicalServiceKey,
        tag: `已关联: ${toUnicodeDomain(sourceDomain)}`,
        updatedAt: Date.now(),
      });
    }
  }

  await chrome.storage.local.set({
    [sourceKey]: updatedSource,
    [targetKey]: updatedTarget,
  });
  return true;
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

  // 若当前账号未显式指定 serviceKey，但本站点已有关联的 serviceKey，自动继承
  let finalServiceKey = account.serviceKey;
  if (!finalServiceKey) {
    const existingWithServiceKey = existing.find((a) => a.serviceKey)?.serviceKey;
    if (existingWithServiceKey) {
      finalServiceKey = existingWithServiceKey;
    }
  }

  const accountToSave = {
    ...account,
    serviceKey: finalServiceKey
  };

  const idx = existing.findIndex(
    (item) => item.username.toLowerCase() === accountToSave.username.toLowerCase()
  );

  let finalRecord: AccountRecord;
  if (idx >= 0) {
    finalRecord = {
      ...existing[idx],
      ...accountToSave,
      updatedAt: now,
    };
    existing[idx] = finalRecord;
  } else {
    finalRecord = {
      ...accountToSave,
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
