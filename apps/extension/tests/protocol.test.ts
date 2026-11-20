import test from 'node:test';
import assert from 'node:assert';
import {
  buildRequestEnvelope,
  validatePayloadSize,
  HeartbeatManager,
  MAX_PAYLOAD_SIZE,
} from '../src/utils/protocol.ts';

test('buildRequestEnvelope 应该生成符合 LLD-03 规范的请求信封', () => {
  const req = buildRequestEnvelope('QUERY_SESSION', { test: true });
  assert.ok(req.id && typeof req.id === 'string', 'id 必须为字符串');
  assert.strictEqual(req.action, 'QUERY_SESSION');
  assert.strictEqual(typeof req.ts, 'number');
  assert.deepStrictEqual(req.payload, { test: true });
});

test('validatePayloadSize 应该在不超过 1MB 时通过，超过时抛出溢出异常', () => {
  const safeData = 'a'.repeat(100);
  assert.doesNotThrow(() => validatePayloadSize(safeData));

  const overflowData = 'x'.repeat(MAX_PAYLOAD_SIZE + 1);
  assert.throws(
    () => validatePayloadSize(overflowData),
    /帧长度超出 1MB 安全上限/,
    '超过 1MB 必须抛出溢出保护异常'
  );
});

test('HeartbeatManager 应该以 25 秒周期发送 PING 报文', (t) => {
  const sentMessages: any[] = [];
  const mockPort = {
    postMessage: (msg: any) => sentMessages.push(msg),
  };

  const hb = new HeartbeatManager(mockPort as any, 25000);
  hb.start();

  // 手动触发一次心跳检查
  hb.tick();
  assert.strictEqual(sentMessages.length, 1);
  assert.strictEqual(sentMessages[0].action, 'PING');

  hb.stop();
});
