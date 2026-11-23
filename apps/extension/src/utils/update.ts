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
  onProgress?: (statusText: string) => void
): Promise<AutoUpdateResult> {
  onProgress?.('正在连接本地原生更新代理...');

  // 1. 发送消息给 background 执行 Native 请求
  const res = await new Promise<any>((resolve) => {
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
      resolve(response);
    });
  });

  if (res && res.status === 'ok') {
    onProgress?.('🎉 本地文件覆写完成，正在热重载扩展...');
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
  onProgress?.('未检测到本地原生服务，正在为您下载离线更新包...');
  chrome.tabs.create({ url: info.acceleratedDownloadUrl });
  return {
    success: false,
    isNative: false,
    message: '本地未运行 Native 代理，已通过浏览器下载更新包，解压覆盖后刷新即可'
  };
}

export const GITHUB_REPO = 'lylyuanliang/mantra-key';
export const ACCELERATOR_PREFIX = 'https://ghfast.top/';

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
 * 获取最新版本元数据并比对当前插件版本
 */
export async function checkExtensionUpdate(): Promise<ExtensionUpdateInfo | null> {
  const manifest = chrome.runtime?.getManifest?.();
  const currentVersion = ((manifest as any)?.version_name || manifest?.version || '0.1.1.202611231846').trim();
  const timestamp = Date.now();

  const candidateUrls = [
    `https://ghfast.top/https://raw.githubusercontent.com/${GITHUB_REPO}/main/public/version.json?t=${timestamp}`,
    `https://raw.githubusercontent.com/${GITHUB_REPO}/main/public/version.json?t=${timestamp}`,
    `https://cdn.jsdelivr.net/gh/${GITHUB_REPO}@main/public/version.json?t=${timestamp}`
  ];

  let remoteData: any = null;
  for (const url of candidateUrls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json();
        if (json && (json.version || json.versionTag)) {
          remoteData = json;
          break;
        }
      }
    } catch {
      // 容错降级至下一个竞速通道
    }
  }

  if (!remoteData) return null;

  const latestVer = (remoteData.version || remoteData.versionTag || '').replace(/^v/i, '');
  const verTag = remoteData.versionTag || `v${latestVer}`;
  const hasUpdate = compareVersions(currentVersion, latestVer) > 0;

  const rawUrl = remoteData.extensionDownloadUrl ||
    `https://github.com/${GITHUB_REPO}/releases/download/${verTag}/mantra-key-chrome-extension-${verTag}.zip`;
  const acceleratedUrl = rawUrl.startsWith('http') ? `${ACCELERATOR_PREFIX}${rawUrl}` : rawUrl;

  return {
    hasUpdate,
    currentVersion,
    latestVersion: latestVer,
    versionTag: verTag,
    changelog: remoteData.changelog || '功能优化与稳定性升级',
    downloadUrl: rawUrl,
    acceleratedDownloadUrl: acceleratedUrl,
  };
}
