/**
 * Gateway 守护策略
 * 纯函数，便于测试自动重启与计数重置规则
 */

export const MAX_AUTO_RESTART = 3
export const RESTART_COOLDOWN = 60000
export const STABLE_RUNNING_MS = 120000

export function evaluateAutoRestartAttempt({
  now,
  lastRestartTime,
  autoRestartCount,
}) {
  if (now - lastRestartTime < RESTART_COOLDOWN) {
    return { action: 'cooldown' }
  }

  if (autoRestartCount >= MAX_AUTO_RESTART) {
    return { action: 'give_up' }
  }

  return {
    action: 'restart',
    autoRestartCount: autoRestartCount + 1,
    lastRestartTime: now,
  }
}

export function shouldResetAutoRestartCount({
  autoRestartCount,
  runningSince,
  now,
}) {
  if (autoRestartCount <= 0) return false
  if (!runningSince) return false
  return now - runningSince >= STABLE_RUNNING_MS
}
