import test from 'node:test'
import assert from 'node:assert/strict'

import {
  GATEWAY_SERVICE_LABEL,
  findGatewayService,
  getGatewayServiceSnapshot,
} from '../src/lib/service-status.js'

test('findGatewayService 优先按标签命中 Gateway，而不是默认取第一项', () => {
  const services = [
    { label: 'ai.openclaw.node', running: false, pid: 20, cli_installed: true },
    { label: GATEWAY_SERVICE_LABEL, running: true, pid: 9527, cli_installed: true },
  ]

  const gateway = findGatewayService(services)

  assert.equal(gateway?.label, GATEWAY_SERVICE_LABEL)
  assert.equal(gateway?.running, true)
  assert.equal(gateway?.pid, 9527)
})

test('getGatewayServiceSnapshot 在空列表时返回稳定的 stopped 默认值', () => {
  const snapshot = getGatewayServiceSnapshot([])

  assert.deepEqual(snapshot, {
    label: GATEWAY_SERVICE_LABEL,
    running: false,
    pid: null,
    description: 'OpenClaw Gateway',
    cli_installed: false,
  })
})

test('getGatewayServiceSnapshot 在旧格式服务列表下回退到第一项', () => {
  const snapshot = getGatewayServiceSnapshot([
    { label: 'legacy-service', running: true, pid: 101, cli_installed: true, description: 'Legacy' },
  ])

  assert.equal(snapshot.label, 'legacy-service')
  assert.equal(snapshot.running, true)
  assert.equal(snapshot.pid, 101)
  assert.equal(snapshot.cli_installed, true)
  assert.equal(snapshot.description, 'Legacy')
})
