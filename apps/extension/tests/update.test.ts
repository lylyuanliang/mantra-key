import test from 'node:test';
import assert from 'node:assert';
import { compareVersions, performExtensionAutoUpdate, type ExtensionUpdateInfo } from '../src/utils/update.ts';

// 模拟 chrome API
(globalThis as any).chrome = {
  runtime: {
    id: 'test-ext-id',
    getManifest: () => ({ version: '0.1.1', version_name: '0.1.1.202611231846' }),
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
  }
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

  const logs: string[] = [];
  const result = await performExtensionAutoUpdate(info, (t) => logs.push(t));

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.isNative, true);
  assert.ok(logs.some((l) => l.includes('本地文件覆写完成')));
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
