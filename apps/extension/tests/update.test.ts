import test from 'node:test';
import assert from 'node:assert';
import {
  checkExtensionUpdate,
  compareVersions,
  getCachedExtensionUpdate,
  hasNewUpdateBadge,
  isUpdateCacheStale,
  performExtensionAutoUpdate,
  saveCachedExtensionUpdate,
  UPDATE_CACHE_STORAGE_KEY,
  type ExtensionUpdateInfo,
} from '../src/utils/update.ts';

const storageState: Record<string, any> = {};
let currentBadgeText = '';

// 模拟 chrome API
(globalThis as any).chrome = {
  runtime: {
    id: 'test-ext-id',
    getManifest: () => ({ version: '0.1.3', version_name: '0.1.3.202611261647' }),
    reload: () => {},
    sendMessage: (msg: any, cb: (res: any) => void) => {
      if (msg.action === 'EXECUTE_EXTENSION_AUTO_UPDATE') {
        if (msg.payload?.downloadUrl?.includes('fail')) {
          cb({ status: 'error', message: 'Native host not reachable' });
        } else {
          cb({ status: 'ok', message: '原生静默更新完成', isNative: true });
        }
      }
    }
  },
  tabs: {
    create: (opts: any) => {
      (globalThis as any).__lastTabCreated = opts.url;
    }
  },
  storage: {
    local: {
      get: async (key: string) => ({ [key]: storageState[key] }),
      set: async (items: Record<string, any>) => {
        Object.assign(storageState, items);
      },
    },
  },
  action: {
    getBadgeText: async () => currentBadgeText,
    setBadgeText: async ({ text }: { text: string }) => {
      currentBadgeText = text;
    },
    setBadgeBackgroundColor: async () => {},
  },
};

test('compareVersions 应该准确对比语义化版本号', () => {
  assert.strictEqual(compareVersions('0.1.0', '0.1.1'), 1);
  assert.strictEqual(compareVersions('v0.1.0', 'v0.2.0'), 1);
  assert.strictEqual(compareVersions('0.1.0', '0.1.0'), 0);
  assert.strictEqual(compareVersions('0.2.0', '0.1.0'), -1);
  assert.strictEqual(compareVersions('1.0.0', '0.9.9'), -1);
  // 4位时间戳版本测试
  assert.strictEqual(compareVersions('0.1.1.202611231846', '0.1.1.202611231900'), 1);
  assert.strictEqual(compareVersions('0.1.1.202611231900', '0.1.1.202611231846'), -1);
  assert.strictEqual(compareVersions('0.1.1.202611231846', '0.1.1.202611231846'), 0);
});

test('performExtensionAutoUpdate 成功时应调用原生更新并触发热重载', async () => {
  const info: ExtensionUpdateInfo = {
    hasUpdate: true,
    currentVersion: '0.1.0',
    latestVersion: '0.1.1',
    versionTag: 'v0.1.1',
    changelog: '更新日志',
    downloadUrl: 'https://example.com/test.zip',
    acceleratedDownloadUrl: 'https://ghproxy.net/https://example.com/test.zip'
  };

  const logs: Array<{ text: string; percent?: number }> = [];
  const result = await performExtensionAutoUpdate(info, (t, percent) => {
    logs.push({ text: t, percent });
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.isNative, true);
  assert.ok(logs.some((l) => l.text.includes('本地文件覆写完成') && l.percent === 100));
});

test('performExtensionAutoUpdate 原生不可用时应平滑降级至浏览器下载', async () => {
  const info: ExtensionUpdateInfo = {
    hasUpdate: true,
    currentVersion: '0.1.0',
    latestVersion: '0.1.1',
    versionTag: 'v0.1.1',
    changelog: '更新日志',
    downloadUrl: 'https://example.com/fail.zip',
    acceleratedDownloadUrl: 'https://ghproxy.net/https://example.com/fail.zip'
  };

  const logs: string[] = [];
  const result = await performExtensionAutoUpdate(info, (t) => logs.push(t));

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.isNative, false);
  assert.ok(result.message.includes('浏览器下载更新包'));
  assert.strictEqual((globalThis as any).__lastTabCreated, info.acceleratedDownloadUrl);
});

test('getCachedExtensionUpdate 应命中同版本有效缓存并在版本变更后失效', async () => {
  delete storageState[UPDATE_CACHE_STORAGE_KEY];

  const cachedInfo: ExtensionUpdateInfo = {
    hasUpdate: true,
    currentVersion: '0.1.3.202611261647',
    latestVersion: '0.1.4.202611261800',
    versionTag: 'v0.1.4.202611261800',
    changelog: '性能优化',
    downloadUrl: 'https://example.com/v0.1.4.zip',
    acceleratedDownloadUrl: 'https://ghproxy.net/https://example.com/v0.1.4.zip',
  };
  await saveCachedExtensionUpdate(cachedInfo);

  const hit = await getCachedExtensionUpdate();
  assert.ok(hit);
  assert.strictEqual(hit?.info.hasUpdate, true);
  assert.strictEqual(hit?.info.latestVersion, '0.1.4.202611261800');
  assert.strictEqual(isUpdateCacheStale(hit), false);

  // 模拟缓存记录属于旧版本（扩展升级后应自动失效）
  storageState[UPDATE_CACHE_STORAGE_KEY].info.currentVersion = '0.1.2.202611251600';
  const expired = await getCachedExtensionUpdate();
  assert.strictEqual(expired, null);
  assert.strictEqual(isUpdateCacheStale(expired), true);
});

test('checkExtensionUpdate 应并发竞速采纳最快节点、写入缓存并同步角标', async () => {
  const originalFetch = globalThis.fetch;
  delete storageState[UPDATE_CACHE_STORAGE_KEY];
  currentBadgeText = '';

  let abortedCount = 0;
  (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
    // 模拟前两个镜像挂起或失败，仅 cdn.jsdelivr.net 快速返回更新版本
    if (url.includes('ghproxy.net')) {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          abortedCount++;
          reject(new Error('Aborted'));
        });
      });
    }
    if (url.includes('gh-proxy.com')) {
      return { ok: false, status: 502, json: async () => ({}) };
    }
    if (url.includes('raw.githubusercontent.com')) {
      throw new Error('Network error');
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        version: '0.1.5.202611261900',
        versionTag: 'v0.1.5.202611261900',
        changelog: '并发竞速更新',
      }),
    };
  };

  try {
    const startedAt = Date.now();
    const info = await checkExtensionUpdate();
    const elapsedMs = Date.now() - startedAt;

    assert.ok(info);
    assert.strictEqual(info?.hasUpdate, true);
    assert.strictEqual(info?.latestVersion, '0.1.5.202611261900');
    assert.strictEqual(elapsedMs < 1000, true);
    assert.strictEqual(abortedCount, 1);
    assert.strictEqual(await hasNewUpdateBadge(), true);

    const cached = await getCachedExtensionUpdate();
    assert.strictEqual(cached?.info.latestVersion, '0.1.5.202611261900');

    // 当远端与本地同版本时，应自动清理 NEW 角标
    (globalThis as any).fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        version: '0.1.3.202611261647',
        versionTag: 'v0.1.3.202611261647',
      }),
    });
    const latestInfo = await checkExtensionUpdate();
    assert.strictEqual(latestInfo?.hasUpdate, false);
    assert.strictEqual(await hasNewUpdateBadge(), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
