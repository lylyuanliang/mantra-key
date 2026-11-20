import test from 'node:test';
import assert from 'node:assert';
import { extractDomain, toUnicodeDomain, getRootDomain } from '../src/utils/domain.ts';

test('extractDomain 应该准确提取主机名与规范域名', () => {
  assert.strictEqual(
    extractDomain('https://github.com/settings/security'),
    'github.com'
  );
  assert.strictEqual(
    extractDomain('http://localhost:3000/login'),
    'localhost'
  );
  assert.strictEqual(
    extractDomain('https://console.aws.amazon.com/iam/home'),
    'console.aws.amazon.com'
  );
  assert.strictEqual(
    extractDomain('invalid-url'),
    ''
  );
});

test('toUnicodeDomain 应该正确将 Punycode 还原为人类可读的中文字符串', () => {
  assert.strictEqual(
    toUnicodeDomain('xn--ehqx7tcnnope.com'),
    '三毛机场.com'
  );
  assert.strictEqual(
    toUnicodeDomain('github.com'),
    'github.com'
  );
});

test('getRootDomain 应该准确提取主根域名 (支持多级子域名与常变镜像前缀)', () => {
  assert.strictEqual(getRootDomain('gw-1.三毛机场.com'), '三毛机场.com');
  assert.strictEqual(getRootDomain('gw-1.xn--ehqx7tcnnope.com'), 'xn--ehqx7tcnnope.com');
  assert.strictEqual(getRootDomain('app.dev.cleanip.io'), 'cleanip.io');
  assert.strictEqual(getRootDomain('sub.example.co.uk'), 'example.co.uk');
  assert.strictEqual(getRootDomain('github.com'), 'github.com');
  assert.strictEqual(getRootDomain('localhost'), 'localhost');
});
