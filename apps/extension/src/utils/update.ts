/**
 * 密诀 MantraKey 浏览器扩展 - 在线检查更新与直链下载服务
 *
 * 为未上架 Chrome Web Store 的离线扩展提供全自动版本探测、
 * 镜像加速直链下载与角标更新提醒机制。
 */

export interface ExtensionUpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  versionTag: string;
  changelog: string;
  downloadUrl: string;
  acceleratedDownloadUrl: string;
  sha256?: string;
}

export interface AutoUpdateResult {
  success: boolean;
  isNative: boolean;
  message: string;
}

/**
 * 触发全自动静默升级流程
 * 优先调用 Native Messaging 驱动本地 Native Host 自动下载覆写；
 * 若未安装 Native Host 或连接断开，自动平滑降级为提示并下载 ZIP 包。
 */
export async function performExtensionAutoUpdate(
  info: ExtensionUpdateInfo,
  onProgress?: (statusText: string, percent?: number) => void
): Promise<AutoUpdateResult> {
  let progressPercent = 12;
  onProgress?.('正在连接本地原生更新代理...', progressPercent);

  let settled = false;
  // Native Host 单次 RPC 期间推进阶段进度（封顶 88%，待真实结果返回后再置 100%）
  const progressTimer = setInterval(() => {
    if (settled) return;
    if (progressPercent < 88) {
      const step = progressPercent < 40 ? 9 : progressPercent < 70 ? 6 : 3;
      progressPercent = Math.min(88, progressPercent + step);
    }
    const stageText =
      progressPercent < 36
        ? '正在连接本地原生更新代理...'
        : progressPercent < 68
          ? '正在通过加速镜像拉取更新包...'
          : '正在解压并覆写扩展目录...';
    onProgress?.(stageText, progressPercent);
  }, 450);

  let res: any;
  try {
    // 1. 发送消息给 background 执行 Native 请求
    res = await new Promise<any>((resolve) => {
      chrome.runtime.sendMessage({
        action: 'EXECUTE_EXTENSION_AUTO_UPDATE',
        payload: {
          downloadUrl: info.acceleratedDownloadUrl,
          directDownloadUrl: info.downloadUrl,
          latestVersion: info.latestVersion,
          sha256: info.sha256,
          extensionId: chrome.runtime?.id
        }
      }, (response) => {
        const _err = chrome.runtime.lastError;
        resolve(response);
      });
    });
  } finally {
    settled = true;
    clearInterval(progressTimer);
  }

  if (res && res.status === 'ok') {
    onProgress?.('🎉 本地文件覆写完成，正在热重载扩展...', 100);
    // 延迟 800ms 触发 reload 确保状态渲染与动画完成
    setTimeout(() => {
      chrome.runtime.reload();
    }, 800);
    return {
      success: true,
      isNative: true,
      message: res.message || '更新成功，正在重新加载扩展'
    };
  }

  // 2. 原生代理不可用时平滑降级为浏览器下载
  onProgress?.('未检测到本地原生服务，已切换浏览器下载离线包', 100);
  chrome.tabs.create({ url: info.acceleratedDownloadUrl });
  return {
    success: false,
    isNative: false,
    message: '本地未运行 Native 代理，已通过浏览器下载更新包，解压覆盖后刷新即可'
  };
}

export interface CachedExtensionUpdate {
  info: ExtensionUpdateInfo;
  checkedAt: number;
}

export const GITHUB_REPO = 'lylyuanliang/mantra-key';
export const ACCELERATOR_PREFIX = 'https://ghproxy.net/';
export const UPDATE_CACHE_STORAGE_KEY = 'mantrakey_extension_update_cache';
export const UPDATE_CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 3500;

/**
 * 获取当前运行扩展的完整版本号（优先取带构建时间戳的 version_name）
 */
export function getCurrentExtensionVersion(): string {
  const manifest = chrome.runtime?.getManifest?.();
  return ((manifest as any)?.version_name || manifest?.version || '0.1.3.202611261647').trim();
}

/**
 * 同步更新扩展图标右上角角标（有更新显示 NEW，无更新清空）
 */
export async function syncExtensionBadge(hasUpdate: boolean): Promise<void> {
  if (!chrome.action?.setBadgeText) return;
  try {
    await chrome.action.setBadgeText({ text: hasUpdate ? 'NEW' : '' });
    if (hasUpdate && chrome.action.setBadgeBackgroundColor) {
      await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    }
  } catch {
    // 忽略非扩展上下文或测试环境下的角标设置异常
  }
}

/**
 * 查询扩展图标当前是否正显示 NEW 更新角标
 */
export async function hasNewUpdateBadge(): Promise<boolean> {
  if (!chrome.action?.getBadgeText) return false;
  try {
    const text = await chrome.action.getBadgeText({});
    return (text || '').trim().toUpperCase() === 'NEW';
  } catch {
    return false;
  }
}

/**
 * 读取本地缓存的扩展更新检测结果（版本已变更或数据无效时自动失效）
 */
export async function getCachedExtensionUpdate(): Promise<CachedExtensionUpdate | null> {
  if (!chrome.storage?.local?.get) return null;
  try {
    const stored = await chrome.storage.local.get(UPDATE_CACHE_STORAGE_KEY);
    const cached = stored?.[UPDATE_CACHE_STORAGE_KEY] as CachedExtensionUpdate | undefined;
    if (!cached?.info?.latestVersion || typeof cached.checkedAt !== 'number') {
      return null;
    }

    const currentVersion = getCurrentExtensionVersion();
    // 扩展已升级或降级后，旧版本上下文下的缓存自动失效
    if (cached.info.currentVersion !== currentVersion) {
      return null;
    }

    const hasUpdate = compareVersions(currentVersion, cached.info.latestVersion) > 0;
    return {
      info: {
        ...cached.info,
        currentVersion,
        hasUpdate,
      },
      checkedAt: cached.checkedAt,
    };
  } catch {
    return null;
  }
}

/**
 * 将扩展更新检测结果写入本地缓存，供 Popup 打开时毫秒级直出
 */
export async function saveCachedExtensionUpdate(info: ExtensionUpdateInfo): Promise<void> {
  if (!chrome.storage?.local?.set) return;
  try {
    const payload: CachedExtensionUpdate = {
      info,
      checkedAt: Date.now(),
    };
    await chrome.storage.local.set({ [UPDATE_CACHE_STORAGE_KEY]: payload });
  } catch {
    // 忽略存储写入异常
  }
}

/**
 * 判断更新缓存是否已过期，需要后台静默刷新
 */
export function isUpdateCacheStale(
  cached: CachedExtensionUpdate | null,
  ttlMs: number = UPDATE_CACHE_TTL_MS
): boolean {
  if (!cached) return true;
  return Date.now() - cached.checkedAt >= ttlMs;
}

/**
 * 并发竞速请求多个版本元数据地址，采纳首个返回有效版本 JSON 的节点并中止其余在途请求
 */
async function fetchFirstValidVersionJson(urls: string[]): Promise<any | null> {
  if (urls.length === 0) return null;

  const controllers = urls.map(() => new AbortController());
  const timers = controllers.map((controller) =>
    setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  );

  try {
    const tasks = urls.map(async (url, idx) => {
      try {
        const res = await fetch(url, { signal: controllers[idx].signal });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        if (!json || (!json.version && !json.versionTag)) {
          throw new Error('Invalid version payload');
        }
        controllers.forEach((ctrl, i) => {
          if (i !== idx) ctrl.abort();
        });
        return json;
      } finally {
        clearTimeout(timers[idx]);
      }
    });

    return await Promise.any(tasks);
  } catch {
    return null;
  } finally {
    timers.forEach((timer) => clearTimeout(timer));
  }
}

/**
 * 语义化版本号对比
 * @returns 1: 远端有更新; 0: 同版本; -1: 当前版本较新
 */
export function compareVersions(current: string, latest: string): number {
  if (!current || !latest) return 0;
  const clean = (v: string) => v.replace(/^v/i, '').trim();
  const cParts = clean(current).split('.').map((n) => parseInt(n, 10) || 0);
  const lParts = clean(latest).split('.').map((n) => parseInt(n, 10) || 0);

  const maxLen = Math.max(cParts.length, lParts.length);
  for (let i = 0; i < maxLen; i++) {
    const cVal = cParts[i] || 0;
    const lVal = lParts[i] || 0;
    if (lVal > cVal) return 1;
    if (lVal < cVal) return -1;
  }
  return 0;
}

/**
 * 并发获取最新版本元数据并比对当前插件版本，同时自动同步本地缓存与图标角标
 */
export async function checkExtensionUpdate(): Promise<ExtensionUpdateInfo | null> {
  const currentVersion = getCurrentExtensionVersion();
  const timestamp = Date.now();

  const candidateUrls = [
    `https://ghproxy.net/https://raw.githubusercontent.com/${GITHUB_REPO}/main/public/version.json?t=${timestamp}`,
    `https://gh-proxy.com/https://raw.githubusercontent.com/${GITHUB_REPO}/main/public/version.json?t=${timestamp}`,
    `https://raw.githubusercontent.com/${GITHUB_REPO}/main/public/version.json?t=${timestamp}`,
    `https://cdn.jsdelivr.net/gh/${GITHUB_REPO}@main/public/version.json?t=${timestamp}`
  ];

  const remoteData = await fetchFirstValidVersionJson(candidateUrls);
  if (!remoteData) return null;

  const latestVer = (remoteData.version || remoteData.versionTag || '').replace(/^v/i, '');
  const verTag = remoteData.versionTag || `v${latestVer}`;
  const hasUpdate = compareVersions(currentVersion, latestVer) > 0;

  const rawUrl = remoteData.extensionDownloadUrl ||
    `https://github.com/${GITHUB_REPO}/releases/download/${verTag}/mantra-key-chrome-extension-${verTag}.zip`;
  const acceleratedUrl = rawUrl.startsWith('http') ? `${ACCELERATOR_PREFIX}${rawUrl}` : rawUrl;

  const info: ExtensionUpdateInfo = {
    hasUpdate,
    currentVersion,
    latestVersion: latestVer,
    versionTag: verTag,
    changelog: remoteData.changelog || '功能优化与稳定性升级',
    downloadUrl: rawUrl,
    acceleratedDownloadUrl: acceleratedUrl,
  };

  await saveCachedExtensionUpdate(info);
  await syncExtensionBadge(info.hasUpdate);
  return info;
}
