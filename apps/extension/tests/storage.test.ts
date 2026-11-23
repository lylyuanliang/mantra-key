import test from 'node:test';
import assert from 'node:assert';

// Mock chrome.storage.local for Node.js test environment
const mockStorage: Record<string, any> = {};

(globalThis as any).chrome = {
  storage: {
    local: {
      get: async (keys: any) => {
        if (!keys) return { ...mockStorage };
        if (typeof keys === 'string') return { [keys]: mockStorage[keys] };
        if (Array.isArray(keys)) {
          const res: Record<string, any> = {};
          keys.forEach((k) => { res[k] = mockStorage[k]; });
          return res;
        }
        return { ...mockStorage };
      },
      set: async (items: Record<string, any>) => {
        Object.assign(mockStorage, items);
      },
      remove: async (keys: string | string[]) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        arr.forEach((k) => delete mockStorage[k]);
      },
    },
  },
};

import {
  saveAccountForDomain,
  getAccountsForDomain,
  getAllAccountsManifest,
  linkDomainToExisting,
  matchDomainAlias,
} from '../src/utils/storage.ts';

test('matchDomainAlias 通配与跨域模式匹配', () => {
  assert.strictEqual(matchDomainAlias('*.三毛机场.com', 'gw-1.三毛机场.com'), true);
  assert.strictEqual(matchDomainAlias('*.三毛机场.com', '三毛机场.com'), true);
  assert.strictEqual(matchDomainAlias('cleanip.io', 'cleanip.io'), true);
  assert.strictEqual(matchDomainAlias('cleanip.io', 'other.com'), false);
});

test('getAccountsForDomain 动态常变域名识别 (三毛机场根域、Punycode与ServiceKey继承)', async () => {
  // 模拟用户在 三毛机场.com 存过账号，serviceKey 为 '三毛机场'
  await saveAccountForDomain('三毛机场.com', {
    username: 'sanmao_user@gmail.com',
    version: 1,
    rulePreset: 'standard-16',
    serviceKey: '三毛机场',
    aliases: ['*.三毛机场.com', 'cleanip.io'],
    tag: '服务: 三毛机场',
  });

  // 1. 访问动态子域 gw-1.三毛机场.com -> 应该智能继承
  const res1 = await getAccountsForDomain('gw-1.三毛机场.com');
  assert.strictEqual(res1.length, 1);
  assert.strictEqual(res1[0].username, 'sanmao_user@gmail.com');

  // 2. 访问 Punycode 形式的子域 gw-1.xn--ehqx7tcnnope.com -> 应该智能匹配
  const res2 = await getAccountsForDomain('gw-1.xn--ehqx7tcnnope.com');
  assert.strictEqual(res2.length, 1);
  assert.strictEqual(res2[0].username, 'sanmao_user@gmail.com');

  // 3. 访问别名站 cleanip.io -> 应该智能匹配
  const res3 = await getAccountsForDomain('cleanip.io');
  assert.strictEqual(res3.length, 1);
  assert.strictEqual(res3[0].username, 'sanmao_user@gmail.com');

  // 4. 访问一个完全陌生的域名，但网页标题含有 '三毛机场 - 登录中心' -> 应该智能匹配
  const res4 = await getAccountsForDomain('random-mirror-site.net', '三毛机场 - 登录中心');
  assert.strictEqual(res4.length, 1);
  assert.strictEqual(res4[0].username, 'sanmao_user@gmail.com');
});

test('getAllAccountsManifest 与 linkDomainToExisting 关联测试', async () => {
  const manifest = await getAllAccountsManifest();
  assert.ok(manifest.length >= 1);
  const found = manifest.find((g) => g.unicodeDomain.includes('三毛机场'));
  assert.ok(found);
  assert.strictEqual(found.accounts[0].username, 'sanmao_user@gmail.com');

  // 先模拟在镜像域名上存在一个未关联的错误旧记录 (serviceKey 为空，version 为 99)
  await saveAccountForDomain('new-flight-gw.org', {
    username: 'sanmao_user@gmail.com',
    version: 99,
    rulePreset: 'alphanumeric-16',
  });

  // 测试手动将新域名关联到已有服务
  const linked = await linkDomainToExisting('new-flight-gw.org', '三毛机场.com');
  assert.strictEqual(linked, true);

  // 再次查询新域名：验证旧错误记录被覆写，serviceKey 成功对齐为 '三毛机场'，且版本同步对齐
  const resLinked = await getAccountsForDomain('new-flight-gw.org');
  assert.strictEqual(resLinked.length, 1);
  assert.strictEqual(resLinked[0].username, 'sanmao_user@gmail.com');
  assert.strictEqual(resLinked[0].serviceKey, '三毛机场');
  assert.strictEqual(resLinked[0].version, 1);
  assert.strictEqual(resLinked[0].rulePreset, 'standard-16');
});
