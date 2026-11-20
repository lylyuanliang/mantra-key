import test from 'node:test';
import assert from 'node:assert';
import { PasswordGatekeeper } from '../src/utils/gatekeeper.ts';

test('PasswordGatekeeper 应该支持两阶段暂存、提交与回滚', () => {
  const gatekeeper = new PasswordGatekeeper();

  // 1. 初始状态为空
  assert.strictEqual(gatekeeper.getStaged('github.com', 'alex.dev'), null);

  // 2. 暂存改密状态
  gatekeeper.stage({
    domain: 'github.com',
    username: 'alex.dev',
    oldVersion: 1,
    newVersion: 2,
    oldPasswordMask: '••••••••••••••••',
    newPasswordDerived: 'x9$K9#mQ82!zEnclave-v2',
  });

  const staged = gatekeeper.getStaged('github.com', 'alex.dev');
  assert.ok(staged, '应该存在暂存记录');
  assert.strictEqual(staged.oldVersion, 1);
  assert.strictEqual(staged.newVersion, 2);

  // 3. 提交确认改密
  const commitResult = gatekeeper.commit('github.com', 'alex.dev');
  assert.strictEqual(commitResult.success, true);
  assert.strictEqual(commitResult.committedVersion, 2);
  assert.strictEqual(gatekeeper.getStaged('github.com', 'alex.dev'), null);

  // 4. 测试回滚分支
  gatekeeper.stage({
    domain: 'github.com',
    username: 'alex.dev',
    oldVersion: 2,
    newVersion: 3,
    oldPasswordMask: '••••••••••••••••',
    newPasswordDerived: 'next-gen-pwd-v3',
  });
  const rollbackResult = gatekeeper.rollback('github.com', 'alex.dev');
  assert.strictEqual(rollbackResult.success, true);
  assert.strictEqual(rollbackResult.revertedVersion, 2);
  assert.strictEqual(gatekeeper.getStaged('github.com', 'alex.dev'), null);
});
