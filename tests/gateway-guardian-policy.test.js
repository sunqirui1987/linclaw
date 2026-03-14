import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_AUTO_RESTART,
  RESTART_COOLDOWN,
  STABLE_RUNNING_MS,
  evaluateAutoRestartAttempt,
  shouldResetAutoRestartCount,
} from '../src/lib/gateway-guardian-policy.js'

test('短暂恢复运行不应立即清零自动重启计数', () => {
  assert.equal(
    shouldResetAutoRestartCount({
      autoRestartCount: 2,
      runningSince: 10_000,
      now: 10_000 + STABLE_RUNNING_MS - 1,
    }),
    false,
  )
})

test('稳定运行超过阈值后才允许清零自动重启计数', () => {
  assert.equal(
    shouldResetAutoRestartCount({
      autoRestartCount: 2,
      runningSince: 10_000,
      now: 10_000 + STABLE_RUNNING_MS,
    }),
    true,
  )
})

test('达到最大自动重启次数后必须停止守护', () => {
  assert.deepEqual(
    evaluateAutoRestartAttempt({
      now: 90_000,
      lastRestartTime: 0,
      autoRestartCount: MAX_AUTO_RESTART,
    }),
    { action: 'give_up' },
  )
})

test('冷却时间内不应重复自动重启', () => {
  assert.deepEqual(
    evaluateAutoRestartAttempt({
      now: RESTART_COOLDOWN - 1,
      lastRestartTime: 0,
      autoRestartCount: 1,
    }),
    { action: 'cooldown' },
  )
})

test('满足条件时应增加自动重启计数并记录重启时间', () => {
  assert.deepEqual(
    evaluateAutoRestartAttempt({
      now: 120_000,
      lastRestartTime: 0,
      autoRestartCount: 1,
    }),
    {
      action: 'restart',
      autoRestartCount: 2,
      lastRestartTime: 120_000,
    },
  )
})
