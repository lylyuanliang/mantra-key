import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCanary,
  deriveMasterSeed,
  deriveSitePassword,
  rejectionSampling,
  RULE_PRESETS,
  CHARSET_STANDARD,
  clearMasterSeedCache,
} from '../src/utils/crypto.ts';

test('computeCanary 应该正确生成 8 位大写十六进制防手抖摘要', async () => {
  const canary1 = await computeCanary('CorrectHorseBatteryStaple2026!');
  assert.equal(canary1.length, 8);
  assert.equal(canary1, 'A6FAA80B');

  // 修改任意一个字符，金丝雀校验码立即发生巨变（雪崩效应）
  const canary2 = await computeCanary('CorrectHorseBatteryStaple2026?');
  assert.notEqual(canary1, canary2);
  assert.equal(canary2.length, 8);
});

test('deriveMasterSeed 应该确定性生成 32 字节主根种子', async () => {
  clearMasterSeedCache();
  const seed1 = await deriveMasterSeed('MySecretMantra');
  assert.equal(seed1.byteLength, 32);

  const seed2 = await deriveMasterSeed('MySecretMantra');
  assert.deepEqual(Array.from(seed1), Array.from(seed2));
});

test('rejectionSampling 应该从字符集中抽取指定长度且字符均合法', () => {
  const entropy = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160]);
  const pwd = rejectionSampling(entropy, CHARSET_STANDARD, 16);
  assert.equal(pwd.length, 16);
  for (const ch of pwd) {
    assert.ok(CHARSET_STANDARD.includes(ch));
  }
});

test('deriveSitePassword 应该具有确定性且支持不同规则与版本', async () => {
  const mantra = 'MasterPassword123!';
  const domain = 'github.com';
  const username = 'developer@company.org';

  // 同一参数两次运算结果完全一致
  const pwd1 = await deriveSitePassword(mantra, domain, username, 1, 'standard-16');
  const pwd2 = await deriveSitePassword(mantra, domain, username, 1, 'standard-16');
  assert.equal(pwd1, pwd2);
  assert.equal(pwd1.length, 16);

  // 版本升迁 (v1 -> v2) 产生全新强密码
  const pwdV2 = await deriveSitePassword(mantra, domain, username, 2, 'standard-16');
  assert.notEqual(pwd1, pwdV2);
  assert.equal(pwdV2.length, 16);

  // 规则切换测试：20位高强
  const pwd20 = await deriveSitePassword(mantra, domain, username, 1, 'secure-20');
  assert.equal(pwd20.length, 20);

  // 规则切换测试：6位纯数字 PIN
  const pin = await deriveSitePassword(mantra, domain, username, 1, 'pin-6');
  assert.equal(pin.length, 6);
  assert.match(pin, /^\d{6}$/);
});
