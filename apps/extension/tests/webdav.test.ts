import test from 'node:test';
import assert from 'node:assert';
import {
  normalizeWebDAVUrl,
  packSyncEnvelope,
  unpackSyncEnvelope,
  mergeManifests,
  type ExtensionManifest
} from '../src/utils/webdav.ts';

test('WebDAV URL 规范化 - 坚果云地址', () => {
  assert.strictEqual(normalizeWebDAVUrl('https://dav.jianguoyun.com/dav'), 'https://dav.jianguoyun.com/dav/mantra-key');
  assert.strictEqual(normalizeWebDAVUrl('https://dav.jianguoyun.com/dav/'), 'https://dav.jianguoyun.com/dav/mantra-key');
});

test('WebDAV URL 规范化 - 自定义与其它服务器', () => {
  assert.strictEqual(normalizeWebDAVUrl('https://dav.jianguoyun.com/dav/custom-path'), 'https://dav.jianguoyun.com/dav/custom-path');
  assert.strictEqual(normalizeWebDAVUrl('https://nas.local:5005/dav/'), 'https://nas.local:5005/dav/');
});

const sampleManifest: ExtensionManifest = {
  schemaVersion: 1,
  canaryHash: 'TEST99',
  domains: {
    'github.com': {
      canonicalDomain: 'github.com',
      displayName: 'GitHub',
      rulePreset: 'standard-16',
      accounts: {
        'dev_user': {
          username: 'dev_user',
          version: 1,
          updatedAt: 1000,
          isDeleted: false
        }
      },
      updatedAt: 1000
    }
  },
  updatedAt: 1000
};

test('自描述信封 - 无密码时打包为 0x00 未加密明文信封', async () => {
  const envelope = await packSyncEnvelope(sampleManifest, '');
  assert.strictEqual(envelope[0], 0x4D); // 'M'
  assert.strictEqual(envelope[1], 0x4B); // 'K'
  assert.strictEqual(envelope[2], 0x00); // 0x00: 明文

  const unpacked = await unpackSyncEnvelope(envelope);
  assert.strictEqual(unpacked.isEncrypted, false);
  assert.strictEqual(unpacked.manifest.canaryHash, 'TEST99');
  assert.strictEqual(unpacked.manifest.domains['github.com'].displayName, 'GitHub');
});

test('自描述信封 - 配置同步密码时打包为 0x01 AES-256-GCM 密文信封', async () => {
  const syncPass = 'SyncSecret#2026';
  const envelope = await packSyncEnvelope(sampleManifest, syncPass);
  assert.strictEqual(envelope[0], 0x4D); // 'M'
  assert.strictEqual(envelope[1], 0x4B); // 'K'
  assert.strictEqual(envelope[2], 0x01); // 0x01: 密文

  const unpacked = await unpackSyncEnvelope(envelope, syncPass);
  assert.strictEqual(unpacked.isEncrypted, true);
  assert.strictEqual(unpacked.manifest.canaryHash, 'TEST99');
  assert.strictEqual(unpacked.manifest.domains['github.com'].accounts['dev_user'].username, 'dev_user');
});

test('自描述信封 - 云端密文但解包未传密码时抛出 NEED_SYNC_PASSWORD', async () => {
  const envelope = await packSyncEnvelope(sampleManifest, 'MySecret');
  let thrownCode = '';
  try {
    await unpackSyncEnvelope(envelope);
  } catch (err: any) {
    thrownCode = err.code;
  }
  assert.strictEqual(thrownCode, 'NEED_SYNC_PASSWORD');
});

test('自描述信封 - 密码错误时抛出 PASSWORD_MISMATCH', async () => {
  const envelope = await packSyncEnvelope(sampleManifest, 'CorrectPass');
  let thrownCode = '';
  try {
    await unpackSyncEnvelope(envelope, 'WrongPass');
  } catch (err: any) {
    thrownCode = err.code;
  }
  assert.strictEqual(thrownCode, 'PASSWORD_MISMATCH');
});

test('自描述信封 - 向前兼容最原始的纯 JSON 文本', async () => {
  const rawJsonStr = JSON.stringify(sampleManifest);
  const rawBytes = new TextEncoder().encode(rawJsonStr);

  const unpacked = await unpackSyncEnvelope(rawBytes);
  assert.strictEqual(unpacked.isEncrypted, false);
  assert.strictEqual(unpacked.manifest.canaryHash, 'TEST99');
});

test('CvRDT - 正确合并多端新增与更新条目', () => {
  const local: ExtensionManifest = {
    schemaVersion: 1,
    canaryHash: 'H1',
    domains: {
      'a.com': {
        canonicalDomain: 'a.com',
        displayName: 'A',
        rulePreset: 'standard-16',
        accounts: {
          'u1': { username: 'u1', version: 1, updatedAt: 100, isDeleted: false }
        },
        updatedAt: 100
      }
    },
    updatedAt: 100
  };

  const remote: ExtensionManifest = {
    schemaVersion: 1,
    canaryHash: 'H1',
    domains: {
      'b.com': {
        canonicalDomain: 'b.com',
        displayName: 'B',
        rulePreset: 'standard-16',
        accounts: {
          'u2': { username: 'u2', version: 1, updatedAt: 200, isDeleted: false }
        },
        updatedAt: 200
      }
    },
    updatedAt: 200
  };

  const merged = mergeManifests(local, remote);
  assert.ok(merged.domains['a.com']);
  assert.ok(merged.domains['b.com']);
  assert.strictEqual(merged.domains['a.com'].accounts['u1'].username, 'u1');
  assert.strictEqual(merged.domains['b.com'].accounts['u2'].username, 'u2');
});

test('CvRDT - 同一站点双端同步应合并 associatedDomains 与账号 aliases 并集', () => {
  const local: ExtensionManifest = {
    schemaVersion: 1,
    canaryHash: 'H1',
    domains: {
      'site.com': {
        canonicalDomain: 'site.com',
        displayName: 'Site',
        rulePreset: 'standard-16',
        serviceKey: 'site.com',
        associatedDomains: ['m1.site.com'],
        accounts: {
          'u1': { username: 'u1', version: 1, updatedAt: 100, isDeleted: false, aliases: ['m1.site.com'] }
        },
        updatedAt: 100
      }
    },
    updatedAt: 100
  };

  const remote: ExtensionManifest = {
    schemaVersion: 1,
    canaryHash: 'H1',
    domains: {
      'site.com': {
        canonicalDomain: 'site.com',
        displayName: 'Site',
        rulePreset: 'standard-16',
        associatedDomains: ['m2.site.com'],
        accounts: {
          'u1': { username: 'u1', version: 1, updatedAt: 200, isDeleted: false, aliases: ['m2.site.com'] }
        },
        updatedAt: 200
      }
    },
    updatedAt: 200
  };

  const merged = mergeManifests(local, remote);
  assert.deepStrictEqual(merged.domains['site.com'].associatedDomains, ['m1.site.com', 'm2.site.com']);
  assert.deepStrictEqual(merged.domains['site.com'].accounts['u1'].aliases, ['m1.site.com', 'm2.site.com']);
});
