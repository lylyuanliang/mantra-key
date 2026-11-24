/**
 * 密诀 MantraKey Android - 在线更新服务 (Update Service)
 *
 * 参考自 Weekly-Mountain 最佳实践架构：
 * 1. 彻底解耦硬编码，优先读取 import.meta.env.VITE_GITHUB_REPO 或配置文件 update.json
 * 2. 具备多通道高可用竞速策略（开发机穿透通道 > 镜像加速通道 > GitHub Raw 直连 > jsDelivr CDN）
 * 3. 支持 Release / Debug 双变体下载与 SHA-256 完整性散列校验
 */

import defaultConfig from '../config/update.json';

export interface VersionMetadata {
  version: string;
  versionTag: string;
  title: string;
  changelog: string;
  publishedAt: string;
  assetName: string;
  assetSizeText: string;
  downloadUrl: string;
  rawDownloadUrl: string;
  releaseDownloadUrl: string;
  debugDownloadUrl: string;
  rawReleaseDownloadUrl: string;
  rawDebugDownloadUrl: string;
  releaseSha256: string;
  debugSha256: string;
  sha256: string;
  htmlUrl: string;
}

// 仓库配置，支持环境变量动态覆盖
export const GITHUB_REPO = (import.meta.env.VITE_GITHUB_REPO || defaultConfig.githubRepo).trim();
export const ACCELERATOR_PREFIX = (defaultConfig.acceleratorPrefix || 'https://ghproxy.net/').trim();
export const CURRENT_APP_VERSION = (import.meta.env.VITE_APP_VERSION || defaultConfig.version || '0.1.0').trim();

/**
 * 语义化版本号对比
 * 支持 3 位 (0.1.0) 与 4 位 (0.1.0.11181555) 比较
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
 * 字节数格式化为易读文本
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

/**
 * 尝试从远端下载并解析 SHA256SUMS.txt (多镜像竞速)
 */
export async function fetchSha256Sums(verTag: string): Promise<Record<string, string> | null> {
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
        const map: Record<string, string> = {};
        for (const line of text.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2) {
            const hash = parts[0].toLowerCase();
            const filename = parts[1].replace(/^\*/, '');
            map[filename] = hash;
            if (filename.includes('release')) {
              map.release = hash;
            } else if (filename.includes('debug')) {
              map.debug = hash;
            }
          }
        }
        return map;
      }
    } catch {
      // 容错降级
    }
  }
  return null;
}

/**
 * 获取最新版本元数据 (多通道竞速高可用)
 */
export async function fetchLatestRelease(isDebug: boolean = false): Promise<VersionMetadata> {
  const timestamp = Date.now();
  const savedTunnel = typeof window !== 'undefined' && window.localStorage
    ? (window.localStorage.getItem('af_api_base') || window.localStorage.getItem('mk_debug_tunnel_url') || '')
    : '';
  const cleanTunnel = savedTunnel.replace(/\/+$/, '');
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
    typeof window !== 'undefined' ? `/version.json?t=${timestamp}` : null
  ].filter(Boolean) as string[];

  let releaseData: any = null;

  for (const url of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json && (json.version || json.versionTag)) {
          if (!releaseData || compareVersions(releaseData.version || releaseData.versionTag, json.version || json.versionTag) > 0) {
            releaseData = json;
          }
          if (url === tunnelVersionUrl || url.includes('ghproxy.net') || url.includes('gh-proxy.com') || url.includes('raw.githubusercontent.com')) {
            break;
          }
        }
      }
    } catch {
      // 尝试下一个通道
    }
  }

  if (!releaseData || (!releaseData.version && !releaseData.versionTag)) {
    throw new Error('网络连接超时或无法解析最新版本信息');
  }

  const ver = releaseData.version || releaseData.versionTag.replace(/^v/i, '');
  const verTag = releaseData.versionTag || `v${ver}`;

  const rawReleaseUrl = releaseData.releaseDownloadUrl || `https://github.com/${GITHUB_REPO}/releases/download/${verTag}/mantra-key-${verTag}-release.apk`;
  const rawDebugUrl = releaseData.debugDownloadUrl || `https://github.com/${GITHUB_REPO}/releases/download/${verTag}/mantra-key-${verTag}-debug.apk`;

  const acceleratedReleaseUrl = rawReleaseUrl.startsWith('http') ? `${ACCELERATOR_PREFIX}${rawReleaseUrl}` : rawReleaseUrl;
  const acceleratedDebugUrl = rawDebugUrl.startsWith('http') ? `${ACCELERATOR_PREFIX}${rawDebugUrl}` : rawDebugUrl;

  const rawDownloadUrl = isDebug ? rawDebugUrl : rawReleaseUrl;
  const acceleratedUrl = isDebug ? acceleratedDebugUrl : acceleratedReleaseUrl;
  const assetName = isDebug ? `mantra-key-${verTag}-debug.apk` : `mantra-key-${verTag}-release.apk`;

  let releaseSha256 = '';
  let debugSha256 = '';

  // 权威来源优先：优先直接从 GitHub Release 资产中竞速拉取由 CI 生成的 SHA256SUMS.txt
  try {
    const shaMap = await fetchSha256Sums(verTag);
    if (shaMap) {
      releaseSha256 = shaMap.release || shaMap[`mantra-key-${verTag}-release.apk`] || '';
      debugSha256 = shaMap.debug || shaMap[`mantra-key-${verTag}-debug.apk`] || '';
    }
  } catch {
    // 容错降级
  }

  // 兜底来源：从 version.json 提取
  if (!releaseSha256) {
    releaseSha256 = (releaseData.releaseSha256 || '').trim().toLowerCase();
  }
  if (!debugSha256) {
    debugSha256 = (releaseData.debugSha256 || '').trim().toLowerCase();
  }

  const activeSha256 = isDebug ? debugSha256 : releaseSha256;

  return {
    version: ver,
    versionTag: verTag,
    title: releaseData.title || `密诀 MantraKey ${verTag}`,
    changelog: releaseData.changelog || '常规功能优化与性能稳定性提升。',
    publishedAt: releaseData.publishedAt || new Date().toLocaleDateString('zh-CN'),
    assetName: assetName,
    assetSizeText: releaseData.assetSizeText || '约 15 MB',
    downloadUrl: acceleratedUrl,
    rawDownloadUrl: rawDownloadUrl,
    releaseDownloadUrl: acceleratedReleaseUrl,
    debugDownloadUrl: acceleratedDebugUrl,
    rawReleaseDownloadUrl: rawReleaseUrl,
    rawDebugDownloadUrl: rawDebugUrl,
    releaseSha256: releaseSha256,
    debugSha256: debugSha256,
    sha256: activeSha256,
    htmlUrl: `https://github.com/${GITHUB_REPO}/releases/tag/${verTag}`
  };
}
